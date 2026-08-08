/**
 * lib/super-admin/usage-helpers.ts
 *
 * Pure data-shaping logic for the /super-admin/usage dashboard
 * (app/super-admin/usage/page.tsx), pulled out of that "use client" file so
 * it can be unit tested without a live Supabase client (that file creates
 * one at module scope, which throws when env vars aren't loaded — see
 * lib/supabase/client.ts). Everything here takes plain data in, returns
 * plain data out; no fetching, no React, no dates read implicitly from the
 * system clock unless explicitly passed a `now` override.
 */

export type OrgRow = {
  id: string;
  name: string;
  plan: string;
  status: string;
  reportsUsed: number;
  reportsLimit: number | null;
  voiceUsed: number;
  voiceLimit: number | null;
  cost: number;
  revenue: number;
  margin: number;
  marginPct: number | null;
};

export type BreakdownRow = {
  purpose: string;
  provider: string;
  cost_idr: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  char_count: number;
  event_count: number;
};

export type DailyRow = {
  day: string;
  provider: string;
  cost_idr: number;
  cost_usd: number;
  char_count: number;
  event_count: number;
};

export type RangeKey = "month" | "6m" | "all";

// Builds one per-org table row from the four independently-fetched sources
// (org, its active subscription, that subscription's plan, and this month's
// usage counter) — pure so the revenue/cost/margin math that drives billing
// visibility can be tested without a live Supabase round-trip.
export function buildOrgRow(
  org: { id: string; name: string },
  sub: { status?: string; plan_id?: string; custom_price_idr?: number | null } | undefined,
  plan:
    | {
        name?: string;
        price_idr?: number;
        max_reports_per_period?: number | null;
        max_voice_chars_per_period?: number | null;
      }
    | null
    | undefined,
  counter: { reports_used?: number; voice_chars?: number; cost_idr?: number } | undefined,
): OrgRow {
  const status = sub?.status ?? "none";
  const isPaying = status === "active";
  const revenue = isPaying ? (sub?.custom_price_idr ?? plan?.price_idr ?? 0) : 0;
  const cost = Number(counter?.cost_idr ?? 0);
  const margin = revenue - cost;
  return {
    id: org.id,
    name: org.name,
    plan: plan?.name ?? "—",
    status,
    reportsUsed: counter?.reports_used ?? 0,
    reportsLimit: plan?.max_reports_per_period ?? null,
    voiceUsed: Number(counter?.voice_chars ?? 0),
    voiceLimit: plan?.max_voice_chars_per_period ?? null,
    cost,
    revenue,
    margin,
    marginPct: revenue > 0 ? margin / revenue : null,
  };
}

export function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Exclusive upper bound covering "through today" regardless of local timezone.
export function tomorrow(now = new Date()) {
  return new Date(now.getTime() + 24 * 3600 * 1000);
}

export function rangeToDates(range: RangeKey, now = new Date()): { from: Date; to: Date } {
  const to = tomorrow(now);
  if (range === "month") return { from: monthStart(now), to };
  if (range === "6m") return { from: monthStart(new Date(new Date(now).setMonth(now.getMonth() - 5))), to };
  return { from: new Date(2000, 0, 1), to };
}

// Rolls up purpose/provider breakdown rows into per-provider totals for the
// "Token & Karakter" panel — OpenRouter is token-metered, ElevenLabs is
// character-metered, so they're shown as two distinct stat blocks.
export function summarizeByProvider(rows: BreakdownRow[]) {
  const totals: Record<
    string,
    { cost: number; costUsd: number; inputTokens: number; outputTokens: number; chars: number; events: number }
  > = {};
  for (const r of rows) {
    const bucket = totals[r.provider] ?? { cost: 0, costUsd: 0, inputTokens: 0, outputTokens: 0, chars: 0, events: 0 };
    bucket.cost += Number(r.cost_idr ?? 0);
    bucket.costUsd += Number(r.cost_usd ?? 0);
    bucket.inputTokens += Number(r.input_tokens ?? 0);
    bucket.outputTokens += Number(r.output_tokens ?? 0);
    bucket.chars += Number(r.char_count ?? 0);
    bucket.events += Number(r.event_count ?? 0);
    totals[r.provider] = bucket;
  }
  return totals;
}

