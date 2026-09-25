"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertTenantOrganization } from "@/lib/tenant-server";

const FREQUENCIES = new Set([1, 3, 7, 14]);
type CheckinOutcome = "done" | "not_done";

function isFrequency(value: number): value is 1 | 3 | 7 | 14 {
  return FREQUENCIES.has(value);
}

function parseAnalysis(value: unknown): Record<string, any> {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === "object" ? { ...(value as Record<string, any>) } : {};
}

async function getEditableReport(reportId: string) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Silakan masuk kembali.");

  const { data: report, error } = await db
    .from("bp_reports")
    .select("id, organization_id, created_by, student_id, title, analysis")
    .eq("id", reportId)
    .maybeSingle();
  if (error || !report) throw error ?? new Error("Catatan bimbingan tidak ditemukan.");
  await assertTenantOrganization(db, report.organization_id);

  const { data: isAdmin } = await db.rpc("is_organization_admin", {
    target_organization_id: report.organization_id,
  });
  if (!isAdmin && report.created_by !== user.id) {
    throw new Error("Hanya pembuat catatan atau admin yang dapat mengatur pengingat ini.");
  }
  return { db, user, report };
}

export async function saveBpTreatmentReminder(
  reportId: string,
  frequencyDays: number,
): Promise<{ success: boolean; nextCheckAt?: string; error?: string }> {
  try {
    if (!isFrequency(frequencyDays)) throw new Error("Pilih frekuensi pengingat yang tersedia.");
    const { db, user, report } = await getEditableReport(reportId);
    const nextCheckAt = new Date(Date.now() + frequencyDays * 86_400_000).toISOString();
    const { error } = await db.from("bp_treatment_reminders").upsert({
      organization_id: report.organization_id,
      report_id: report.id,
      created_by: user.id,
      frequency_days: frequencyDays,
      next_check_at: nextCheckAt,
      is_active: true,
    }, { onConflict: "report_id" });
    if (error) throw error;
    revalidatePath(`/bk/reports/${report.id}`);
    revalidatePath("/bk");
    return { success: true, nextCheckAt };
  } catch (error: any) {
    return { success: false, error: error.message ?? "Pengingat belum dapat disimpan." };
  }
}

export async function getDueBpTreatmentReminders(organizationId: string): Promise<Array<{
  id: string;
  reportId: string;
  title: string;
  studentName: string;
  summary: string;
}>> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return [];
    await assertTenantOrganization(db, organizationId);
    const { data, error } = await db
      .from("bp_treatment_reminders")
      .select("id, report_id, bp_reports!inner(id, title, analysis, students(name))")
      .eq("organization_id", organizationId)
      .eq("created_by", user.id)
      .eq("is_active", true)
      .lte("next_check_at", new Date().toISOString())
      .order("next_check_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row: any) => {
      const report = row.bp_reports;
      const analysis = parseAnalysis(report?.analysis);
      return {
        id: row.id,
        reportId: row.report_id,
        title: String(report?.title ?? "Catatan bimbingan"),
        studentName: String(report?.students?.name ?? "Siswa"),
        summary: String(analysis.summary ?? ""),
      };
    });
  } catch (error) {
    console.error("BK reminder load error:", error);
    return [];
  }
}

export async function saveBpTreatmentCheckin(
  reminderId: string,
  outcome: CheckinOutcome,
  reflection: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const note = reflection.trim();
    if (outcome !== "done" && outcome !== "not_done") throw new Error("Pilih status tindak lanjut.");
    if (note.length < 12) throw new Error("Tuliskan sedikit alasan atau pengamatan agar tindak lanjut berikutnya dapat disesuaikan.");

    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error("Silakan masuk kembali.");
    const { data: reminder, error: reminderError } = await db
      .from("bp_treatment_reminders")
      .select("id, report_id, organization_id, created_by, frequency_days, bp_reports!inner(id, title, analysis)")
      .eq("id", reminderId)
      .maybeSingle();
    if (reminderError || !reminder) throw reminderError ?? new Error("Pengingat tidak ditemukan.");
    await assertTenantOrganization(db, reminder.organization_id);
    const { data: isAdmin } = await db.rpc("is_organization_admin", {
      target_organization_id: reminder.organization_id,
    });
    if (!isAdmin && reminder.created_by !== user.id) throw new Error("Anda tidak dapat mengisi tindak lanjut ini.");

    const checkedAt = new Date();
    const nextCheckAt = new Date(checkedAt.getTime() + reminder.frequency_days * 86_400_000).toISOString();
    const report = reminder.bp_reports as any;
    const analysis = parseAnalysis(report?.analysis);
    const previous = Array.isArray(analysis.follow_up_checkins) ? analysis.follow_up_checkins : [];
    analysis.follow_up_checkins = [
      ...previous,
      { outcome, reflection: note, created_at: checkedAt.toISOString() },
    ].slice(-6);

    const [{ error: checkinError }, { error: updateReminderError }, { error: updateReportError }] = await Promise.all([
      db.from("bp_treatment_checkins").insert({
        reminder_id: reminder.id,
        organization_id: reminder.organization_id,
        created_by: user.id,
        outcome,
        reflection: note,
      }),
      db.from("bp_treatment_reminders").update({ next_check_at: nextCheckAt }).eq("id", reminder.id),
      db.from("bp_reports").update({ analysis }).eq("id", reminder.report_id),
    ]);
    if (checkinError || updateReminderError || updateReportError) {
      throw checkinError ?? updateReminderError ?? updateReportError;
    }
    revalidatePath(`/bk/reports/${reminder.report_id}`);
    revalidatePath("/bk");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message ?? "Tindak lanjut belum dapat disimpan." };
  }
}
