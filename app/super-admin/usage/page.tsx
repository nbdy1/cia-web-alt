/**
 * app/super-admin/usage/page.tsx
 *
 * Platform usage & margin dashboard. Reads the metering tables (usage_counters,
 * ai_usage_events via the usage_breakdown() RPC), subscriptions and plans —
 * all readable by platform admins via RLS — and shows:
 *   - global KPIs (orgs, active subs, MRR, AI cost, gross margin)
 *   - a cost trend (bulan ini / 6 bulan / semua waktu, one toggle drives both
 *     the trend chart AND the purpose/provider breakdown below it)
 *   - cost split by purpose, and token/character totals per provider
 *     (OpenRouter input/output tokens, ElevenLabs characters), with an
 *     approximate USD conversion alongside the IDR figures
 *   - an always-on "sepanjang waktu" strip for reconciling total spend
 *     against externally-purchased credits (e.g. ElevenLabs)
 *   - a daily bar chart (last 30 days, per provider) of our own tracked
 *     cost, for spotting a day tracking silently broke or a spend spike
 *   - a "live check" panel that asks OpenRouter/ElevenLabs directly what
 *     they've billed (via app/actions/usage-live-check.ts) and puts it next
 *     to our own tracked totals for the same window — the two independent
 *     views this page relies on to catch tracking drift like the ElevenLabs
 *     rate bug fixed in 20260805_correct_elevenlabs_rate.sql
 *   - a per-org table (usage vs quota, cost vs revenue, margin) with a
 *     drill-down that also shows that org's own purpose/provider breakdown
 *
 * USD figures now come from cost_usd (OpenRouter's own reported per-call
 * cost when available — see resolveCost() in lib/usage/usage-tracker.ts —
 * with a derived fallback for providers that don't report one), NOT from
 * dividing cost_idr by an assumed exchange rate at display time. That
 * reverse-conversion is what let a stale ElevenLabs rate go unnoticed.
 *
 * IMPORTANT: the trend chart and the purpose/provider breakdown used to read
 * from two different places (usage_counters vs. a client-side re-sum of
 * ai_usage_events capped at .limit(10000), further silently capped by
 * PostgREST's project "Max Rows" setting with no ORDER BY) and could show
 * different totals for the same month. Both now go through the same
 * {from, to} range and the usage_breakdown() RPC (server-side GROUP BY, no
 * row cap) — see scripts/migrations/20260731_usage_breakdown_rpc.sql.
 */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatIDRShort, formatNum, formatPct, formatUSD } from "@/lib/format";
import { idrToUsd, IDR_PER_USD, ELEVENLABS_FLASH_V25_BILLED_CHAR_DIVISOR } from "@/lib/usage/rates";
import { getOpenRouterLiveUsage, getElevenLabsLiveUsage, type LiveUsageResult, type ElevenLabsLiveUsageResult } from "@/app/actions/usage-live-check";
import {
  buildOrgRow, monthStart, toDateStr, tomorrow, rangeToDates, summarizeByProvider,
  pivotDailyByProvider, weekStartKeyUTC, summarizeAppWindow, computeDrift,
  summarizeCostByOrg, topOrgIdsByCost, pivotDailyByOrg, orgSeriesKey,
  type OrgRow, type BreakdownRow, type DailyRow, type DailyOrgRow, type RangeKey,
} from "@/lib/super-admin/usage-helpers";
import {
  Loader2, Building2, TrendingUp, Wallet, Coins, Percent, X, Activity, Mic, Cpu, History, SatelliteDish, RefreshCw, AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend,
} from "recharts";

const PURPOSE_LABELS: Record<string, string> = {
  interview_step: "Interview",
  finalize: "Laporan final",
  profile_summary: "Profil santri",
  rapor: "Rapor",
  embedding: "Embedding",
  tts: "Suara (TTS)",
  whisper: "Transkripsi Suara",
};

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "month", label: "Bulan Ini" },
  { key: "6m", label: "6 Bulan" },
  { key: "all", label: "Semua Waktu" },
];

async function fetchBreakdown(from: Date, to: Date, orgId?: string): Promise<BreakdownRow[]> {
  const { data, error } = await supabase.rpc("usage_breakdown", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_org: orgId ?? null,
  });
  if (error) {
    console.error("[usage_breakdown]", error);
    return [];
  }
  return (data ?? []) as BreakdownRow[];
}

const DAILY_WINDOW_DAYS = 31; // >= max month length, so month-to-date is always fully covered

async function fetchDaily(from: Date, to: Date): Promise<DailyRow[]> {
  const { data, error } = await supabase.rpc("usage_daily", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_org: null,
  });
  if (error) {
    console.error("[usage_daily]", error);
    return [];
  }
  return (data ?? []) as DailyRow[];
}

// Same window as fetchDaily, but grouped by organization_id too (see
// scripts/migrations/20260808_usage_daily_by_org_rpc.sql) — powers the
// "per organisasi" chart below the platform-wide daily comparison.
async function fetchDailyByOrg(from: Date, to: Date): Promise<DailyOrgRow[]> {
  const { data, error } = await supabase.rpc("usage_daily_by_org", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) {
    console.error("[usage_daily_by_org]", error);
    return [];
  }
  return (data ?? []) as DailyOrgRow[];
}