// Pivots {day, provider, cost} rows into one chart-friendly row per day with
// an IDR and a USD column per provider, so recharts can render grouped bars
// side by side and the IDR/USD toggle can just switch which dataKeys it
// reads without re-fetching or re-pivoting.
export function pivotDailyByProvider(rows: DailyRow[]) {
  const byDay = new Map<
    string,
    { day: string; openrouter: number; elevenlabs: number; openrouterUsd: number; elevenlabsUsd: number }
  >();
  for (const r of rows) {
    const bucket = byDay.get(r.day) ?? { day: r.day, openrouter: 0, elevenlabs: 0, openrouterUsd: 0, elevenlabsUsd: 0 };
    if (r.provider === "openrouter") {
      bucket.openrouter += Number(r.cost_idr ?? 0);
      bucket.openrouterUsd += Number(r.cost_usd ?? 0);
    } else if (r.provider === "elevenlabs") {
      bucket.elevenlabs += Number(r.cost_idr ?? 0);
      bucket.elevenlabsUsd += Number(r.cost_usd ?? 0);
    }
    byDay.set(r.day, bucket);
  }
  return Array.from(byDay.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((r) => ({ ...r, label: new Date(r.day).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) }));
}

// UTC Monday of the current week. OpenRouter's `usage_weekly` (see
// app/actions/usage-live-check.ts) turned out to be week-to-date — it resets
// every week rather than being a rolling trailing-7-days sum — so a rolling
// window here made the app total look ~30-40% inflated against it even
// though nothing was actually wrong (the two just meant different things by
// "this week"). Matching week-to-date here mirrors monthStartKey below,
// which already uses month-to-date and consistently shows "✓ selaras".
export function weekStartKeyUTC(now = new Date()): string {
  const utcDay = now.getUTCDay(); // 0=Sun..6=Sat
  const diff = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
}

// Sums the app's own tracked cost for "today" / "this week" / "this month" so
// they can sit next to the provider's own live-reported figures for the same
// windows — the whole point of the live-check panel is spotting drift.
export function summarizeAppWindow(rows: DailyRow[], provider: string, now = new Date()) {
  const todayKey = now.toISOString().slice(0, 10);
  const weekStartKey = weekStartKeyUTC(now);
  const monthStartKey = toDateStr(monthStart(now));
  let today = 0,
    week = 0,
    month = 0;
  let charsToday = 0,
    charsWeek = 0,
    charsMonth = 0;
  for (const r of rows) {
    if (r.provider !== provider) continue;
    const usd = Number(r.cost_usd ?? 0);
    const chars = Number(r.char_count ?? 0);
    if (r.day >= monthStartKey) {
      month += usd;
      charsMonth += chars;
    }
    if (r.day >= weekStartKey) {
      week += usd;
      charsWeek += chars;
    }
    if (r.day === todayKey) {
      today += usd;
      charsToday += chars;
    }
  }
  return { today, week, month, charsToday, charsWeek, charsMonth };
}

// Flags a drift between our tracking and the provider's own number once it's
// large enough to matter — small gaps are expected (different snapshot
// times, in-flight requests), big ones point at a real bug like the
// ElevenLabs rate error fixed in 20260805_correct_elevenlabs_rate.sql.
// Unit-agnostic — used for both USD (OpenRouter) and raw character counts
// (ElevenLabs) drift comparisons.
export function computeDrift(
  appValue: number,
  liveValue: number,
): { status: "no-baseline" | "aligned" | "drifted"; diffPct: number | null } {
  if (liveValue <= 0) return { status: "no-baseline", diffPct: null };
  const diffPct = Math.abs(appValue - liveValue) / liveValue;
  return { status: diffPct < 0.05 ? "aligned" : "drifted", diffPct };
}

