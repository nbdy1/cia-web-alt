/**
 * app/super-admin/usage/page.tsx
 *
 * Platform usage & margin dashboard. Reads the metering tables (usage_counters,
 * ai_usage_events), subscriptions and plans — all readable by platform admins
 * via RLS — and shows, for the current calendar month:
 *   - global KPIs (orgs, active subs, MRR, AI cost, gross margin)
 *   - a 6-month cost trend
 *   - cost split by purpose
 *   - a per-org table (usage vs quota, cost vs revenue, margin) with a drill-down
 */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatIDRShort, formatNum, formatPct } from "@/lib/format";
import {
  Loader2, Building2, TrendingUp, Wallet, Coins, Percent, X, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";

const PURPOSE_LABELS: Record<string, string> = {
  interview_step: "Interview",
  finalize: "Laporan final",
  profile_summary: "Profil santri",
  rapor: "Rapor",
  embedding: "Embedding",
  tts: "Suara (TTS)",
};

type OrgRow = {
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

function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function SuperAdminUsagePage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [trend, setTrend] = useState<{ label: string; cost: number }[]>([]);
  const [byPurpose, setByPurpose] = useState<{ purpose: string; cost: number }[]>([]);
  const [detailOrg, setDetailOrg] = useState<OrgRow | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const nowMonth = toDateStr(monthStart());
      const sixAgo = toDateStr(monthStart(new Date(new Date().setMonth(new Date().getMonth() - 5))));
      const monthStartISO = monthStart().toISOString();

      const [orgsRes, subsRes, plansRes, countersRes, trendRes, eventsRes] = await Promise.all([
        supabase.from("organizations").select("id, name").order("name"),
        supabase.from("subscriptions").select("organization_id, plan_id, status, custom_price_idr"),
        supabase.from("plans").select("id, name, price_idr, max_reports_per_period, max_voice_chars_per_period"),
        supabase.from("usage_counters").select("organization_id, reports_used, voice_chars, cost_idr").eq("period_start", nowMonth),
        supabase.from("usage_counters").select("period_start, cost_idr").gte("period_start", sixAgo),
        supabase.from("ai_usage_events").select("purpose, cost_idr").gte("created_at", monthStartISO).limit(10000),
      ]);

      const orgs = orgsRes.data ?? [];
      const subs = new Map((subsRes.data ?? []).map((s: any) => [s.organization_id, s]));
      const plans = new Map((plansRes.data ?? []).map((p: any) => [p.id, p]));
      const counters = new Map((countersRes.data ?? []).map((c: any) => [c.organization_id, c]));

      const orgRows: OrgRow[] = orgs.map((o: any) => {
        const sub: any = subs.get(o.id);
        const plan: any = sub ? plans.get(sub.plan_id) : null;
        const counter: any = counters.get(o.id);
        const status = sub?.status ?? "none";
        const isPaying = status === "active";
        const revenue = isPaying ? (sub?.custom_price_idr ?? plan?.price_idr ?? 0) : 0;
        const cost = Number(counter?.cost_idr ?? 0);
        const margin = revenue - cost;
        return {
          id: o.id,
          name: o.name,
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
      });
      setRows(orgRows);

      // 6-month cost trend
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

      // cost by purpose (this month)
      const purposeMap = new Map<string, number>();
      (eventsRes.data ?? []).forEach((e: any) => {
        purposeMap.set(e.purpose, (purposeMap.get(e.purpose) ?? 0) + Number(e.cost_idr ?? 0));
      });
      setByPurpose(
        Array.from(purposeMap.entries())
          .map(([purpose, cost]) => ({ purpose, cost }))
          .sort((a, b) => b.cost - a.cost),
      );

      setLoading(false);
    })().catch((e) => { console.error("[usage dashboard]", e); setLoading(false); });
  }, []);

  const totals = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const active = rows.filter((r) => r.status === "active").length;
    return { revenue, cost, margin: revenue - cost, active, orgs: rows.length };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading usage…</span>
      </div>
    );
  }

  const monthLabel = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Usage &amp; Billing</h2>
        <p className="text-slate-400 text-sm font-bold mt-0.5">AI cost, revenue and margin across all tenants — {monthLabel}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={<Building2 size={16} />} label="Organizations" value={formatNum(totals.orgs)} tone="slate" />
        <Kpi icon={<Activity size={16} />} label="Active subs" value={formatNum(totals.active)} tone="emerald" />
        <Kpi icon={<Wallet size={16} />} label="MRR (revenue)" value={formatIDR(totals.revenue)} tone="emerald" />
        <Kpi icon={<Coins size={16} />} label="AI cost (bln ini)" value={formatIDR(totals.cost)} tone="amber" />
        <Kpi
          icon={<Percent size={16} />}
          label="Gross margin"
          value={formatIDR(totals.margin)}
          sub={totals.revenue > 0 ? formatPct(totals.margin / totals.revenue) : "—"}
          tone={totals.margin >= 0 ? "emerald" : "rose"}
        />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="AI cost — 6 bulan terakhir" icon={<TrendingUp size={15} />}>
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

        <Panel title="Biaya per fungsi (bln ini)" icon={<Coins size={15} />}>
          {byPurpose.length === 0 ? <Empty /> : (
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
          )}
        </Panel>
      </div>

      {/* Per-org table */}
      <div className="bg-white rounded-[1.5rem] border-2 border-slate-100 overflow-hidden" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
        <div className="px-5 py-3 border-b-2 border-slate-50">
          <h3 className="font-black text-slate-800 text-sm">Per organization</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">
                <th className="px-4 py-2">Organization</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Reports</th>
                <th className="px-4 py-2">Voice</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-right">Revenue</th>
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

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-4" style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}>
      <div className="flex items-center gap-2 mb-3 text-slate-600"><span className="text-rose-500">{icon}</span><h3 className="font-black text-sm text-slate-800">{title}</h3></div>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="h-[200px] flex items-center justify-center text-slate-300 font-black text-xs">Belum ada data</div>;
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ai_usage_events")
        .select("created_at, purpose, model, input_tokens, output_tokens, char_count, cost_idr, status")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setEvents(data ?? []);
      setLoading(false);
    })();
  }, [org.id]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-2xl relative max-h-[85vh] flex flex-col" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
        <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"><X size={16} /></button>
        <div className="mb-4">
          <h3 className="text-xl font-black text-slate-800">{org.name}</h3>
          <p className="text-slate-400 text-sm font-bold mt-0.5">{org.plan} · cost {formatIDR(org.cost)} · margin {formatIDR(org.margin)} {org.marginPct == null ? "" : `(${formatPct(org.marginPct)})`}</p>
        </div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Recent AI events</p>
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
