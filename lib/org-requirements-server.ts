import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_REPORT_REQUIREMENT,
  normalizeReportRequirement,
  type ReportRequirement,
} from "@/lib/report-requirement-rules";
import { NO_PAUSE, normalizePause, type PauseWindow } from "@/lib/requirement-rules";
import { DEFAULT_TREATMENT_WINDOW_DAYS, normalizeWindowDays } from "@/lib/treatment-followup-rules";

export type OrganizationRequirements = {
  treatmentWindowDays: number;
  treatmentPause: PauseWindow;
  report: ReportRequirement;
  reportPause: PauseWindow;
};

export const DEFAULT_ORGANIZATION_REQUIREMENTS: OrganizationRequirements = {
  treatmentWindowDays: DEFAULT_TREATMENT_WINDOW_DAYS,
  treatmentPause: NO_PAUSE,
  report: DEFAULT_REPORT_REQUIREMENT,
  reportPause: NO_PAUSE,
};

/**
 * All admin-configurable requirements for an organization (treatment cadence,
 * weekly report target, and a pause for each).
 *
 * Reads the whole row (`select *`) on purpose: if one of the migrations
 * (20261007 / 20261008) has not been applied yet the missing columns are simply
 * absent and defaults apply, instead of a named-column query failing outright and
 * breaking teachers' pages.
 */
export async function getOrganizationRequirements(db: SupabaseClient, organizationId: string): Promise<OrganizationRequirements> {
  const { data, error } = await db.from("organizations").select("*").eq("id", organizationId).maybeSingle();
  if (error || !data) return DEFAULT_ORGANIZATION_REQUIREMENTS;
  const row = data as Record<string, unknown>;
  return {
    treatmentWindowDays: normalizeWindowDays(row.treatment_followup_days),
    treatmentPause: normalizePause(row.treatment_pause_from, row.treatment_pause_until),
    report: normalizeReportRequirement({
      cycleWeeks: row.report_cycle_weeks,
      deadlineWeekday: row.report_deadline_weekday,
      mode: row.report_requirement_mode,
      minCount: row.report_min_count,
    }),
    reportPause: normalizePause(row.report_pause_from, row.report_pause_until),
  };
}

/**
 * Is this member exempt from the report / treatment targets? Reads the whole row
 * so a missing column (migration 20261009 not applied) simply means "not exempt".
 */
export async function isMemberExempt(db: SupabaseClient, organizationId: string, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return (data as Record<string, unknown>).targets_exempt === true;
}
