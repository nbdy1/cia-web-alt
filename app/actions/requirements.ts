"use server";

/**
 * Admin-configurable requirements stored on the organization:
 *   - the weekly report target (cycle length, deadline weekday, what counts)
 *   - a pause window for either that target or the treatment follow-up target
 *
 * Reads are admin-only because the only screens that show them are admin screens;
 * teachers are judged server-side by their own actions. Columns come from
 * scripts/migrations/20261008_report_requirement_and_pauses.sql (+ 20261007 for the
 * treatment cadence).
 */
import { revalidatePath } from "next/cache";
import { getOrganizationRequirements } from "@/lib/org-requirements-server";
import { requireOrganizationAdmin } from "@/lib/server/require-admin";
import { normalizeReportRequirement, type ReportRequirement } from "@/lib/report-requirement-rules";
import { isValidDateKey, normalizePause, type PauseWindow } from "@/lib/requirement-rules";

export type RequirementKind = "report" | "treatment";

const MIGRATION_HINT =
  "Pengaturan ini belum aktif di database. Jalankan migrasi 20261008_report_requirement_and_pauses.sql terlebih dahulu.";

function failure(error: any, fallback: string) {
  const message: string = error?.message ?? fallback;
  // PostgREST reports an unknown column in the message; point admins at the fix.
  return { success: false as const, error: /report_|treatment_pause|column/i.test(message) ? MIGRATION_HINT : message };
}

export async function getReportRequirementSettings(
  organizationId: string,
): Promise<{ success: true; requirement: ReportRequirement; pause: PauseWindow } | { success: false; error: string }> {
  try {
    const db = await requireOrganizationAdmin(organizationId);
    const requirements = await getOrganizationRequirements(db, organizationId);
    return { success: true, requirement: requirements.report, pause: requirements.reportPause };
  } catch (error: any) {
    return { success: false, error: error?.message ?? "Pengaturan belum dapat dimuat." };
  }
}

export async function saveReportRequirement(
  organizationId: string,
  requirement: ReportRequirement,
): Promise<{ success: true; requirement: ReportRequirement } | { success: false; error: string }> {
  try {
    const clean = normalizeReportRequirement(requirement);
    // Reject (rather than silently clamp) anything the UI should never have sent.
    if (JSON.stringify(clean) !== JSON.stringify(requirement)) {
      return { success: false, error: "Pengaturan tidak valid. Periksa kembali isian Anda." };
    }
    const db = await requireOrganizationAdmin(organizationId);
    const { data, error } = await db
      .from("organizations")
      .update({
        report_cycle_weeks: clean.cycleWeeks,
        report_deadline_weekday: clean.deadlineWeekday,
        report_requirement_mode: clean.mode,
        report_min_count: clean.minCount,
      })
      .eq("id", organizationId)
      .select("id")
      .maybeSingle();
    if (error) return failure(error, "Pengaturan belum dapat disimpan.");
    // RLS turns a forbidden update into zero rows rather than an error.
    if (!data) return { success: false, error: "Perubahan ditolak. Pastikan Anda admin organisasi ini." };

    revalidatePath("/admin/monitoring");
    return { success: true, requirement: clean };
  } catch (error: any) {
    return failure(error, "Pengaturan belum dapat disimpan.");
  }
}

/**
 * Pause (or resume) a requirement.
 *   from = null            → remove the pause
 *   from set, until null   → paused until an admin turns it back on
 *   from set, until set    → paused for that inclusive date range
 * Dates are YYYY-MM-DD calendar days in the school's time zone.
 */
export async function setRequirementPause(
  organizationId: string,
  kind: RequirementKind,
  from: string | null,
  until: string | null,
): Promise<{ success: true; pause: PauseWindow } | { success: false; error: string }> {
  try {
    if (kind !== "report" && kind !== "treatment") return { success: false, error: "Jenis target tidak dikenal." };
    if (from !== null && !isValidDateKey(from)) return { success: false, error: "Tanggal mulai tidak valid." };
    if (until !== null && !isValidDateKey(until)) return { success: false, error: "Tanggal selesai tidak valid." };
    if (from === null && until !== null) return { success: false, error: "Isi tanggal mulai jeda." };
    if (from !== null && until !== null && until < from) {
      return { success: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
    }

    const db = await requireOrganizationAdmin(organizationId);
    const columns = kind === "report"
      ? { report_pause_from: from, report_pause_until: until }
      : { treatment_pause_from: from, treatment_pause_until: until };
    const { data, error } = await db.from("organizations").update(columns).eq("id", organizationId).select("id").maybeSingle();
    if (error) return failure(error, "Jeda belum dapat disimpan.");
    if (!data) return { success: false, error: "Perubahan ditolak. Pastikan Anda admin organisasi ini." };

    revalidatePath("/admin/monitoring");
    revalidatePath("/admin/treatment-plans");
    revalidatePath("/students");
    return { success: true, pause: normalizePause(from, until) };
  } catch (error: any) {
    return failure(error, "Jeda belum dapat disimpan.");
  }
}
