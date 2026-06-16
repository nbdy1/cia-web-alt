/**
 * app/students/[id]/rapor/page.tsx
 *
 * Rapor (report card) page. Two modes:
 *
 *   SCREEN — Preview card (constrained width, looks nice in the app).
 *             Shows score tables.
 *
 *   PRINT  — When the user clicks "Cetak", we build a self-contained A4 HTML
 *             document and open it in a new window. This bypasses Chrome's
 *             screen-layout-to-print pipeline entirely, so the content always
 *             fills the full paper width regardless of screen viewport.
 *             The popup auto-triggers window.print() after load.
 */
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getStudentScores, getStudentPeriods } from "@/app/actions/scores";
import {
  ChevronLeft,
  Printer,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECTS = ["QCB", "QMB", "QSB"] as const;

const SCORE_TYPE_DEFS = [
  { key: "Hafalan",     label: "Hafalan",                      col: "harian"  as const },
  { key: "Muhadharah", label: "Muhadharah",                   col: "harian"  as const },
  { key: "FR",         label: "Fast Respon (FR)",              col: "bulanan" as const },
  { key: "AR",         label: "Analitic Retrieval (AR)",       col: "bulanan" as const },
  { key: "3PFB",       label: "3 Pasang Fungsi Bahasa (3PFB)", col: "akhir"   as const },
] as const;

type ScoreCell = { nilai_harian: number | null; nilai_bulanan: number | null; nilai_akhir: number | null };
type ScoreGrid = Record<string, Record<string, ScoreCell>>;
type Student = { name: string; batch: string | null };

// ─── Print HTML builder ───────────────────────────────────────────────────────
// Returns a complete, self-contained HTML document.
// No Tailwind, no external CSS — everything is inline or in a <style> block.
// Opens in a new window so Chrome prints it at full A4 width.

function buildPrintHTML(opts: {
  name: string;
  batch: string;
  period: string;
  printDate: string;
  scoreGrid: ScoreGrid;
}) {
  const { name, batch, period, printDate, scoreGrid } = opts;

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const scoreTablesHtml = SUBJECTS.map((subj) => {
    const grid = scoreGrid[subj] ?? {};
    const rows = SCORE_TYPE_DEFS.map(({ key, label, col }) => {
      const cell = grid[key];
      const h = cell?.nilai_harian;
      const b = cell?.nilai_bulanan;
      const a = cell?.nilai_akhir;
      return `
        <tr>
          <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9">${esc(label)}</td>
          <td style="padding:10px 8px;text-align:center;font-size:13px;font-weight:700;color:${col==="harian"?"#0f172a":"#cbd5e1"};border-bottom:1px solid #f1f5f9">${col==="harian" && h!=null ? h : col==="harian" ? "—" : ""}</td>
          <td style="padding:10px 8px;text-align:center;font-size:13px;font-weight:700;color:${col==="bulanan"?"#0f172a":"#cbd5e1"};border-bottom:1px solid #f1f5f9">${col==="bulanan" && b!=null ? b : col==="bulanan" ? "—" : ""}</td>
          <td style="padding:10px 8px;text-align:center;font-size:13px;font-weight:700;color:${col==="akhir"?"#0f172a":"#cbd5e1"};border-bottom:1px solid #f1f5f9">${col==="akhir" && a!=null ? a : col==="akhir" ? "—" : ""}</td>
        </tr>`;
    }).join("");

    return `
      <div style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <div style="background:#1e293b;padding:10px 16px">
          <span style="color:white;font-weight:800;font-size:14px">${esc(subj)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:8px 14px;text-align:left;font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em">Jenis Nilai</th>
              <th style="padding:8px 8px;text-align:center;font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em">Nilai Harian</th>
              <th style="padding:8px 8px;text-align:center;font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em">Nilai Bulanan</th>
              <th style="padding:8px 8px;text-align:center;font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em">Nilai Akhir</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Rapor — ${esc(name)}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 18mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>

<!-- School header -->
<div style="background:#0f172a;padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <p style="font-size:9px;font-weight:800;color:#34d399;text-transform:uppercase;letter-spacing:0.25em;margin-bottom:4px">Pesantren</p>
    <h1 style="font-size:26px;font-weight:900;color:white;line-height:1.1">Sekolah Impian</h1>
    <p style="font-size:11px;color:#94a3b8;font-weight:600;margin-top:4px">Laporan Perkembangan Santri</p>
  </div>
  <div style="text-align:right">
    <p style="font-size:9px;color:#94a3b8;font-weight:600">Periode</p>
    <p style="font-size:15px;font-weight:900;color:#34d399">${esc(period)}</p>
    <p style="font-size:9px;color:#64748b;font-weight:600;margin-top:4px">Dicetak: ${esc(printDate)}</p>
  </div>
</div>

<!-- Student info -->
<div style="padding:24px 32px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:20px">
  <div style="width:60px;height:60px;background:#10b981;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
    <span style="color:white;font-size:24px;font-weight:900">${esc(name.charAt(0))}</span>
  </div>
  <div>
    <h2 style="font-size:20px;font-weight:900;color:#0f172a">${esc(name)}</h2>
    <div style="display:flex;gap:10px;margin-top:6px">
      <span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:20px">${esc(batch)}</span>
    </div>
  </div>
</div>

<div style="padding:28px 32px">
    <p style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:16px">
      Nilai Per Mata Pelajaran — ${esc(period)}
    </p>

    ${scoreTablesHtml}

    <!-- Signatures -->
    <div style="margin-top:40px;border-top:1px solid #e2e8f0;padding-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:48px">
      <div style="text-align:center">
        <p style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:56px">Ustadz / Wali Kelas</p>
        <div style="border-bottom:1.5px solid #94a3b8;margin-bottom:8px"></div>
        <p style="font-size:9px;color:#94a3b8;font-weight:600">Tanda Tangan &amp; Nama</p>
      </div>
      <div style="text-align:center">
        <p style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:56px">Orang Tua / Wali</p>
        <div style="border-bottom:1.5px solid #94a3b8;margin-bottom:8px"></div>
        <p style="font-size:9px;color:#94a3b8;font-weight:600">Tanda Tangan &amp; Nama</p>
      </div>
    </div>
</div>

<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RaporPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const [student, setStudent] = useState<Student | null>(null);
  const [periods, setPeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [scoreGrid, setScoreGrid] = useState<ScoreGrid>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const [{ data: s }, p] = await Promise.all([
        supabase.from("students").select("name, batch").eq("id", studentId).single(),
        getStudentPeriods(studentId),
      ]);
      setStudent(s);
      setPeriods(p);
      if (p.length > 0) setSelectedPeriod(p[0]);
    };
    init().catch(console.error);
  }, [studentId]);

  useEffect(() => {
    if (!selectedPeriod) return;
    const load = async () => {
      setLoading(true);
      const rows = await getStudentScores(studentId, selectedPeriod);
      const grid: ScoreGrid = {};
      rows.forEach((r) => {
        if (!grid[r.subject]) grid[r.subject] = {};
        grid[r.subject][r.score_type] = {
          nilai_harian: r.nilai_harian,
          nilai_bulanan: r.nilai_bulanan,
          nilai_akhir: r.nilai_akhir,
        };
      });
      setScoreGrid(grid);
      setLoading(false);
    };
    load().catch(console.error);
  }, [studentId, selectedPeriod]);

  // ── Open a clean print window — no Tailwind constraints ────────────────
  const handlePrint = () => {
    if (!student) return;
    const printDate = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const html = buildPrintHTML({
      name: student.name,
      batch: student.batch ?? "Reguler",
      period: selectedPeriod,
      printDate,
      scoreGrid,
    });
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { alert("Popup diblokir. Izinkan popup untuk halaman ini."); return; }
    win.document.write(html);
    win.document.close();
  };

  const displayName = student?.name ?? "…";

  if (!student && loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-24 font-sans">

      {/* Header */}
      <header className="bg-white border-b-2 border-slate-100 px-5 pt-10 pb-4 flex items-center gap-4 sticky top-0 z-40" style={{ boxShadow: "0 3px 0 0 #f1f5f9" }}>
        <Link href={`/students/${studentId}`}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 flex-shrink-0"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}>
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Cetak Rapor</p>
          <h1 className="text-sm font-black text-slate-900">{displayName}</h1>
        </div>
        <button
          onClick={handlePrint}
          disabled={!selectedPeriod || loading}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2.5 rounded-xl font-black text-sm disabled:opacity-50"
          style={{ boxShadow: "0 3px 0 0 #5b21b6" }}
        >
          <Printer size={15} /> Cetak
        </button>
      </header>

      {/* Period selector */}
      {periods.length > 0 && (
        <div className="px-5 py-3 bg-white border-b-2 border-slate-100">
          <div className="flex items-center gap-3 max-w-3xl mx-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">Periode:</span>
            <div className="flex flex-wrap gap-2">
              {periods.map((p) => (
                <button key={p} onClick={() => setSelectedPeriod(p)}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-colors ${selectedPeriod === p ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  style={selectedPeriod === p ? { boxShadow: "0 2px 0 0 #5b21b6" } : {}}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Scores preview */}
        <div className="bg-white rounded-[2rem] border-2 border-slate-200 overflow-hidden" style={{ boxShadow: "0 6px 0 0 #e2e8f0" }}>
          <div className="bg-slate-800 px-8 py-5 flex justify-between items-center">
            <div>
              <p className="text-xs font-black text-emerald-400">Sekolah Impian — Laporan Nilai</p>
              <p className="text-base font-black text-white">{displayName}</p>
            </div>
            <p className="text-sm text-slate-300 font-bold">{selectedPeriod}</p>
          </div>

          <div className="px-8 py-6 space-y-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nilai Per Mata Pelajaran — {selectedPeriod || "—"}</p>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
            ) : SUBJECTS.map((subj) => {
              const grid = scoreGrid[subj] ?? {};
              return (
                <div key={subj} className="overflow-hidden rounded-2xl border-2 border-slate-100">
                  <div className="bg-slate-800 px-5 py-3">
                    <span className="text-white font-black text-sm">{subj}</span>
                  </div>
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b-2 border-slate-100 bg-slate-50">
                    {["Jenis Nilai","Nilai Harian","Nilai Bulanan","Nilai Akhir"].map((h, i) => (
                      <div key={h} className={`px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider ${i>0?"text-center":""}`}>{h}</div>
                    ))}
                  </div>
                  {SCORE_TYPE_DEFS.map(({ key, label, col }) => {
                    const cell = grid[key];
                    const h = cell?.nilai_harian; const b = cell?.nilai_bulanan; const a = cell?.nilai_akhir;
                    return (
                      <div key={key} className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-slate-50 last:border-0">
                        <div className="px-4 py-3 text-sm font-bold text-slate-700">{label}</div>
                        <div className={`px-2 py-3 text-center text-sm font-black ${col==="harian"?"text-slate-900":"text-slate-200"}`}>{col==="harian" ? (h!=null?h:"—") : ""}</div>
                        <div className={`px-2 py-3 text-center text-sm font-black ${col==="bulanan"?"text-slate-900":"text-slate-200"}`}>{col==="bulanan" ? (b!=null?b:"—") : ""}</div>
                        <div className={`px-2 py-3 text-center text-sm font-black ${col==="akhir"?"text-slate-900":"text-slate-200"}`}>{col==="akhir" ? (a!=null?a:"—") : ""}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <div className="border-t-2 border-slate-100 pt-6">
              <div className="grid grid-cols-2 gap-8">
                {["Ustadz / Wali Kelas", "Orang Tua / Wali"].map((label) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-12">{label}</p>
                    <div className="border-b-2 border-slate-300 mb-2" />
                    <p className="text-[10px] text-slate-400 font-bold">Tanda Tangan & Nama</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Print hint */}
        {!selectedPeriod && periods.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-slate-400 font-bold">
              Belum ada nilai — <Link href={`/students/${studentId}/scores`} className="text-violet-600 underline">Input Nilai dulu</Link> untuk melengkapi rapor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