// --- Per-organization usage breakdown -------------------------------------
//
// usage_daily() (above) aggregates across every org, which is exactly what
// hid the fact that spend attribution between tenants wasn't visible
// anywhere on this dashboard. usage_daily_by_org() (see
// scripts/migrations/20260808_usage_daily_by_org_rpc.sql) adds
// organization_id to the same per-day/per-provider grouping; everything
// below turns those rows into "which orgs actually drove this" charts.

export type DailyOrgRow = {
  day: string;
  organization_id: string;
  provider: string;
  cost_idr: number;
  cost_usd: number;
  char_count: number;
  event_count: number;
};

export type OrgCostTotal = { costIdr: number; costUsd: number; events: number };

// Sums cost/events per organization across every day and provider in the
// row set — the basis for both "who are the top spenders" and the
// per-org daily stacked chart's top-N selection.
export function summarizeCostByOrg(rows: DailyOrgRow[]): Record<string, OrgCostTotal> {
  const totals: Record<string, OrgCostTotal> = {};
  for (const r of rows) {
    const bucket = totals[r.organization_id] ?? { costIdr: 0, costUsd: 0, events: 0 };
    bucket.costIdr += Number(r.cost_idr ?? 0);
    bucket.costUsd += Number(r.cost_usd ?? 0);
    bucket.events += Number(r.event_count ?? 0);
    totals[r.organization_id] = bucket;
  }
  return totals;
}

// Picks the N highest-spending org ids so a stacked chart stays legible
// regardless of how many tenants the platform has — everyone outside the
// top N gets folded into a single "other" bucket by pivotDailyByOrg below.
// Ties break on organization_id so the result is deterministic.
export function topOrgIdsByCost(
  totals: Record<string, OrgCostTotal>,
  n: number,
  currency: "idr" | "usd" = "idr",
): string[] {
  const key = currency === "idr" ? "costIdr" : "costUsd";
  return Object.entries(totals)
    .sort(([idA, a], [idB, b]) => b[key] - a[key] || idA.localeCompare(idB))
    .slice(0, n)
    .map(([id]) => id);
}

const OTHER_ORG_KEY = "other";

export function orgSeriesKey(orgId: string): string {
  return `org_${orgId}`;
}

// Pivots {day, organization_id, provider, cost} rows into one chart-friendly
// row per day, with one cost column per top-spending org (both IDR and USD,
// like pivotDailyByProvider) plus a single "other" column for every org
// outside topOrgIds — so a stacked bar chart can render a legible, fixed
// number of series no matter how many tenants exist. Every top org (and
// "other") gets an explicit 0 entry on days it had no usage, so recharts
// never renders a gap.
export function pivotDailyByOrg(
  rows: DailyOrgRow[],
  topOrgIds: string[],
): Array<{ day: string; label: string } & Record<string, number | string>> {
  const zeroValues = (): Record<string, number> => {
    const r: Record<string, number> = { [OTHER_ORG_KEY]: 0, [`${OTHER_ORG_KEY}Usd`]: 0 };
    for (const id of topOrgIds) {
      r[orgSeriesKey(id)] = 0;
      r[`${orgSeriesKey(id)}Usd`] = 0;
    }
    return r;
  };

  const topSet = new Set(topOrgIds);
  const byDay = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const values = byDay.get(r.day) ?? zeroValues();
    const key = topSet.has(r.organization_id) ? orgSeriesKey(r.organization_id) : OTHER_ORG_KEY;
    values[key] += Number(r.cost_idr ?? 0);
    values[`${key}Usd`] += Number(r.cost_usd ?? 0);
    byDay.set(r.day, values);
  }
  return Array.from(byDay.entries())
    .sort(([dayA], [dayB]) => dayA.localeCompare(dayB))
    .map(([day, values]) => ({
      day,
      label: new Date(day).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      ...values,
    }));
}
