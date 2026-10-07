"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertTenantOrganization } from "@/lib/tenant-server";
import { evaluateTreatmentWindow } from "@/lib/treatment-followup-rules";

type TreatmentOutcome = "done" | "not_done";

function parsePlan(value: unknown): Record<string, any> {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === "object" ? { ...(value as Record<string, any>) } : {};
}

async function getManageableReminder(reminderId: string) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Silakan masuk kembali.");

  const { data: reminder, error } = await db
    .from("treatment_plan_reminders")
    .select("id, organization_id, report_id, student_id, responsible_user_id, next_check_at, is_active, reports!inner(id, treatment_plan)")
    .eq("id", reminderId)
    .maybeSingle();
  if (error || !reminder) throw error ?? new Error("Pengingat tidak ditemukan.");
  await assertTenantOrganization(db, reminder.organization_id);

  const { data: isAdmin } = await db.rpc("is_organization_admin", {
    target_organization_id: reminder.organization_id,
  });
  if (!isAdmin && reminder.responsible_user_id !== user.id) {
    throw new Error("Pengingat ini hanya dapat ditindaklanjuti oleh pembuat laporan atau admin.");
  }
  return { db, user, reminder };
}

export async function getTreatmentReminderForReport(reportId: string) {
  const db = await createClient();
  const { data } = await db
    .from("treatment_plan_reminders")
    .select("id, next_check_at, is_active")
    .eq("report_id", reportId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Treatment follow-up rule: every teacher records AT LEAST ONE treatment per
 * rolling two weeks, on whichever student/report they judge needs it most.
 *
 * (Earlier design: every report carried its own 14-day deadline. The
 * treatment_plan_reminders row per report, created by the trigger in
 * scripts/migrations/20260921_cds_treatment_followups.sql, still exists, but is
 * now only the teacher's list of still-pending treatment plans; its
 * next_check_at no longer drives anything.)
 *
 * A treatment counts as "done" when it was recorded through a "done" check-in or
 * the plan was marked completed on the report page.
 */
export type TreatmentCandidate = {
  id: string;
  reportId: string;
  studentName: string;
  title: string;
  actionPlan: string;
  /** When the report that produced the plan was written (ISO). */
  reportCreatedAt: string | null;
  priorityTheme: string;
  priorityIndicator: string;
  targetSubIndicators: string[];
  /** Most recent earlier check-ins on this plan, newest last. */
  previousCheckins: Array<{ outcome: "done" | "not_done"; reflection: string; createdAt: string }>;
};

export type TreatmentFollowupStatus = {
  /** True when the two-week window has lapsed and there is something to treat. */
  isDue: boolean;
  /** When the teacher fell due (ISO); null when not due. */
  dueSince: string | null;
  /** Latest recorded treatment by this teacher (ISO), if any. */
  lastDoneAt: string | null;
  /** Pending treatment plans the teacher may choose from, oldest report first. */
  candidates: TreatmentCandidate[];
};

const NOT_DUE: TreatmentFollowupStatus = { isDue: false, dueSince: null, lastDoneAt: null, candidates: [] };

export async function getTreatmentFollowupStatus(organizationId: string): Promise<TreatmentFollowupStatus> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NOT_DUE;
    await assertTenantOrganization(db, organizationId);

    // All of this teacher's reminder rows (active and finished): finished ones
    // are needed to know when they last completed a treatment.
    const { data, error } = await db
      .from("treatment_plan_reminders")
      .select("id, report_id, is_active, reports!inner(id, title, created_at, treatment_plan, students(name))")
      .eq("organization_id", organizationId)
      .eq("responsible_user_id", user.id);
    if (error) throw error;

    const doneTimes: Array<string | null> = [];
    const candidates: TreatmentCandidate[] = [];

    for (const row of (data ?? []) as any[]) {
      const report = row.reports;
      const plan = parsePlan(report?.treatment_plan);
      const treatment = plan?.treatment && typeof plan.treatment === "object" ? plan.treatment : {};
      const checkins: any[] = Array.isArray(treatment.follow_up_checkins) ? treatment.follow_up_checkins : [];
      const status = treatment.status ?? (treatment.completed ? "completed" : "pending");

      if (status === "completed") doneTimes.push(treatment.resolved_at ?? treatment.completed_at ?? null);
      for (const checkin of checkins) {
        if (checkin?.outcome === "done") doneTimes.push(checkin.created_at ?? null);
      }

      const actionPlan = String(treatment.action_plan ?? "").trim();
      if (!row.is_active || status !== "pending" || !actionPlan) continue;

      candidates.push({
        id: row.id,
        reportId: row.report_id,
        studentName: String(report?.students?.name ?? "Santri"),
        title: String(report?.title ?? "Laporan Perkembangan"),
        actionPlan,
        reportCreatedAt: report?.created_at ? String(report.created_at) : null,
        priorityTheme: String(treatment.priority_theme ?? ""),
        priorityIndicator: String(treatment.priority_indicator ?? ""),
        targetSubIndicators: Array.isArray(treatment.target_sub_indicators)
          ? treatment.target_sub_indicators.map((item: unknown) => String(item)).filter(Boolean)
          : [],
        previousCheckins: checkins.slice(-2).map((item: any) => ({
          outcome: item?.outcome === "done" ? "done" : "not_done",
          reflection: String(item?.reflection ?? ""),
          createdAt: String(item?.created_at ?? ""),
        })),
      });
    }

    return evaluateTreatmentWindow(doneTimes, candidates);
  } catch (error) {
    console.error("Treatment follow-up load error:", error);
    return NOT_DUE;
  }
}

