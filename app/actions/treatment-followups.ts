"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertTenantOrganization } from "@/lib/tenant-server";
import { evaluateTreatmentWindow, latestIso, normalizeWindowDays } from "@/lib/treatment-followup-rules";
import { getOrganizationRequirements } from "@/lib/org-requirements-server";
import { requireOrganizationAdmin } from "@/lib/server/require-admin";
import { dateKeyInZone, isDateInPause, pauseRestartAt, type PauseWindow } from "@/lib/requirement-rules";

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
  /** The organization's required cadence, in days. */
  windowDays: number;
  /** True when the two-week window has lapsed and there is something to treat. */
  isDue: boolean;
  /** When the teacher fell due (ISO); null when not due. */
  dueSince: string | null;
  /** Latest recorded treatment by this teacher (ISO), if any. */
  lastDoneAt: string | null;
  /** Pending treatment plans the teacher may choose from, oldest report first. */
  candidates: TreatmentCandidate[];
};

const NOT_DUE: TreatmentFollowupStatus = { windowDays: 14, isDue: false, dueSince: null, lastDoneAt: null, candidates: [] };

export async function getTreatmentFollowupStatus(organizationId: string): Promise<TreatmentFollowupStatus> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NOT_DUE;
    await assertTenantOrganization(db, organizationId);
    const requirements = await getOrganizationRequirements(db, organizationId);
    const windowDays = requirements.treatmentWindowDays;

    // An admin-granted pause means nothing is due, whatever the history says.
    const today = dateKeyInZone(Date.now());
    if (today && isDateInPause(requirements.treatmentPause, today)) return { ...NOT_DUE, windowDays };

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

    return { windowDays, ...evaluateTreatmentWindow(doneTimes, candidates, windowDays, Date.now(), pauseRestartAt(requirements.treatmentPause)) };
  } catch (error) {
    console.error("Treatment follow-up load error:", error);
    return NOT_DUE;
  }
}

// ─── Admin: cadence setting + teacher compliance ─────────────────────────────

export type TeacherCompliance = {
  userId: string;
  name: string;
  /** Latest recorded treatment (ISO) and the student it was for. */
  lastDoneAt: string | null;
  lastDoneStudent: string | null;
  /** Oldest report (ISO) among still-pending plans; null when none are pending. */
  oldestPendingAt: string | null;
  pendingCount: number;
  /** Treatments recorded all-time (check-ins marked done + plans completed). */
  totalDone: number;
};

export type TeacherComplianceResult =
  | {
      success: true;
      windowDays: number;
      teachers: TeacherCompliance[];
      /** Admin-granted pause on this requirement (none when from is null). */
      pause: PauseWindow;
      /** When the last pause ended; the treatment clock restarts there. */
      restartAt: string | null;
    }
  | { success: false; error: string };

/**
 * Raw per-teacher facts for the admin compliance tab. The state (met / overdue /
 * ...) is deliberately NOT decided here: the browser classifies with the shared
 * rules so the admin can preview a different cadence before saving it.
 */