const TOP_ORGS_IN_CHART = 6;
const ORG_CHART_COLORS = ["#e11d48", "#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];
const OTHER_ORG_COLOR = "#94a3b8";

export default function SuperAdminUsagePage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [range, setRange] = useState<RangeKey>("month");
  const [trend, setTrend] = useState<{ label: string; cost: number }[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(true);
  const [allTime, setAllTime] = useState<BreakdownRow[]>([]);
  const [detailOrg, setDetailOrg] = useState<OrgRow | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [dailyCurrency, setDailyCurrency] = useState<"idr" | "usd">("idr");
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyByOrg, setDailyByOrg] = useState<DailyOrgRow[]>([]);
  const [orgChartCurrency, setOrgChartCurrency] = useState<"idr" | "usd">("idr");
  const [dailyByOrgLoading, setDailyByOrgLoading] = useState(true);
  const [orLive, setOrLive] = useState<LiveUsageResult | null>(null);
  const [elLive, setElLive] = useState<ElevenLabsLiveUsageResult | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);

  // Daily breakdown (last 30 days) for the day-by-day comparison chart, plus
  // a live check against what OpenRouter/ElevenLabs themselves report — two
  // independent ways to catch tracking drift, fetched once on mount.
  useEffect(() => {
    (async () => {
      setDailyLoading(true);
      const from = new Date(Date.now() - DAILY_WINDOW_DAYS * 24 * 3600 * 1000);
      const rows = await fetchDaily(from, tomorrow());
      setDaily(rows);
      setDailyLoading(false);
    })().catch((e) => { console.error("[usage dashboard daily]", e); setDailyLoading(false); });

    (async () => {
      setDailyByOrgLoading(true);
      const from = new Date(Date.now() - DAILY_WINDOW_DAYS * 24 * 3600 * 1000);
      const rows = await fetchDailyByOrg(from, tomorrow());
      setDailyByOrg(rows);
      setDailyByOrgLoading(false);
    })().catch((e) => { console.error("[usage dashboard daily by org]", e); setDailyByOrgLoading(false); });

    (async () => {
      setLiveLoading(true);
      const [or, el] = await Promise.all([getOpenRouterLiveUsage(), getElevenLabsLiveUsage()]);
      setOrLive(or);
      setElLive(el);
      setLiveLoading(false);
    })().catch((e) => { console.error("[usage dashboard live check]", e); setLiveLoading(false); });
  }, []);

  // KPI cards + per-org table are always scoped to the current month,
  // independent of the range toggle below (which explores history).
  useEffect(() => {
    (async () => {
      setLoading(true);
      const nowMonth = toDateStr(monthStart());

      const [orgsRes, subsRes, plansRes, countersRes, allTimeRows] = await Promise.all([
        supabase.from("organizations").select("id, name").order("name"),
        supabase.from("subscriptions").select("organization_id, plan_id, status, custom_price_idr"),
        supabase.from("plans").select("id, name, price_idr, max_reports_per_period, max_voice_chars_per_period"),
        supabase.from("usage_counters").select("organization_id, reports_used, voice_chars, cost_idr").eq("period_start", nowMonth),
        fetchBreakdown(new Date(2000, 0, 1), tomorrow()),
      ]);

      const orgs = orgsRes.data ?? [];
      const subs = new Map((subsRes.data ?? []).map((s: any) => [s.organization_id, s]));
      const plans = new Map((plansRes.data ?? []).map((p: any) => [p.id, p]));
      const counters = new Map((countersRes.data ?? []).map((c: any) => [c.organization_id, c]));

      const orgRows: OrgRow[] = orgs.map((o: any) => {
        const sub: any = subs.get(o.id);
        const plan: any = sub ? plans.get(sub.plan_id) : null;
        return buildOrgRow(o, sub, plan, counters.get(o.id));
      });
      setRows(orgRows);
      setAllTime(allTimeRows);
      setLoading(false);
    })().catch((e) => { console.error("[usage dashboard]", e); setLoading(false); });
  }, []);

  // Trend chart + purpose/provider breakdown — both driven by the same
  // {from, to} range, so their totals always agree with each other.
  useEffect(() => {
    (async () => {
      setBreakdownLoading(true);
      const { from, to } = rangeToDates(range);

      const [trendRes, breakdownRows] = await Promise.all([
        range === "all"
          ? supabase.from("usage_counters").select("period_start, cost_idr")
          : supabase.from("usage_counters").select("period_start, cost_idr").gte("period_start", toDateStr(from)),
        fetchBreakdown(from, to),
      ]);

      const trendMap = new Map<string, number>();
      (trendRes.data ?? []).forEach((r: any) => {
        trendMap.set(r.period_start, (trendMap.get(r.period_start) ?? 0) + Number(r.cost_idr ?? 0));
      });
      const trendArr = Array.from(trendMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, cost]) => ({
          label: new Date(period).toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
          cost,
        }));
      setTrend(trendArr);
      setBreakdown(breakdownRows);
      setBreakdownLoading(false);
    })().catch((e) => { console.error("[usage dashboard range]", e); setBreakdownLoading(false); });
  }, [range]);

  const totals = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const active = rows.filter((r) => r.status === "active").length;
    return { revenue, cost, margin: revenue - cost, active, orgs: rows.length };
  }, [rows]);

  const byPurpose = useMemo(() => {
    const map = new Map<string, number>();
    breakdown.forEach((r) => map.set(r.purpose, (map.get(r.purpose) ?? 0) + Number(r.cost_idr ?? 0)));
    return Array.from(map.entries()).map(([purpose, cost]) => ({ purpose, cost })).sort((a, b) => b.cost - a.cost);
  }, [breakdown]);

  const byProvider = useMemo(() => summarizeByProvider(breakdown), [breakdown]);
  const allTimeByProvider = useMemo(() => summarizeByProvider(allTime), [allTime]);
  const allTimeCost = useMemo(() => allTime.reduce((s, r) => s + Number(r.cost_idr ?? 0), 0), [allTime]);
  const allTimeCostUsd = useMemo(() => allTime.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0), [allTime]);
  const breakdownTotalCost = useMemo(() => breakdown.reduce((s, r) => s + Number(r.cost_idr ?? 0), 0), [breakdown]);

  const dailyChartData = useMemo(() => pivotDailyByProvider(daily), [daily]);
  const appOpenRouterWindow = useMemo(() => summarizeAppWindow(daily, "openrouter"), [daily]);
  const appElevenLabsWindow = useMemo(() => summarizeAppWindow(daily, "elevenlabs"), [daily]);

  const orgNameById = useMemo(() => new Map(rows.map((r) => [r.id, r.name])), [rows]);
  const orgCostTotals = useMemo(() => summarizeCostByOrg(dailyByOrg), [dailyByOrg]);
  const topOrgIds = useMemo(
    () => topOrgIdsByCost(orgCostTotals, TOP_ORGS_IN_CHART, orgChartCurrency),
    [orgCostTotals, orgChartCurrency],
  );
  const orgDailyChartData = useMemo(() => pivotDailyByOrg(dailyByOrg, topOrgIds), [dailyByOrg, topOrgIds]);
  const orgChartLegend = useMemo(
    () => [
      ...topOrgIds.map((id, i) => ({
        key: orgSeriesKey(id) + (orgChartCurrency === "usd" ? "Usd" : ""),
        label: orgNameById.get(id) ?? "Organisasi terhapus",
        color: ORG_CHART_COLORS[i % ORG_CHART_COLORS.length],
      })),
      ...(Object.keys(orgCostTotals).length > topOrgIds.length
        ? [{ key: "other" + (orgChartCurrency === "usd" ? "Usd" : ""), label: "Lainnya", color: OTHER_ORG_COLOR }]
        : []),
    ],
    [topOrgIds, orgNameById, orgCostTotals, orgChartCurrency],
  );
  // Ranked "who's spending the most" bar — same window/currency as the
  // stacked daily chart above it, sorted highest cost first.
  const topOrgsRanked = useMemo(
    () =>
      Object.entries(orgCostTotals)
        .map(([id, t]) => ({
          id,
          name: orgNameById.get(id) ?? "Organisasi terhapus",
          cost: orgChartCurrency === "usd" ? t.costUsd : t.costIdr,
        }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10),
    [orgCostTotals, orgNameById, orgChartCurrency],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading usage…</span>
      </div>
    );
  }

  const monthLabel = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const rangeLabel = RANGE_OPTIONS.find((r) => r.key === range)?.label ?? "";

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Usage &amp; Billing</h2>
        <p className="text-slate-400 text-sm font-bold mt-0.5">Pantau kesehatan pemakaian, biaya, kuota, dan margin semua institusi — {monthLabel}</p>
      </div>

      <div className="bg-rose-50 border-2 border-rose-100 rounded-2xl px-4 py-3 text-xs font-bold text-rose-800 leading-relaxed">
        <span className="font-black">Cara membaca halaman ini:</span> mulai dari ringkasan bulan berjalan, lalu gunakan analitik periode untuk melihat pola biaya. Klik baris institusi untuk melihat rincian event AI.
      </div>

      <SectionHeading title="Ringkasan Bulan Berjalan" description="Status langganan, pendapatan, biaya AI, dan margin saat ini." />
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={<Building2 size={16} />} label="Organizations" value={formatNum(totals.orgs)} tone="slate" />
        <Kpi icon={<Activity size={16} />} label="Active subs" value={formatNum(totals.active)} tone="emerald" />
        <Kpi icon={<Wallet size={16} />} label="MRR (revenue)" value={formatIDR(totals.revenue)} tone="emerald" />
        <Kpi icon={<Coins size={16} />} label="AI cost (bln ini)" value={formatIDR(totals.cost)} sub={`≈ ${formatUSD(idrToUsd(totals.cost))}`} tone="amber" />
        <Kpi
          icon={<Percent size={16} />}
          label="Gross margin"
          value={formatIDR(totals.margin)}
          sub={totals.revenue > 0 ? formatPct(totals.margin / totals.revenue) : "—"}
          tone={totals.margin >= 0 ? "emerald" : "rose"}
        />
      </div>

      {/* All-time reconciliation strip — always visible regardless of the
          range toggle below, so "does the total add up to what we bought"
          questions (e.g. ElevenLabs credits) have one stable answer. */}
      <div className="bg-slate-900 rounded-[1.5rem] p-5" style={{ boxShadow: "0 4px 0 0 #0f172a" }}>
        <div className="flex items-center gap-2 mb-4 text-slate-300"><History size={15} /><h3 className="font-black text-sm text-white">Sepanjang Waktu (sejak awal tercatat)</h3></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total biaya AI</p>
            <p className="text-xl font-black text-white mt-1">{formatIDR(allTimeCost)}</p>
            <p className="text-[11px] font-bold text-slate-400">≈ {formatUSD(allTimeCostUsd)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><Cpu size={11} /> OpenRouter token</p>
            <p className="text-sm font-black text-white mt-1">{formatNum(allTimeByProvider.openrouter?.inputTokens)} in / {formatNum(allTimeByProvider.openrouter?.outputTokens)} out</p>
            <p className="text-[11px] font-bold text-slate-400">{formatIDR(allTimeByProvider.openrouter?.cost)} · ≈ {formatUSD(allTimeByProvider.openrouter?.costUsd ?? 0)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><Mic size={11} /> ElevenLabs karakter</p>
            <p className="text-sm font-black text-white mt-1">{formatNum(allTimeByProvider.elevenlabs?.chars)} karakter</p>
            <p className="text-[11px] font-bold text-slate-400">{formatIDR(allTimeByProvider.elevenlabs?.cost)} · ≈ {formatUSD(allTimeByProvider.elevenlabs?.costUsd ?? 0)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total events tercatat</p>
            <p className="text-xl font-black text-white mt-1">{formatNum(allTime.reduce((s, r) => s + Number(r.event_count ?? 0), 0))}</p>
          </div>
        </div>
        <p className="text-[11px] font-bold text-slate-500 mt-4 leading-relaxed">
          Karakter ElevenLabs di atas adalah jumlah karakter TTS yang diproses aplikasi ini, dikonversi ke IDR/USD
          memakai tarif internal dengan kurs asumsi Rp{formatNum(IDR_PER_USD)}/US$ (bukan satuan "credits" resmi
          ElevenLabs, yang bisa berbeda per model/voice) — cocokkan dengan dashboard ElevenLabs Anda untuk saldo
          credits yang sebenarnya.
        </p>
      </div>

      <SectionHeading title="Analitik Biaya" description="Bandingkan tren biaya dan fungsi AI pada periode yang sama." />
      {/* Range toggle — drives the trend chart and the breakdown panels below
          it together, so they always describe the same period. */}
      <div className="flex items-center gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setRange(opt.key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all border-2 ${
              range === opt.key
                ? "bg-rose-500 text-white border-rose-400"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title={`AI cost — ${rangeLabel}`} icon={<TrendingUp size={15} />}>
          {trend.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#94a3b8" />
                <YAxis tickFormatter={(v) => formatIDRShort(v)} tick={{ fontSize: 10 }} stroke="#94a3b8" width={60} />
                <Tooltip formatter={(v: any) => formatIDR(v)} />
                <Bar dataKey="cost" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title={`Biaya per fungsi — ${rangeLabel}`} icon={<Coins size={15} />}>
          {breakdownLoading ? (
            <div className="h-[200px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
          ) : byPurpose.length === 0 ? <Empty /> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart layout="vertical" data={byPurpose} margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                  <XAxis type="number" tickFormatter={(v) => formatIDRShort(v)} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis
                    type="category" dataKey="purpose" width={90} stroke="#94a3b8"
                    tick={{ fontSize: 11, fontWeight: 700 }}
                    tickFormatter={(p) => PURPOSE_LABELS[p] ?? p}
                  />
                  <Tooltip formatter={(v: any) => formatIDR(v)} labelFormatter={(p) => PURPOSE_LABELS[p as string] ?? p} />
                  <Bar dataKey="cost" radius={[0, 6, 6, 0]}>
                    {byPurpose.map((_, i) => <Cell key={i} fill={i === 0 ? "#f43f5e" : "#fb7185"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-right mt-1">
                Total: {formatIDR(breakdownTotalCost)}
              </p>
            </>
          )}
        </Panel>
      </div>

      {/* Token & character totals per provider — the OpenRouter side is
          token-metered, ElevenLabs is character-metered, so these are kept
          as two distinct stat blocks rather than one merged unit. */}
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title={`OpenRouter — ${rangeLabel}`} icon={<Cpu size={15} />}>
          {breakdownLoading ? (
            <div className="h-24 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Input tokens</p>
                <p className="text-lg font-black text-slate-800 mt-1">{formatNum(byProvider.openrouter?.inputTokens)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Output tokens</p>
                <p className="text-lg font-black text-slate-800 mt-1">{formatNum(byProvider.openrouter?.outputTokens)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Biaya</p>
                <p className="text-lg font-black text-amber-700 mt-1">{formatIDR(byProvider.openrouter?.cost)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">≈ USD</p>
                <p className="text-lg font-black text-slate-600 mt-1">{formatUSD(byProvider.openrouter?.costUsd ?? 0)}</p>
              </div>
            </div>
          )}
        </Panel>

        <Panel title={`ElevenLabs — ${rangeLabel}`} icon={<Mic size={15} />}>
          {breakdownLoading ? (
            <div className="h-24 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Karakter teks terkirim (TTS, mentah)</p>
                <p className="text-lg font-black text-slate-800 mt-1">{formatNum(byProvider.elevenlabs?.chars)} <span className="text-xs font-bold text-slate-400">karakter</span></p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">≈ {formatNum(Math.round((byProvider.elevenlabs?.chars ?? 0) / ELEVENLABS_FLASH_V25_BILLED_CHAR_DIVISOR))} karakter tertagih ElevenLabs (flash-v2.5 menagih 1:4 dari teks mentah)</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Biaya</p>
                <p className="text-lg font-black text-amber-700 mt-1">{formatIDR(byProvider.elevenlabs?.cost)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">≈ USD</p>
                <p className="text-lg font-black text-slate-600 mt-1">{formatUSD(byProvider.elevenlabs?.costUsd ?? 0)}</p>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Daily comparison chart — our own tracked cost per day, split by
          provider. Useful for spotting a day where tracking silently broke
          (a suspicious drop to zero) or lines up a spike with a real
          incident, ahead of reconciling against the provider's own totals
          in the live-check panel below. */}
      <SectionHeading title="Pemakaian Harian" description="Gunakan grafik ini untuk menemukan lonjakan biaya atau hari dengan pencatatan yang tidak biasa." />
      <Panel
        title={`Perbandingan Harian — ${DAILY_WINDOW_DAYS} Hari Terakhir`}
        icon={<TrendingUp size={15} />}
        headerRight={
          <div className="flex items-center rounded-xl border-2 border-slate-200 p-0.5 shrink-0">
            {(["idr", "usd"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setDailyCurrency(c)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                  dailyCurrency === c ? "bg-rose-500 text-white" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        }
      >
        {dailyLoading ? (
          <div className="h-[220px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : dailyChartData.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyChartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#94a3b8" interval="preserveStartEnd" />
              <YAxis
                tickFormatter={(v) => (dailyCurrency === "usd" ? formatUSD(v) : formatIDRShort(v))}
                tick={{ fontSize: 10 }}
                stroke="#94a3b8"
                width={dailyCurrency === "usd" ? 65 : 55}
              />
              <Tooltip
                formatter={(v: any, name: any) => [
                  dailyCurrency === "usd" ? formatUSD(v) : formatIDR(v),
                  name.startsWith("openrouter") ? "OpenRouter" : "ElevenLabs",
                ]}
                labelFormatter={(l) => l}
              />
              <Legend
                formatter={(value) => (value.startsWith("openrouter") ? "OpenRouter" : "ElevenLabs")}
                wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
              />
              <Bar dataKey={dailyCurrency === "usd" ? "openrouterUsd" : "openrouter"} name={dailyCurrency === "usd" ? "openrouterUsd" : "openrouter"} fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey={dailyCurrency === "usd" ? "elevenlabsUsd" : "elevenlabs"} name={dailyCurrency === "usd" ? "elevenlabsUsd" : "elevenlabs"} fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Per-organization breakdown — the platform-wide charts above answer
          "how much are we spending", but not "which tenant is driving it".
          A stacked daily bar (top spenders + "Lainnya" so the chart stays
          legible no matter how many orgs exist) plus a ranked list, both
          sourced from usage_daily_by_org() (see
          scripts/migrations/20260808_usage_daily_by_org_rpc.sql). */}
      <SectionHeading title="Per Institusi" description="Lihat institusi mana yang paling banyak menggunakan layanan dan cek pemakaian hariannya." />
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <Panel
            title={`Pemakaian Harian per Organisasi — ${DAILY_WINDOW_DAYS} Hari Terakhir`}
            icon={<Building2 size={15} />}
            headerRight={
              <div className="flex items-center rounded-xl border-2 border-slate-200 p-0.5 shrink-0">
                {(["idr", "usd"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setOrgChartCurrency(c)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                      orgChartCurrency === c ? "bg-rose-500 text-white" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            }
          >
            {dailyByOrgLoading ? (
              <div className="h-[220px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
            ) : orgDailyChartData.length === 0 ? <Empty /> : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={orgDailyChartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#94a3b8" interval="preserveStartEnd" />
                    <YAxis
                      tickFormatter={(v) => (orgChartCurrency === "usd" ? formatUSD(v) : formatIDRShort(v))}
                      tick={{ fontSize: 10 }}
                      stroke="#94a3b8"
                      width={orgChartCurrency === "usd" ? 65 : 55}
                    />
                    <Tooltip
                      formatter={(v: any, _name: any, item: any) => [
                        orgChartCurrency === "usd" ? formatUSD(v) : formatIDR(v),
                        orgChartLegend.find((l) => l.key === item?.dataKey)?.label ?? item?.dataKey,
                      ]}
                      labelFormatter={(l) => l}
                    />
                    {orgChartLegend.map((series) => (
                      <Bar key={series.key} dataKey={series.key} name={series.key} stackId="org" fill={series.color} radius={[0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                  {orgChartLegend.map((series) => (
                    <div key={series.key} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: series.color }} />
                      <span className="text-[10px] font-black text-slate-500 truncate max-w-[140px]">{series.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-2">
          <Panel title={`Top Organisasi — ${DAILY_WINDOW_DAYS} Hari Terakhir`} icon={<TrendingUp size={15} />}>
            {dailyByOrgLoading ? (
              <div className="h-[220px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
            ) : topOrgsRanked.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart layout="vertical" data={topOrgsRanked} margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                  <XAxis type="number" tickFormatter={(v) => (orgChartCurrency === "usd" ? formatUSD(v) : formatIDRShort(v))} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis
                    type="category" dataKey="name" width={100} stroke="#94a3b8"
                    tick={{ fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(n) => (n.length > 14 ? `${n.slice(0, 13)}…` : n)}
                  />
                  <Tooltip formatter={(v: any) => (orgChartCurrency === "usd" ? formatUSD(v) : formatIDR(v))} labelFormatter={(n) => n} />
                  <Bar dataKey="cost" radius={[0, 6, 6, 0]}>
                    {topOrgsRanked.map((_, i) => <Cell key={i} fill={ORG_CHART_COLORS[i % ORG_CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>
      </div>

      {/* Live check — asks OpenRouter/ElevenLabs directly what they've
          billed, and puts it next to what our own tracking recorded for the
          same window. A gap here means a real tracking bug, not just an
          approximation — this is the fastest way to catch the next one. */}
      <SectionHeading title="Verifikasi Provider" description="Bandingkan pencatatan internal aplikasi dengan angka langsung dari provider." />
      <div className="bg-white rounded-[1.5rem] border-2 border-slate-100 p-5" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
        <div className="flex items-center gap-2 mb-4 text-slate-600">
          <SatelliteDish size={15} className="text-rose-500" />
          <h3 className="font-black text-sm text-slate-800">Live Check — Dibanding Dashboard Provider</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <LiveCheckCard
            title="OpenRouter"
            icon={<Cpu size={14} />}
            loading={liveLoading}
            live={orLive}
            appWindow={appOpenRouterWindow}
          />
          <ElevenLabsLiveCheckCard
            loading={liveLoading}
            live={elLive}
            appWindow={{
              // Our char_count is raw text.length; ElevenLabs' live numbers are
              // billed characters (flash-v2.5 bills 1 per 4 raw chars — see
              // ELEVENLABS_FLASH_V25_BILLED_CHAR_DIVISOR). Convert so this is an
              // apples-to-apples comparison instead of a permanent ~4x "drift".
              charsToday: appElevenLabsWindow.charsToday / ELEVENLABS_FLASH_V25_BILLED_CHAR_DIVISOR,
              charsWeek: appElevenLabsWindow.charsWeek / ELEVENLABS_FLASH_V25_BILLED_CHAR_DIVISOR,
              charsMonth: appElevenLabsWindow.charsMonth / ELEVENLABS_FLASH_V25_BILLED_CHAR_DIVISOR,
            }}
          />
        </div>
      </div>

      {/* Per-org table */}
      <SectionHeading title="Detail Kuota Institusi" description="Klik satu baris untuk melihat 50 event AI terbaru dan rincian biaya sepanjang waktu." />
      <div className="bg-white rounded-[1.5rem] border-2 border-slate-100 overflow-hidden" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
        <div className="px-5 py-3 border-b-2 border-slate-50">
          <h3 className="font-black text-slate-800 text-sm">Kuota &amp; margin per institusi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">
                <th className="px-4 py-2">Institusi</th>
                <th className="px-4 py-2">Paket</th>
                <th className="px-4 py-2">Laporan</th>
                <th className="px-4 py-2">Suara</th>
                <th className="px-4 py-2 text-right">Biaya</th>
                <th className="px-4 py-2 text-right">Pendapatan</th>
                <th className="px-4 py-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50">
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-300 font-black text-xs">No organizations</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setDetailOrg(r)}>
                  <td className="px-4 py-3">
                    <p className="font-black text-slate-800">{r.name}</p>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-600">{r.plan}</td>
                  <td className="px-4 py-3 w-40"><QuotaBar used={r.reportsUsed} limit={r.reportsLimit} /></td>
                  <td className="px-4 py-3 w-40"><QuotaBar used={r.voiceUsed} limit={r.voiceLimit} unit="chars" /></td>
                  <td className="px-4 py-3 text-right font-bold text-amber-700 whitespace-nowrap">{formatIDR(r.cost)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700 whitespace-nowrap">{formatIDR(r.revenue)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className={`font-black ${r.margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatIDR(r.margin)}</span>
                    <span className="text-[10px] font-black text-slate-400 ml-1">{r.marginPct == null ? "" : formatPct(r.marginPct)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailOrg && <OrgDetailModal org={detailOrg} onClose={() => setDetailOrg(null)} />}
    </div>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: "slate" | "emerald" | "amber" | "rose" }) {
  const toneMap = {
    slate: "text-slate-600 bg-slate-100",
    emerald: "text-emerald-600 bg-emerald-100",
    amber: "text-amber-600 bg-amber-100",
    rose: "text-rose-600 bg-rose-100",
  }[tone];
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-4" style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${toneMap}`}>{icon}</div>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-lg font-black text-slate-800 leading-tight">{value}</p>
      {sub && <p className="text-[11px] font-black text-slate-400">{sub}</p>}
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="pt-2">
      <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{title}</h3>
      <p className="text-xs font-bold text-slate-400 mt-1">{description}</p>
    </div>
  );
}

function Panel({ title, icon, headerRight, children }: { title: string; icon: React.ReactNode; headerRight?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-4" style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-slate-600"><span className="text-rose-500">{icon}</span><h3 className="font-black text-sm text-slate-800">{title}</h3></div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="h-[200px] flex items-center justify-center text-slate-300 font-black text-xs">Belum ada data</div>;
}

// Turns a computeDrift() verdict (see lib/super-admin/usage-helpers.ts) into
// a badge — small gaps are expected (different snapshot times, in-flight
// requests), big ones point at a real bug like the ElevenLabs rate error
// fixed in 20260805_correct_elevenlabs_rate.sql. Unit-agnostic — used for
// both USD (OpenRouter) and raw character counts (ElevenLabs).
function driftBadge(appValue: number, liveValue: number) {
  const drift = computeDrift(appValue, liveValue);
  if (drift.status === "no-baseline") return null;
  if (drift.status === "aligned") {
    return <span className="text-[10px] font-black text-emerald-600">✓ selaras</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600">
      <AlertTriangle size={10} /> beda {formatPct(drift.diffPct!)}
    </span>
  );
}

function LiveCheckCard({
  title,
  icon,
  loading,
  live,
  appWindow,
}: {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  live: LiveUsageResult | null;
  appWindow: { today: number; week: number; month: number };
}) {
  return (
    <div className="rounded-2xl border-2 border-slate-100 p-4">
      <div className="flex items-center gap-2 mb-3 text-slate-600">{icon}<h4 className="font-black text-xs uppercase tracking-wider">{title}</h4></div>
      {loading ? (
        <div className="h-20 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : !live || !live.ok ? (
        <p className="text-[11px] font-bold text-slate-400 flex items-start gap-1.5"><AlertTriangle size={12} className="shrink-0 mt-0.5" /> Tidak tersedia{!live ? "" : `: ${live.error}`}</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Hari ini</p>
            <p className="text-sm font-black text-slate-800 mt-1">{formatUSD(live.usageDaily)}</p>
            <p className="text-[10px] font-bold text-slate-400">app: {formatUSD(appWindow.today)}</p>
            {driftBadge(appWindow.today, live.usageDaily)}
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Minggu ini</p>
            <p className="text-sm font-black text-slate-800 mt-1">{formatUSD(live.usageWeekly)}</p>
            <p className="text-[10px] font-bold text-slate-400">app: {formatUSD(appWindow.week)}</p>
            {driftBadge(appWindow.week, live.usageWeekly)}
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Bulan ini</p>
            <p className="text-sm font-black text-slate-800 mt-1">{formatUSD(live.usageMonthly)}</p>
            <p className="text-[10px] font-bold text-slate-400">app: {formatUSD(appWindow.month)}</p>
            {driftBadge(appWindow.month, live.usageMonthly)}
          </div>
        </div>
      )}
    </div>
  );
}

function ElevenLabsLiveCheckCard({
  loading,
  live,
  appWindow,
}: {
  loading: boolean;
  live: ElevenLabsLiveUsageResult | null;
  appWindow: { charsToday: number; charsWeek: number; charsMonth: number };
}) {
  return (
    <div className="rounded-2xl border-2 border-slate-100 p-4">
      <div className="flex items-center gap-2 mb-3 text-slate-600"><Mic size={14} /><h4 className="font-black text-xs uppercase tracking-wider">ElevenLabs</h4></div>
      {loading ? (
        <div className="h-20 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : !live || !live.ok ? (
        <div className="text-[11px] font-bold text-slate-400 leading-relaxed">
          <p className="flex items-start gap-1.5"><AlertTriangle size={12} className="shrink-0 mt-0.5" /> Tidak tersedia{!live ? "" : `: ${live.error}`}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Hari ini</p>
              <p className="text-sm font-black text-slate-800 mt-1">{formatNum(live.charsDaily)} <span className="text-[10px] font-bold text-slate-400">karakter</span></p>
              <p className="text-[10px] font-bold text-slate-400">app: {formatNum(Math.round(appWindow.charsToday))} karakter</p>
              {driftBadge(appWindow.charsToday, live.charsDaily)}
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Minggu ini</p>
              <p className="text-sm font-black text-slate-800 mt-1">{formatNum(live.charsWeekly)} <span className="text-[10px] font-bold text-slate-400">karakter</span></p>
              <p className="text-[10px] font-bold text-slate-400">app: {formatNum(Math.round(appWindow.charsWeek))} karakter</p>
              {driftBadge(appWindow.charsWeek, live.charsWeekly)}
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Bulan ini</p>
              <p className="text-sm font-black text-slate-800 mt-1">{formatNum(live.charsMonthly)} <span className="text-[10px] font-bold text-slate-400">karakter</span></p>
              <p className="text-[10px] font-bold text-slate-400">app: {formatNum(Math.round(appWindow.charsMonth))} karakter</p>
              {driftBadge(appWindow.charsMonth, live.charsMonthly)}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">Karakter tertagih dari ElevenLabs (/v1/usage/character-stats). Model flash-v2.5 menagih 1 karakter per 4 karakter teks mentah, jadi angka "app" di atas sudah dibagi 4 dari teks yang benar-benar dikirim supaya bisa dibandingkan apples-to-apples dengan angka ElevenLabs.</p>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    trialing: "bg-sky-100 text-sky-700",
    past_due: "bg-amber-100 text-amber-700",
    suspended: "bg-rose-100 text-rose-700",
    canceled: "bg-slate-200 text-slate-500",
    none: "bg-slate-100 text-slate-400",
  };
  return <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${map[status] ?? map.none}`}>{status}</span>;
}

function QuotaBar({ used, limit, unit }: { used: number; limit: number | null; unit?: string }) {
  if (limit == null) return <span className="text-[11px] font-bold text-slate-500">{formatNum(used)} <span className="text-slate-300">/ ∞</span></span>;
  const pct = limit > 0 ? Math.min(1, used / limit) : 0;
  const over = used >= limit;
  return (
    <div>
      <div className="flex justify-between text-[10px] font-black mb-1">
        <span className="text-slate-500">{formatNum(used)}{unit ? "" : ""}</span>
        <span className="text-slate-300">/ {formatNum(limit)}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${over ? "bg-rose-500" : pct > 0.8 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function OrgDetailModal({ org, onClose }: { org: OrgRow; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [orgAllTime, setOrgAllTime] = useState<BreakdownRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [eventsRes, breakdownRows] = await Promise.all([
        supabase
          .from("ai_usage_events")
          .select("created_at, purpose, model, input_tokens, output_tokens, char_count, cost_idr, status")
          .eq("organization_id", org.id)
          .order("created_at", { ascending: false })
          .limit(50),
        fetchBreakdown(new Date(2000, 0, 1), tomorrow(), org.id),
      ]);
      setEvents(eventsRes.data ?? []);
      setOrgAllTime(breakdownRows);
      setLoading(false);
    })();
  }, [org.id]);

  const orgAllTimeCost = orgAllTime.reduce((s, r) => s + Number(r.cost_idr ?? 0), 0);
  const orgAllTimeCostUsd = orgAllTime.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const orgAllTimeByProvider = summarizeByProvider(orgAllTime);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-2xl relative max-h-[85vh] flex flex-col" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
        <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"><X size={16} /></button>
        <div className="mb-4">
          <h3 className="text-xl font-black text-slate-800">{org.name}</h3>
          <p className="text-slate-400 text-sm font-bold mt-0.5">{org.plan} · cost bulan ini {formatIDR(org.cost)} · margin {formatIDR(org.margin)} {org.marginPct == null ? "" : `(${formatPct(org.marginPct)})`}</p>
        </div>

        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-5 shrink-0">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total sepanjang waktu</p>
              <p className="text-sm font-black text-slate-800 mt-1">{formatIDR(orgAllTimeCost)}</p>
              <p className="text-[10px] font-bold text-slate-400">≈ {formatUSD(orgAllTimeCostUsd)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">OpenRouter token</p>
              <p className="text-sm font-black text-slate-800 mt-1">{formatNum(orgAllTimeByProvider.openrouter?.inputTokens)} in</p>
              <p className="text-[10px] font-bold text-slate-400">{formatNum(orgAllTimeByProvider.openrouter?.outputTokens)} out</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">ElevenLabs karakter</p>
              <p className="text-sm font-black text-slate-800 mt-1">{formatNum(orgAllTimeByProvider.elevenlabs?.chars)}</p>
            </div>
          </div>
        )}

        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">50 event AI terbaru</p>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : events.length === 0 ? (
          <div className="py-10 text-center text-slate-300 font-black text-xs">No events yet</div>
        ) : (
          <div className="overflow-y-auto -mx-2 px-2">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-[9px] font-black uppercase tracking-wider text-slate-400 text-left">
                  <th className="py-1.5">When</th><th className="py-1.5">Purpose</th>
                  <th className="py-1.5 text-right">In</th><th className="py-1.5 text-right">Out</th>
                  <th className="py-1.5 text-right">Chars</th><th className="py-1.5 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {events.map((e, i) => (
                  <tr key={i}>
                    <td className="py-1.5 text-slate-500 font-bold whitespace-nowrap">{new Date(e.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-1.5 font-black text-slate-700">{PURPOSE_LABELS[e.purpose] ?? e.purpose}</td>
                    <td className="py-1.5 text-right text-slate-500">{formatNum(e.input_tokens)}</td>
                    <td className="py-1.5 text-right text-slate-500">{formatNum(e.output_tokens)}</td>
                    <td className="py-1.5 text-right text-slate-500">{formatNum(e.char_count)}</td>
                    <td className="py-1.5 text-right font-bold text-amber-700 whitespace-nowrap">{formatIDR(e.cost_idr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