export async function recordTreatmentFollowup(
  reminderId: string,
  outcome: TreatmentOutcome,
  reflection: string,
): Promise<{ success: boolean; nextCheckAt?: string; error?: string }> {
  try {
    const note = reflection.trim();
    if (outcome !== "done" && outcome !== "not_done") throw new Error("Pilih status tindak lanjut.");
    if (note.length < 12) throw new Error("Tuliskan sedikit alasan atau hasil pengamatan sebelum menyimpan.");
    const { db, user, reminder } = await getManageableReminder(reminderId);
    if (!reminder.is_active) throw new Error("Rencana ini sudah ditandai selesai.");
    const now = new Date();
    if (outcome === "not_done" && new Date(reminder.next_check_at) > now) {
      throw new Error("Rencana ini belum memasuki waktu pengecekan.");
    }

    const report = reminder.reports as any;
    const plan = parsePlan(report?.treatment_plan);
    const treatment = plan.treatment && typeof plan.treatment === "object" ? plan.treatment : {};
    const previousCheckins = Array.isArray(treatment.follow_up_checkins) ? treatment.follow_up_checkins : [];
    treatment.follow_up_checkins = [
      ...previousCheckins,
      { outcome, reflection: note, created_at: now.toISOString() },
    ].slice(-6);
    treatment.last_follow_up_at = now.toISOString();
    treatment.last_follow_up_note = note;
    treatment.status = outcome === "done" ? "completed" : "pending";
    treatment.completed = outcome === "done";
    treatment.completed_at = outcome === "done" ? now.toISOString() : null;
    treatment.resolved_at = outcome === "done" ? now.toISOString() : null;
    treatment.outcome_note = outcome === "done" ? note : null;
    plan.treatment = treatment;

    const nextCheckAt = outcome === "done" ? null : new Date(now.getTime() + 2 * 86_400_000).toISOString();
    const [{ error: checkinError }, { error: reminderError }, { error: reportError }] = await Promise.all([
      db.from("treatment_plan_checkins").insert({
        organization_id: reminder.organization_id,
        report_id: reminder.report_id,
        reminder_id: reminder.id,
        created_by: user.id,
        outcome,
        reflection: note,
      }),
      db.from("treatment_plan_reminders").update({
        is_active: outcome !== "done",
        ...(nextCheckAt ? { next_check_at: nextCheckAt } : {}),
      }).eq("id", reminder.id),
      db.from("reports").update({ treatment_plan: plan }).eq("id", reminder.report_id),
    ]);
    if (checkinError || reminderError || reportError) throw checkinError ?? reminderError ?? reportError;

    revalidatePath(`/reports/${reminder.report_id}`);
    revalidatePath("/students");
    revalidatePath("/admin/treatment-plans");
    return { success: true, nextCheckAt: nextCheckAt ?? undefined };
  } catch (error: any) {
    return { success: false, error: error.message ?? "Tindak lanjut belum dapat disimpan." };
  }
}
