"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertTenantOrganization } from "@/lib/tenant-server";

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

export async function getDueTreatmentFollowups(organizationId: string): Promise<Array<{
  id: string;
  reportId: string;
  studentName: string;
  title: string;
  actionPlan: string;
}>> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return [];
    await assertTenantOrganization(db, organizationId);
    const { data, error } = await db
      .from("treatment_plan_reminders")
      .select("id, report_id, reports!inner(id, title, treatment_plan, students(name))")
      .eq("organization_id", organizationId)
      .eq("responsible_user_id", user.id)
      .eq("is_active", true)
      .lte("next_check_at", new Date().toISOString())
      .order("next_check_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row: any) => {
      const report = row.reports;
      const plan = parsePlan(report?.treatment_plan);
      return {
        id: row.id,
        reportId: row.report_id,
        studentName: String(report?.students?.name ?? "Santri"),
        title: String(report?.title ?? "Laporan Perkembangan"),
        actionPlan: String(plan?.treatment?.action_plan ?? ""),
      };
    });
  } catch (error) {
    console.error("Treatment follow-up load error:", error);
    return [];
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
