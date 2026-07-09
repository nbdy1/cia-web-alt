/**
 * app/students/[id]/scores/page.tsx
 *
 * Manual score input page for ustadz.
 * Displays a table matching the rapor format from the image:
 *
 *   Rows (score_type): Hafalan, Muhadharah, FR, AR, 3PFB
 *   Columns          : Nilai Harian, Nilai Bulanan, Nilai Akhir
 *   Grouped by       : subject (QCB, QMB, QSB)
 *
 * Ustadz selects a period (semester) then fills in the cells.
 * The whole form is saved in one shot via saveStudentScores().
 *
 * A "Tambah Periode" button lets them create a new semester entry.
 */
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { saveStudentScores, getStudentScores, getStudentPeriods } from "@/app/actions/scores";
import { getCurrentAccessToken } from "@/lib/supabase-auth";
import {
  ChevronLeft,
  Plus,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECTS = ["QCB", "QMB", "QSB"] as const;

// Each row label + which column(s) it uses
const SCORE_TYPES = [
  { key: "Hafalan",     label: "Hafalan",                      col: "harian" },
  { key: "Muhadharah", label: "Muhadharah",                   col: "harian" },
  { key: "FR",         label: "Fast Respon (FR)",              col: "bulanan" },
  { key: "AR",         label: "Analitic Retrieval (AR)",       col: "bulanan" },
  { key: "3PFB",       label: "3 Pasang Fungsi Bahasa (3PFB)", col: "akhir" },
] as const;

type ColKey = "harian" | "bulanan" | "akhir";
type ScoreKey = `${typeof SUBJECTS[number]}.${typeof SCORE_TYPES[number]["key"]}.${ColKey}`;

type ScoreMap = Record<string, string>; // key → raw string input

function buildKey(subject: string, type: string, col: ColKey): string {
  return `${subject}.${type}.${col}`;
}

function parseScore(v: string): number | null {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScoresPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const [studentName, setStudentName] = useState("");
  const [periods, setPeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [newPeriodInput, setNewPeriodInput] = useState("");
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [scores, setScores] = useState<ScoreMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  // ── Fetch student name ──────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("students")
      .select("name")
      .eq("id", studentId)
      .single()
      .then(({ data }) => setStudentName(data?.name ?? ""));
  }, [studentId]);

  // ── Fetch periods ───────────────────────────────────────────────────────
  const refreshPeriods = useCallback(async () => {
    const accessToken = await getCurrentAccessToken();
    const p = await getStudentPeriods(studentId, accessToken);
    setPeriods(p);
    if (p.length > 0 && !selectedPeriod) setSelectedPeriod(p[0]);
    setLoading(false);
  }, [studentId, selectedPeriod]);

  useEffect(() => { refreshPeriods(); }, []);

  // ── Load scores for selected period ────────────────────────────────────
  useEffect(() => {
    if (!selectedPeriod) return;
    setLoading(true);
    getCurrentAccessToken().then((accessToken) => getStudentScores(studentId, selectedPeriod, accessToken)).then((rows) => {
      const map: ScoreMap = {};
      rows.forEach((r) => {
        const colKey = (
          r.nilai_harian != null ? "harian"
          : r.nilai_bulanan != null ? "bulanan"
          : r.nilai_akhir != null ? "akhir"
          : null
        );
        // Populate all three columns from DB
        if (r.nilai_harian != null) map[buildKey(r.subject, r.score_type, "harian")] = String(r.nilai_harian);
        if (r.nilai_bulanan != null) map[buildKey(r.subject, r.score_type, "bulanan")] = String(r.nilai_bulanan);
        if (r.nilai_akhir != null) map[buildKey(r.subject, r.score_type, "akhir")] = String(r.nilai_akhir);
      });
      setScores(map);
      setLoading(false);
      setSaveStatus("idle");
    });
  }, [studentId, selectedPeriod]);

  const handleCell = (key: string, value: string) => {
    setScores((prev) => ({ ...prev, [key]: value }));
    setSaveStatus("idle");
  };

  const handleSave = async () => {
    if (!selectedPeriod) return;
    setSaving(true);
    setSaveStatus("idle");

    // Build row list — one row per (subject, score_type), all 3 cols
    const rowMap: Record<string, {
      subject: string; score_type: string;
      nilai_harian: number | null; nilai_bulanan: number | null; nilai_akhir: number | null;
    }> = {};

    SUBJECTS.forEach((subj) => {
      SCORE_TYPES.forEach(({ key: type }) => {
        const rowKey = `${subj}.${type}`;
        rowMap[rowKey] = {
          subject: subj,
          score_type: type,
          nilai_harian: parseScore(scores[buildKey(subj, type, "harian")] ?? ""),
          nilai_bulanan: parseScore(scores[buildKey(subj, type, "bulanan")] ?? ""),
          nilai_akhir: parseScore(scores[buildKey(subj, type, "akhir")] ?? ""),
        };
      });
    });

    const accessToken = await getCurrentAccessToken();
    const result = await saveStudentScores(studentId, selectedPeriod, Object.values(rowMap), accessToken);
    setSaving(false);
    if (result.success) {
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } else {
      setSaveStatus("error");
      setSaveError(result.error ?? "Gagal menyimpan nilai.");
    }
  };

  const handleAddPeriod = () => {
    const p = newPeriodInput.trim();
    if (!p) return;
    setPeriods((prev) => [p, ...prev.filter((x) => x !== p)]);
    setSelectedPeriod(p);
    setScores({});
    setNewPeriodInput("");
    setShowNewPeriod(false);
  };

  // ── Input style helpers ─────────────────────────────────────────────────
  const cellCls = (active: boolean) =>
    `w-full text-center text-sm font-bold py-2 px-1 rounded-xl border-2 focus:outline-none transition-colors ${
      active
        ? "bg-white border-slate-200 focus:border-emerald-400 text-slate-800"
        : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
    }`;

  // Which column is active for each score_type
  const activeCol: Record<string, ColKey> = {
    Hafalan:    "harian",
    Muhadharah: "harian",
    FR:         "bulanan",
    AR:         "bulanan",
    "3PFB":     "akhir",
  };

  if (loading && !selectedPeriod && periods.length === 0) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-28 font-sans">
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-100 px-5 pt-10 pb-4 flex items-center gap-4 sticky top-0 z-40" style={{ boxShadow: "0 3px 0 0 #f1f5f9" }}>
        <Link
          href={`/students/${studentId}`}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 flex-shrink-0"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Input Nilai CMS</p>
          <h1 className="text-sm font-black text-slate-900">{studentName}</h1>
        </div>
        <div className="ml-auto">
          <div className="w-9 h-9 bg-sky-100 rounded-xl flex items-center justify-center" style={{ boxShadow: "0 3px 0 0 #bae6fd" }}>
            <ClipboardList size={18} className="text-sky-600" />
          </div>
        </div>
      </header>

      <main className="px-4 py-6 space-y-5 max-w-2xl mx-auto">

        {/* Period selector */}
        <section className="bg-white rounded-[2rem] border-2 border-slate-100 p-5 space-y-3" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Periode / Semester</p>
          {periods.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {periods.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-4 py-2 rounded-xl font-black text-sm transition-colors ${
                    selectedPeriod === p
                      ? "bg-sky-500 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                  style={selectedPeriod === p ? { boxShadow: "0 3px 0 0 #0284c7" } : {}}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 font-bold">Belum ada periode. Tambahkan periode baru di bawah.</p>
          )}

          {showNewPeriod ? (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newPeriodInput}
                onChange={(e) => setNewPeriodInput(e.target.value)}
                placeholder="mis. Semester 1 2024/2025"
                className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-sky-400 transition-colors"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddPeriod(); }}
                autoFocus
              />
              <button
                onClick={handleAddPeriod}
                disabled={!newPeriodInput.trim()}
                className="bg-sky-500 text-white px-4 py-2 rounded-xl font-black text-sm disabled:opacity-50"
                style={{ boxShadow: "0 3px 0 0 #0284c7" }}
              >
                OK
              </button>
              <button
                onClick={() => { setShowNewPeriod(false); setNewPeriodInput(""); }}
                className="bg-slate-100 text-slate-500 px-4 py-2 rounded-xl font-black text-sm hover:bg-slate-200"
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewPeriod(true)}
              className="flex items-center gap-2 text-sky-600 font-black text-sm hover:text-sky-700"
            >
              <Plus size={14} /> Tambah Periode Baru
            </button>
          )}
        </section>

        {/* Score tables — one per subject */}
        {selectedPeriod && !loading && SUBJECTS.map((subject) => (
          <section key={subject} className="bg-white rounded-[2rem] border-2 border-slate-100 overflow-hidden" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
            {/* Subject header */}
            <div className="px-5 py-4 bg-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <span className="text-white font-black text-sm">{subject}</span>
              </div>
              <h2 className="text-white font-black text-base">{subject}</h2>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 px-4 py-2 border-b-2 border-slate-100 bg-slate-50">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Jenis Nilai</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Nilai Harian</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Nilai Bulanan</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Nilai Akhir</span>
            </div>

            {/* Score rows */}
            <div className="divide-y-2 divide-slate-50">
              {SCORE_TYPES.map(({ key: type, label }) => {
                const active = activeCol[type];
                return (
                  <div key={type} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 items-center px-4 py-3">
                    <span className="text-sm font-bold text-slate-700 leading-tight">{label}</span>

                    {/* Nilai Harian */}
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={active !== "harian"}
                      value={scores[buildKey(subject, type, "harian")] ?? ""}
                      onChange={(e) => handleCell(buildKey(subject, type, "harian"), e.target.value)}
                      className={cellCls(active === "harian")}
                      placeholder={active === "harian" ? "—" : ""}
                    />

                    {/* Nilai Bulanan */}
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={active !== "bulanan"}
                      value={scores[buildKey(subject, type, "bulanan")] ?? ""}
                      onChange={(e) => handleCell(buildKey(subject, type, "bulanan"), e.target.value)}
                      className={cellCls(active === "bulanan")}
                      placeholder={active === "bulanan" ? "—" : ""}
                    />

                    {/* Nilai Akhir */}
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={active !== "akhir"}
                      value={scores[buildKey(subject, type, "akhir")] ?? ""}
                      onChange={(e) => handleCell(buildKey(subject, type, "akhir"), e.target.value)}
                      className={cellCls(active === "akhir")}
                      placeholder={active === "akhir" ? "—" : ""}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {selectedPeriod && loading && (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>
        )}
      </main>

      {/* Sticky save bar */}
      {selectedPeriod && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-100 px-5 py-4 z-50" style={{ boxShadow: "0 -4px 0 0 #f1f5f9" }}>
          <div className="max-w-2xl mx-auto space-y-2">
            {saveStatus === "success" && (
              <div className="flex items-center gap-2 text-emerald-700 text-sm font-black bg-emerald-50 border-2 border-emerald-100 rounded-xl px-4 py-2">
                <CheckCircle2 size={15} /> Nilai berhasil disimpan!
              </div>
            )}
            {saveStatus === "error" && (
              <div className="flex items-center gap-2 text-rose-700 text-sm font-black bg-rose-50 border-2 border-rose-100 rounded-xl px-4 py-2">
                <AlertCircle size={15} /> {saveError}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !selectedPeriod}
              className="w-full bg-sky-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:translate-y-px transition-transform disabled:opacity-60 text-sm"
              style={{ boxShadow: "0 4px 0 0 #0284c7" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
              Simpan Nilai — {selectedPeriod}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