export async function getTeacherTreatmentCompliance(organizationId: string): Promise<TeacherComplianceResult> {
  try {
    const db = await requireOrganizationAdmin(organizationId);
    const requirements = await getOrganizationRequirements(db, organizationId);
    const windowDays = requirements.treatmentWindowDays;

    const { data: memberRows, error: memberError } = await db
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organizationId);
    if (memberError) throw memberError;
    const memberIds = (memberRows ?? []).map((row: any) => row.user_id);

    const { data: profiles } = memberIds.length > 0
      ? await db.from("profiles").select("id, name").in("id", memberIds)
      : { data: [] as any[] };
    const nameById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile.name as string | null]));

    // PostgREST returns at most 1,000 rows per request; page so a large
    // organization is never silently truncated.
    const reminders: any[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: page, error } = await db
        .from("treatment_plan_reminders")
        .select("responsible_user_id, is_active, reports!inner(created_at, treatment_plan, students(name))")
        .eq("organization_id", organizationId)
        .range(offset, offset + 999);
      if (error) throw error;
      reminders.push(...(page ?? []));
      if ((page ?? []).length < 1000) break;
    }

    const byUser = new Map<string, TeacherCompliance>();
    const ensure = (userId: string): TeacherCompliance => {
      let entry = byUser.get(userId);
      if (!entry) {
        entry = {
          userId,
          name: nameById.get(userId) ?? "Tanpa nama",
          lastDoneAt: null,
          lastDoneStudent: null,
          oldestPendingAt: null,
          pendingCount: 0,
          totalDone: 0,
        };
        byUser.set(userId, entry);
      }
      return entry;
    };

    // Teachers with no plans at all still belong on the list ("nothing pending").
    for (const row of (memberRows ?? []) as any[]) {
      if (row.role === "ustadz") ensure(row.user_id);
    }

    for (const row of reminders) {
      if (!row.responsible_user_id) continue;
      const entry = ensure(row.responsible_user_id);
      const report = row.reports;
      const plan = parsePlan(report?.treatment_plan);
      const treatment = plan?.treatment && typeof plan.treatment === "object" ? plan.treatment : {};
      const status = treatment.status ?? (treatment.completed ? "completed" : "pending");
      const studentName = String(report?.students?.name ?? "");

      const doneAtThisPlan: string[] = [];
      if (status === "completed") {
        const at = treatment.resolved_at ?? treatment.completed_at;
        if (at) doneAtThisPlan.push(String(at));
      }
      const checkins: any[] = Array.isArray(treatment.follow_up_checkins) ? treatment.follow_up_checkins : [];
      for (const checkin of checkins) {
        if (checkin?.outcome === "done" && checkin.created_at) doneAtThisPlan.push(String(checkin.created_at));
      }
      entry.totalDone += doneAtThisPlan.length;
      for (const at of doneAtThisPlan) {
        const best = latestIso([entry.lastDoneAt, at]);
        if (best !== entry.lastDoneAt) {
          entry.lastDoneAt = best;
          entry.lastDoneStudent = studentName || null;
        }
      }

      const actionPlan = String(treatment.action_plan ?? "").trim();
      if (row.is_active && status === "pending" && actionPlan) {
        entry.pendingCount += 1;
        const createdAt = report?.created_at ? String(report.created_at) : null;
        if (createdAt && (!entry.oldestPendingAt || createdAt < entry.oldestPendingAt)) entry.oldestPendingAt = createdAt;
      }
    }

    const teachers = Array.from(byUser.values());
    return { success: true, windowDays, teachers, pause: requirements.treatmentPause, restartAt: pauseRestartAt(requirements.treatmentPause) };
  } catch (error: any) {
    console.error("Teacher treatment compliance load error:", error);
    return { success: false, error: error?.message ?? "Data kepatuhan belum dapat dimuat." };
  }
}

export async function setTreatmentFollowupWindow(
  organizationId: string,
  days: number,
): Promise<{ success: true; windowDays: number } | { success: false; error: string }> {
  try {
    if (!Number.isInteger(days) || days !== normalizeWindowDays(days)) {
      return { success: false, error: "Isi jumlah hari antara 1 sampai 90." };
    }
    const db = await requireOrganizationAdmin(organizationId);
    const { data, error } = await db
      .from("organizations")
      .update({ treatment_followup_days: days })
      .eq("id", organizationId)
      .select("treatment_followup_days")
      .maybeSingle();

    if (error) {
      const missingColumn = /treatment_followup_days/.test(error.message ?? "");
      return {
        success: false,
        error: missingColumn
          ? "Pengaturan ini belum aktif di database. Jalankan migrasi 20261007_treatment_followup_window.sql terlebih dahulu."
          : error.message,
      };
    }
    // RLS filters a forbidden update down to zero rows instead of raising.
    if (!data) return { success: false, error: "Perubahan ditolak. Pastikan Anda admin organisasi ini." };

    revalidatePath("/admin/treatment-plans");
    revalidatePath("/students");
    return { success: true, windowDays: normalizeWindowDays(data.treatment_followup_days) };
  } catch (error: any) {
    return { success: false, error: error?.message ?? "Pengaturan belum dapat disimpan." };
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
