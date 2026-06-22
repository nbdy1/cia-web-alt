/**
 * app/students/[id]/rapor/page.tsx
 *
 * Rapor (report card) page. Two modes:
 *
 *   SCREEN — Preview card (constrained width, looks nice in the app).
 *             Shows score tables + CIA sub-indicator recap.
 *
 *   PRINT  — When the user clicks "Cetak", we build a self-contained A4 HTML
 *             document and open it in a new window. This bypasses Chrome's
 *             screen-layout-to-print pipeline entirely, so the content always
 *             fills the full paper width regardless of screen viewport.
 *             The popup auto-triggers window.print() after load.
 *             The print document includes both the CMS score tables and a full
 *             CIA sub-indicator fulfillment section (theme bars + category %).
 */
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getStudentScores, getStudentPeriods } from "@/app/actions/scores";
import { ChevronLeft, Printer, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { karakterData } from "@/lib/data/karakter";
import { mentalData } from "@/lib/data/mental";
import { softSkillData } from "@/lib/data/soft-skill";
import { getCIAPhase } from "@/lib/cia-phases";

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
type Student = { name: string; nis: string | null };

// ─── CIA helpers ──────────────────────────────────────────────────────────────

const CIA_CATEGORIES = [
  {
    label: "Karakter",
    data: karakterData,
    color: "#f43f5e",
    lightBg: "#fff1f2",
    borderColor: "#fecdd3",
    twColor: "text-rose-500",
    twBg: "bg-rose-50",
    twBorder: "border-rose-100",
    twProg: "bg-rose-400",
  },
  {
    label: "Mental",
    data: mentalData,
    color: "#3b82f6",
    lightBg: "#eff6ff",
    borderColor: "#bfdbfe",
    twColor: "text-blue-500",
    twBg: "bg-blue-50",
    twBorder: "border-blue-100",
    twProg: "bg-blue-400",
  },
  {
    label: "Soft Skill",
    data: softSkillData,
    color: "#a855f7",
    lightBg: "#faf5ff",
    borderColor: "#e9d5ff",
    twColor: "text-purple-500",
    twBg: "bg-purple-50",
    twBorder: "border-purple-100",
    twProg: "bg-purple-400",
  },
];

const norm = (s: string) => s.trim().toLowerCase();

function buildCIACounts(
  reports: Array<{ treatment_plan: unknown }>
): Record<string, Map<string, number>> {
  const countByCategory: Record<string, Map<string, number>> = {
    Karakter: new Map(),
    Mental: new Map(),
    "Soft Skill": new Map(),
  };
  const dataByLabel: Record<string, typeof karakterData> = {
    Karakter: karakterData,
    Mental: mentalData,
    "Soft Skill": softSkillData,
  };
  const isLikelySame = (a: string, b: string) => {
    const na = norm(a), nb = norm(b);
    return na === nb || na.includes(nb) || nb.includes(na);
  };

  reports.forEach((report) => {
    let plan = report.treatment_plan;
    if (typeof plan === "string") {
      try { plan = JSON.parse(plan); } catch { return; }
    }
    if (!plan || !Array.isArray((plan as any).detailed_assessments)) return;

    (plan as any).detailed_assessments.forEach((assessment: any) => {
      const cat = assessment.category as string;
      const bucket =
        countByCategory[cat] ??
        countByCategory[Object.keys(countByCategory).find((k) => norm(k) === norm(cat)) ?? ""];
      if (!bucket || !Array.isArray(assessment.fulfilled_sub_indicators)) return;

      const catData =
        dataByLabel[cat] ??
        dataByLabel[Object.keys(dataByLabel).find((k) => norm(k) === norm(cat)) ?? ""];
      if (!catData) return;

      let fullSubs: string[] | null = null;
      for (const theme of catData.themes) {
        if (norm(theme.title) !== norm(assessment.theme as string)) continue;
        for (const ind of theme.indicators) {
          if (norm(ind.title) === norm(assessment.indicator as string)) {
            fullSubs = ind.sub_indicators;
            break;
          }
        }
        if (fullSubs) break;
      }
      if (!fullSubs) return;

      fullSubs.forEach((frameworkSub) => {
        if (
          assessment.fulfilled_sub_indicators.some((si: string) =>
            isLikelySame(si, frameworkSub)
          )
        ) {
          const key = norm(frameworkSub);
          bucket.set(key, (bucket.get(key) ?? 0) + 1);
        }
      });
    });
  });

  return countByCategory;
}

// ─── Print HTML builder ───────────────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildCIASectionHtml(
  countByCategory: Record<string, Map<string, number>>,
): string {
  const summaryCells = CIA_CATEGORIES.map((cat) => {
    const countMap = countByCategory[cat.label] ?? new Map<string, number>();
    let totalSub = 0, fulfilledSub = 0;
    cat.data.themes.forEach((theme) => {
      theme.indicators.forEach((ind) => {
        ind.sub_indicators.forEach((sub) => {
          totalSub++;
          if ((countMap.get(norm(sub)) ?? 0) >= 1) fulfilledSub++;
        });
      });
    });
    const pct = totalSub > 0 ? parseFloat(((fulfilledSub / totalSub) * 100).toFixed(1)) : 0;
    const pctStr = String(pct).replace(".", ",");
    return `
      <div style="background:${cat.lightBg};border:1px solid ${cat.borderColor};border-radius:8px;padding:12px 16px">
        <p style="font-size:9px;font-weight:800;color:${cat.color};text-transform:uppercase;letter-spacing:0.1em;margin:0 0 4px">${esc(cat.label)}</p>
        <p style="font-size:22px;font-weight:900;color:${cat.color};margin:0 0 2px">${pctStr}%</p>
        <p style="font-size:10px;color:#64748b;font-weight:600;margin:0 0 8px">${fulfilledSub} dari ${totalSub} sub-indikator</p>
        <div style="width:100%;height:4px;background:${cat.borderColor};border-radius:99px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${cat.color};border-radius:99px"></div>
        </div>
      </div>`;
  }).join("");

  const detailBlocks = CIA_CATEGORIES.map((cat) => {
    const countMap = countByCategory[cat.label] ?? new Map<string, number>();

    // ── Theme bars ──
    const themeBars = cat.data.themes.map((theme, i) => {
      let total = 0, fulfilled = 0;
      theme.indicators.forEach((ind) => {
        ind.sub_indicators.forEach((sub) => {
          total++;
          if ((countMap.get(norm(sub)) ?? 0) >= 7) fulfilled++;
        });
      });
      const pct = total > 0 ? Math.round((fulfilled / total) * 100) : 0;
      if (pct === 0) return "";
      return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          <span style="color:${cat.color};font-size:10px;font-weight:900;width:16px;text-align:right;flex-shrink:0">${i + 1}</span>
          <div style="flex:1;min-width:0">
            <p style="font-size:10px;font-weight:700;color:#475569;margin:0 0 3px">${esc(theme.title)}</p>
            <div style="width:100%;height:4px;background:#f1f5f9;border-radius:99px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${cat.color};border-radius:99px;opacity:0.8"></div>
            </div>
          </div>
          <span style="font-size:10px;font-weight:900;color:${cat.color};flex-shrink:0">${fulfilled}/${total}</span>
        </div>`;
    }).join("");

    // ── Sub-indicator details per theme ──
    const subDetails = cat.data.themes.map((theme) => {
      // Theme-level phase: % of this theme's sub-indicators that are fulfilled
      let themeTotalSub = 0, themeFilledSub = 0;
      theme.indicators.forEach((ind) => {
        ind.sub_indicators.forEach((sub) => {
          themeTotalSub++;
          if ((countMap.get(norm(sub)) ?? 0) >= 7) themeFilledSub++;
        });
      });
      const themePhase = getCIAPhase(themeFilledSub, themeTotalSub);

      const visibleInds = theme.indicators.map((ind) => {
        const fulfilledSubs = ind.sub_indicators.filter(
          (sub) => (countMap.get(norm(sub)) ?? 0) >= 1
        );
        return { title: ind.title, subs: fulfilledSubs };
      }).filter((ind) => ind.subs.length > 0);

      if (visibleInds.length === 0) return "";

      const indRows = visibleInds.map((ind) => {
        const subRows = ind.subs.map((sub) => {
          const subCount = countMap.get(norm(sub)) ?? 0;
          const isKuat = subCount >= 7;
          return `
            <div style="display:flex;align-items:flex-start;gap:6px;padding:3px 8px;border-radius:4px;margin-bottom:2px;background:${isKuat ? "#ecfdf5" : "#fffbeb"};border:1px solid ${isKuat ? "#bbf7d0" : "#fde68a"}">
              <span style="color:${isKuat ? "#059669" : "#d97706"};font-size:10px;flex-shrink:0;margin-top:1px">✓</span>
              <span style="font-size:11px;font-weight:600;color:${isKuat ? "#065f46" : "#92400e"};flex:1;line-height:1.4">${esc(sub)}</span>
              <span style="font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;padding:1px 5px;border-radius:20px;flex-shrink:0;background:${isKuat ? "#059669" : "#fef3c7"};color:${isKuat ? "#fff" : "#92400e"}">${isKuat ? "Kuat" : "Lemah"}</span>
            </div>`;
        }).join("");
        return `
          <div style="margin-bottom:8px">
            <p style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px;padding:2px 8px;background:#f8fafc;border-radius:4px;display:inline-block">${esc(ind.title)}</p>
            ${subRows}
          </div>`;
      }).join("");

      const phaseBadge = themePhase
        ? `<span style="font-size:8px;font-weight:800;background:${themePhase.printBadgeBg};color:${themePhase.printBadgeText};padding:1px 7px;border-radius:20px;margin-left:8px">${themePhase.index}. ${themePhase.shortLabel}</span>`
        : "";

      return `
        <div style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;page-break-inside:avoid">
          <div style="background:#f1f5f9;padding:5px 10px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center">
            <span style="font-size:10px;font-weight:800;color:#1e293b;flex:1">${esc(theme.title)}</span>
            ${phaseBadge}
            <span style="font-size:9px;color:#94a3b8;font-weight:700;margin-left:8px">${themeFilledSub}/${themeTotalSub}</span>
          </div>
          <div style="padding:8px 10px">${indRows}</div>
        </div>`;
    }).join("");

    const isEmpty = !themeBars.trim();
    return `
      <div style="margin-bottom:16px;page-break-inside:avoid">
        <div style="background:#1e293b;padding:8px 14px;border-radius:8px 8px 0 0">
          <span style="color:white;font-weight:800;font-size:13px">${esc(cat.label)}</span>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:12px 14px;border-radius:0 0 8px 8px">
          ${isEmpty
            ? `<p style="font-size:11px;color:#94a3b8;font-style:italic;margin:0">Belum ada tema yang terpenuhi.</p>`
            : `
              <p style="font-size:8px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 10px">Pemenuhan Per Tema</p>
              ${themeBars}
              <div style="margin-top:14px;padding-top:12px;border-top:1px solid #f1f5f9">
                <p style="font-size:8px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 10px">Sub-Indikator Terpenuhi</p>
                ${subDetails}
              </div>
            `
          }
        </div>
      </div>`;
  }).join("");

  return `
    <div style="margin-top:32px;padding-top:24px;border-top:2px solid #e2e8f0">
      <p style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:16px">
        Rekapitulasi CIA — Ketercapaian Sub-Indikator
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
        ${summaryCells}
      </div>
      ${detailBlocks}
    </div>`;
}

function buildPrintHTML(opts: {
  name: string;
  nis: string;
  period: string;
  printDate: string;
  scoreGrid: ScoreGrid;
  countByCategory: Record<string, Map<string, number>>;
}) {
  const { name, nis, period, printDate, scoreGrid, countByCategory } = opts;

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
          <td style="padding:10px 8px;text-align:center;font-size:13px;font-weight:700;color:${col === "harian" ? "#0f172a" : "#cbd5e1"};border-bottom:1px solid #f1f5f9">${col === "harian" && h != null ? h : col === "harian" ? "—" : ""}</td>
          <td style="padding:10px 8px;text-align:center;font-size:13px;font-weight:700;color:${col === "bulanan" ? "#0f172a" : "#cbd5e1"};border-bottom:1px solid #f1f5f9">${col === "bulanan" && b != null ? b : col === "bulanan" ? "—" : ""}</td>
          <td style="padding:10px 8px;text-align:center;font-size:13px;font-weight:700;color:${col === "akhir" ? "#0f172a" : "#cbd5e1"};border-bottom:1px solid #f1f5f9">${col === "akhir" && a != null ? a : col === "akhir" ? "—" : ""}</td>
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

  const ciaSectionHtml = buildCIASectionHtml(countByCategory);

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
      ${nis ? `<span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:20px">NIS: ${esc(nis)}</span>` : ""}
    </div>
  </div>
</div>

<div style="padding:28px 32px">
  <p style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:16px">
    Nilai Per Mata Pelajaran — ${esc(period)}
  </p>

  ${scoreTablesHtml}

  ${ciaSectionHtml}

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
  const [totalReports, setTotalReports] = useState(0);
  const [countByCategory, setCountByCategory] = useState<Record<string, Map<string, number>>>({
    Karakter: new Map(),
    Mental: new Map(),
    "Soft Skill": new Map(),
  });

  useEffect(() => {
    const init = async () => {
      const [{ data: s }, p] = await Promise.all([
        supabase.from("students").select("name, nis").eq("id", studentId).single(),
        getStudentPeriods(studentId),
      ]);
      setStudent(s);
      setPeriods(p);
      if (p.length > 0) setSelectedPeriod(p[0]);
    };
    init().catch(console.error);
  }, [studentId]);

  // CIA sub-indicator counts — aggregated across all reports (same as recap page)
  useEffect(() => {
    const loadCIA = async () => {
      const { data: reports } = await supabase
        .from("reports")
        .select("treatment_plan")
        .eq("student_id", studentId);
      if (reports) {
        setTotalReports(reports.length);
        setCountByCategory(buildCIACounts(reports));
      }
    };
    loadCIA().catch(console.error);
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

  const handlePrint = () => {
    if (!student) return;
    const printDate = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const html = buildPrintHTML({
      name: student.name,
      nis: student.nis ?? "",
      period: selectedPeriod,
      printDate,
      scoreGrid,
      countByCategory,
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
      <header
        className="bg-white border-b-2 border-slate-100 px-5 pt-10 pb-4 flex items-center gap-4 sticky top-0 z-40"
        style={{ boxShadow: "0 3px 0 0 #f1f5f9" }}
      >
        <Link
          href={`/students/${studentId}`}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 flex-shrink-0"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        >
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
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-colors ${
                    selectedPeriod === p
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                  style={selectedPeriod === p ? { boxShadow: "0 2px 0 0 #5b21b6" } : {}}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Preview card */}
        <div
          className="bg-white rounded-[2rem] border-2 border-slate-200 overflow-hidden"
          style={{ boxShadow: "0 6px 0 0 #e2e8f0" }}
        >
          <div className="bg-slate-800 px-8 py-5 flex justify-between items-center">
            <div>
              <p className="text-xs font-black text-emerald-400">Sekolah Impian — Laporan Nilai</p>
              <p className="text-base font-black text-white">{displayName}</p>
            </div>
            <p className="text-sm text-slate-300 font-bold">{selectedPeriod}</p>
          </div>

          <div className="px-8 py-6 space-y-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Nilai Per Mata Pelajaran — {selectedPeriod || "—"}
            </p>

            {/* Score tables */}
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : (
              SUBJECTS.map((subj) => {
                const grid = scoreGrid[subj] ?? {};
                return (
                  <div key={subj} className="overflow-hidden rounded-2xl border-2 border-slate-100">
                    <div className="bg-slate-800 px-5 py-3">
                      <span className="text-white font-black text-sm">{subj}</span>
                    </div>
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b-2 border-slate-100 bg-slate-50">
                      {["Jenis Nilai", "Nilai Harian", "Nilai Bulanan", "Nilai Akhir"].map((h, i) => (
                        <div
                          key={h}
                          className={`px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider ${i > 0 ? "text-center" : ""}`}
                        >
                          {h}
                        </div>
                      ))}
                    </div>
                    {SCORE_TYPE_DEFS.map(({ key, label, col }) => {
                      const cell = grid[key];
                      const h = cell?.nilai_harian;
                      const b = cell?.nilai_bulanan;
                      const a = cell?.nilai_akhir;
                      return (
                        <div key={key} className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-slate-50 last:border-0">
                          <div className="px-4 py-3 text-sm font-bold text-slate-700">{label}</div>
                          <div className={`px-2 py-3 text-center text-sm font-black ${col === "harian" ? "text-slate-900" : "text-slate-200"}`}>
                            {col === "harian" ? (h != null ? h : "—") : ""}
                          </div>
                          <div className={`px-2 py-3 text-center text-sm font-black ${col === "bulanan" ? "text-slate-900" : "text-slate-200"}`}>
                            {col === "bulanan" ? (b != null ? b : "—") : ""}
                          </div>
                          <div className={`px-2 py-3 text-center text-sm font-black ${col === "akhir" ? "text-slate-900" : "text-slate-200"}`}>
                            {col === "akhir" ? (a != null ? a : "—") : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}

            {/* ── CIA Recap Section ───────────────────────────────────────── */}
            {!loading && (
              <div className="border-t-2 border-slate-100 pt-6 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Rekapitulasi CIA — Ketercapaian Sub-Indikator
                </p>

                {/* Category summary cards */}
                <div className="grid grid-cols-3 gap-3">
                  {CIA_CATEGORIES.map((cat) => {
                    const countMap = countByCategory[cat.label] ?? new Map<string, number>();
                    let totalSub = 0, fulfilledSub = 0;
                    cat.data.themes.forEach((theme) => {
                      theme.indicators.forEach((ind) => {
                        ind.sub_indicators.forEach((sub) => {
                          totalSub++;
                          if ((countMap.get(norm(sub)) ?? 0) >= 1) fulfilledSub++;
                        });
                      });
                    });
                    const pct = totalSub > 0 ? parseFloat(((fulfilledSub / totalSub) * 100).toFixed(1)) : 0;
                    return (
                      <div
                        key={cat.label}
                        className={`${cat.twBg} border-2 ${cat.twBorder} rounded-xl p-3`}
                      >
                        <p className={`text-[9px] font-black uppercase tracking-wide ${cat.twColor}`}>
                          {cat.label}
                        </p>
                        <p className={`text-xl font-black ${cat.twColor} mt-1`}>
                          {String(pct).replace(".", ",")}%
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                          {fulfilledSub}/{totalSub}
                        </p>
                        <div className="w-full h-1.5 bg-white/60 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full ${cat.twProg} rounded-full`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Theme bars + sub-indicator details per category */}
                {CIA_CATEGORIES.map((cat) => {
                  const countMap = countByCategory[cat.label] ?? new Map<string, number>();
                  const themeStats = cat.data.themes.map((theme) => {
                    let total = 0, fulfilled = 0;
                    theme.indicators.forEach((ind) => {
                      ind.sub_indicators.forEach((sub) => {
                        total++;
                        if ((countMap.get(norm(sub)) ?? 0) >= 1) fulfilled++;
                      });
                    });
                    return { total, fulfilled, pct: total > 0 ? Math.round((fulfilled / total) * 100) : 0 };
                  });
                  const hasFulfilled = themeStats.some((s) => s.pct > 0);
                  if (!hasFulfilled) return null;

                  return (
                    <div key={cat.label} className="border-2 border-slate-100 rounded-2xl overflow-hidden">
                      <div className="bg-slate-800 px-4 py-2.5">
                        <span className="text-white font-black text-xs">{cat.label}</span>
                      </div>
                      <div className="p-4 space-y-1.5">
                        {/* Theme bars */}
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                          Pemenuhan Per Tema
                        </p>
                        {cat.data.themes.map((theme, i) => {
                          const { pct, fulfilled, total } = themeStats[i];
                          if (pct === 0) return null;
                          return (
                            <div key={i} className="flex items-center gap-2 py-0.5">
                              <span className="text-[10px] font-black w-4 text-right flex-shrink-0" style={{ color: cat.color }}>{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-slate-600 mb-1 truncate">{theme.title}</p>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color, opacity: 0.8 }} />
                                </div>
                              </div>
                              <span className="text-[10px] font-black flex-shrink-0 tabular-nums" style={{ color: cat.color }}>{fulfilled}/{total}</span>
                            </div>
                          );
                        })}

                        {/* Sub-indicator details per theme */}
                        <div className="border-t-2 border-slate-100 mt-4 pt-4 space-y-3">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Sub-Indikator Terpenuhi
                          </p>
                          {cat.data.themes.map((theme, i) => {
                            // Theme-level phase: fulfilled / total sub-indicators for this theme
                            let themeTotalSub = 0, themeFilledSub = 0;
                            theme.indicators.forEach((ind) => {
                              ind.sub_indicators.forEach((sub) => {
                                themeTotalSub++;
                                if ((countMap.get(norm(sub)) ?? 0) >= 1) themeFilledSub++;
                              });
                            });
                            const themePhase = getCIAPhase(themeFilledSub, themeTotalSub);

                            const visibleInds = theme.indicators.map((ind) => ({
                              title: ind.title,
                              subs: ind.sub_indicators.filter(
                                (sub) => (countMap.get(norm(sub)) ?? 0) >= 1
                              ),
                            })).filter((ind) => ind.subs.length > 0);

                            if (visibleInds.length === 0) return null;
                            return (
                              <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                                <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                                  <span className="text-[11px] font-black text-slate-700 flex-1">{theme.title}</span>
                                  {themePhase && (
                                    <span className={`shrink-0 text-[8px] font-black px-2 py-0.5 rounded-full border ${themePhase.bg} ${themePhase.border} ${themePhase.text}`}>
                                      {themePhase.index}. {themePhase.shortLabel}
                                    </span>
                                  )}
                                  <span className="text-[9px] text-slate-400 font-bold shrink-0">{themeFilledSub}/{themeTotalSub}</span>
                                </div>
                                <div className="p-3 space-y-3">
                                  {visibleInds.map((ind, iIdx) => (
                                    <div key={iIdx}>
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                                        {ind.title}
                                      </p>
                                      <div className="space-y-1">
                                        {ind.subs.map((sub, sIdx) => {
                                          const subCount = countMap.get(norm(sub)) ?? 0;
                                          const isKuat = subCount >= 7;
                                          return (
                                            <div
                                              key={sIdx}
                                              className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border ${isKuat ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50/60"}`}
                                            >
                                              <CheckCircle2 size={13} className={`${isKuat ? "text-emerald-500" : "text-amber-400"} mt-0.5 shrink-0`} />
                                              <span className="flex-1 text-xs font-medium leading-snug text-slate-800">
                                                {sub}
                                              </span>
                                              <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${isKuat ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-700"}`}>
                                                {isKuat ? "Kuat" : "Lemah"}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Signatures */}
            <div className="border-t-2 border-slate-100 pt-6">
              <div className="grid grid-cols-2 gap-8">
                {["Ustadz / Wali Kelas", "Orang Tua / Wali"].map((label) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-12">
                      {label}
                    </p>
                    <div className="border-b-2 border-slate-300 mb-2" />
                    <p className="text-[10px] text-slate-400 font-bold">Tanda Tangan & Nama</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Empty state hint */}
        {!selectedPeriod && periods.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-slate-400 font-bold">
              Belum ada nilai —{" "}
              <Link
                href={`/students/${studentId}/scores`}
                className="text-violet-600 underline"
              >
                Input Nilai CMS dulu
              </Link>{" "}
              untuk melengkapi rapor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
