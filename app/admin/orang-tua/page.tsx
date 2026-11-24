/**
 * app/admin/orang-tua/page.tsx
 *
 * Admin view of the parent dashboard: each student's pairing code (to hand to
 * the parents), how many parent accounts are paired, and the parent-facing
 * updates, which an admin can hide. Codes can be rotated if one leaks.
 */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, RefreshCw, Search, KeyRound, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/context/auth-context";
import { useTerminology } from "@/lib/hooks/use-terminology";
import { rotateParentCode } from "@/app/actions/parent-updates";
import { regenerateDrafts, setStudentClass } from "@/app/actions/parent-review";

type Row = { id: string; name: string; nis: string | null; parent_code: string | null; class_name: string | null };
type Counts = { published: number; waiting: number };
type LogRow = { id: string; section: string; created_at: string; parent_id: string; student_id: string | null };

export default function ParentCodesPage() {
  const { activeOrganizationId } = useAuth();
  const t = useTerminology();
  const [students, setStudents] = useState<Row[]>([]);
  const [linkCounts, setLinkCounts] = useState<Record<string, number>>({});
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [log, setLog] = useState<LogRow[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    const [studentsRes, linksRes, contentsRes, logRes] = await Promise.all([
      supabase.from("students").select("id, name, nis, parent_code, class_name").eq("organization_id", activeOrganizationId).or("is_removed.is.null,is_removed.eq.false").order("name"),
      supabase.from("parent_student_links").select("student_id").eq("organization_id", activeOrganizationId),
      supabase.from("parent_contents").select("student_id, status").eq("organization_id", activeOrganizationId).in("status", ["pending", "held", "published"]),
      supabase.from("parent_access_log").select("id, section, created_at, parent_id, student_id").eq("organization_id", activeOrganizationId).order("created_at", { ascending: false }).limit(50),
    ]);
    setStudents((studentsRes.data ?? []) as Row[]);
    const linkTotals: Record<string, number> = {};
    (linksRes.data ?? []).forEach((l: any) => { linkTotals[l.student_id] = (linkTotals[l.student_id] ?? 0) + 1; });
    setLinkCounts(linkTotals);
    const c: Record<string, Counts> = {};
    (contentsRes.data ?? []).forEach((r: any) => {
      c[r.student_id] ??= { published: 0, waiting: 0 };
      if (r.status === "published") c[r.student_id].published += 1; else c[r.student_id].waiting += 1;
    });
    setCounts(c);
    setLog((logRes.data ?? []) as LogRow[]);
    if (studentsRes.error) setNotice(studentsRes.error.message);
    setLoading(false);
  }, [activeOrganizationId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? students.filter((s) => s.name.toLowerCase().includes(q) || (s.nis ?? "").toLowerCase().includes(q)) : students;
  }, [students, query]);

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const run = async (key: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    setBusy(key);
    setNotice(null);
    const result = await fn();
    if (!result.success) setNotice(result.error ?? "Gagal.");
    await load();
    setBusy(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Kode Orang Tua</h1>
        <p className="text-sm text-slate-500 mt-1">
          Berikan kode setiap {t.santriLower} kepada orang tuanya. Orang tua mendaftar di{" "}
          <span className="font-mono font-bold text-slate-700">/parent/signup</span> dengan kode ini dan hanya melihat <b>ringkasan</b>, bukan transkrip observasi.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Cari ${t.santriLower}...`}
          className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold focus:outline-none focus:border-brand-400"
        />
      </div>

      {notice && <p className="text-xs font-bold text-rose-600 bg-rose-50 border-2 border-rose-100 rounded-2xl p-3">{notice}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand-600" /></div>
      ) : (
        <div className="bg-white border-2 border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {filtered.length === 0 && <p className="p-6 text-sm text-slate-500 text-center">Tidak ada data.</p>}
          {filtered.map((s) => {
                        const links = linkCounts[s.id] ?? 0;
            return (
              <div key={s.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 truncate">{s.name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    {s.nis ? `NIS ${s.nis} · ` : ""}
                    <UserPlus size={12} /> {links} akun terhubung
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {(counts[s.id]?.published ?? 0)} terkirim · <span className={(counts[s.id]?.waiting ?? 0) > 0 ? "font-bold text-amber-600" : ""}>{counts[s.id]?.waiting ?? 0} menunggu musyrif</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {s.parent_code ? (
                    <button
                      onClick={() => copy(s.parent_code!)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-200 font-mono font-bold tracking-widest text-sm text-slate-800"
                      title="Salin kode"
                    >
                      <KeyRound size={14} className="text-slate-400" />
                      {s.parent_code}
                      {copied === s.parent_code ? <Check size={14} className="text-brand-600" /> : <Copy size={14} className="text-slate-400" />}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-bold">Kode belum dibuat (jalankan migrasi)</span>
                  )}
                  <button
                    disabled={busy === `rot-${s.id}`}
                    onClick={() => confirm(`Buat kode baru untuk ${s.name}? Kode lama tidak bisa dipakai lagi untuk mendaftar. Akun yang sudah terhubung tetap terhubung.`) && run(`rot-${s.id}`, () => rotateParentCode(s.id))}
                    className="p-2 rounded-xl border-2 border-slate-200 text-slate-500 hover:bg-slate-50"
                    title="Buat kode baru"
                  >
                    {busy === `rot-${s.id}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </button>
                  <input
                    defaultValue={s.class_name ?? ""}
                    placeholder="Kelas"
                    onBlur={(e) => e.target.value.trim() !== (s.class_name ?? "") && run(`cls-${s.id}`, () => setStudentClass(s.id, e.target.value))}
                    className="w-20 border-2 border-slate-200 rounded-xl px-2 py-2 text-xs font-bold"
                  />
                  <button
                    disabled={busy === `gen-${s.id}`}
                    onClick={() => run(`gen-${s.id}`, () => regenerateDrafts(s.id))}
                    className="px-3 py-2 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    title="Buat draf baru dari laporan terakhir (masuk antrean musyrif)"
                  >
                    {busy === `gen-${s.id}` ? <Loader2 size={14} className="animate-spin" /> : "Buat ulang draf"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="bg-white border-2 border-slate-100 rounded-2xl p-4">
        <button onClick={() => setShowLog((v) => !v)} className="text-sm font-bold text-slate-700">
          Log akses orang tua {showLog ? "▲" : "▼"}
        </button>
        {showLog && (
          <div className="mt-3 divide-y divide-slate-50 text-xs">
            {log.length === 0 && <p className="text-slate-500">Belum ada akses.</p>}
            {log.map((l) => (
              <p key={l.id} className="py-1.5 text-slate-600">
                {new Date(l.created_at).toLocaleString("id-ID")} · {students.find((x) => x.id === l.student_id)?.name ?? "—"} · {l.section}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
