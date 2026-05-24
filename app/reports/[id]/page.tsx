import React from "react";
import { supabase } from "@/lib/supabase";
import {
  ChevronLeft,
  Calendar,
  Quote,
  Lightbulb,
  BarChart3,
  Brain,
  Heart,
  Zap,
  CheckCircle2,
  Circle,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { karakterData } from "@/lib/data/karakter";
import { mentalData } from "@/lib/data/mental";
import { softSkillData } from "@/lib/data/soft-skill";

// ─── Framework lookup helpers ──────────────────────────────────────────────
// Given a category + theme title + indicator title from the AI output,
// return the FULL sub_indicators array from the local framework.
// This ensures the report always shows all sub-indicators, not just those
// the AI happened to see via RAG.

const ALL_DATA: Record<string, { themes: { title: string; indicators: { title: string; sub_indicators: string[] }[] }[] }> = {
  Karakter: karakterData,
  Mental: mentalData,
  "Soft Skill": softSkillData,
};

function normaliseStr(s: string) {
  return s.trim().toLowerCase();
}

function lookupFullIndicator(
  category: string,
  themeTitle: string,
  indicatorTitle: string
): string[] | null {
  const catData = ALL_DATA[category];
  if (!catData) return null;

  for (const theme of catData.themes) {
    if (normaliseStr(theme.title) === normaliseStr(themeTitle)) {
      for (const ind of theme.indicators) {
        if (normaliseStr(ind.title) === normaliseStr(indicatorTitle)) {
          return ind.sub_indicators;
        }
      }
    }
  }
  return null;
}

function isSubFulfilled(sub: string, fulfilledList: string[]): boolean {
  const n = normaliseStr(sub);
  for (const f of fulfilledList) {
    const fn = normaliseStr(f);
    if (fn === n || fn.includes(n) || n.includes(fn)) return true;
  }
  return false;
}

function computeDisplayOverallStats(analysis: any) {
  const categories = ["Karakter", "Mental", "Soft Skill"] as const;
  const result: Record<string, { fulfilled: number; total: number; percentage: number }> = {};

  categories.forEach((cat) => {
    const data = ALL_DATA[cat];
    const canonicalFulfilled = new Set<string>();
    const assessments = Array.isArray(analysis?.detailed_assessments)
      ? analysis.detailed_assessments.filter((a: any) => a.category === cat)
      : [];

    assessments.forEach((item: any) => {
      const fullSubs = lookupFullIndicator(item.category, item.theme, item.indicator);
      if (!fullSubs) return;
      const aiFulfilled: string[] = item.fulfilled_sub_indicators ?? [];
      fullSubs.forEach((sub) => {
        if (isSubFulfilled(sub, aiFulfilled)) canonicalFulfilled.add(normaliseStr(sub));
      });
    });

    let total = 0;
    data.themes.forEach((theme) => {
      theme.indicators.forEach((ind) => {
        ind.sub_indicators.forEach((sub) => {
          total++;
        });
      });
    });

    const fulfilled = canonicalFulfilled.size;
    result[cat.toLowerCase().replace(" ", "_")] = {
      fulfilled,
      total,
      percentage: total > 0 ? Math.round((fulfilled / total) * 10000) / 100 : 0,
    };
  });

  return result;
}


async function getReportDetails(id: string) {
  const { data: report } = await supabase
    .from("reports")
    .select(`*, students(name)`)
    .eq("id", id)
    .single();

  return { report };
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { report } = await getReportDetails(id);

  if (!report)
    return (
      <div className="p-10 text-center text-slate-500 font-serif">
        Laporan tidak ditemukan.
      </div>
    );

  const analysis =
    typeof report.treatment_plan === "string"
      ? JSON.parse(report.treatment_plan)
      : report.treatment_plan;
  const displayOverallStats = computeDisplayOverallStats(analysis);

  const categories = ["Karakter", "Mental", "Soft Skill"];

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans relative">
      {/* Sticky Header */}
      <header className="bg-white/80 backdrop-blur-md px-6 pt-12 pb-6 border-b border-slate-200 flex items-center justify-between sticky top-0 z-30">
        <Link
          href={`/students/${report.student_id}`}
          className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-all"
        >
          <ChevronLeft className="w-6 h-6 text-slate-800" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">
            Laporan Perkembangan
          </p>
          <h1 className="text-sm font-bold text-slate-900">
            {report.students.name}
          </h1>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            {report.title || "Laporan Perkembangan"}
          </p>
        </div>
        <div className="w-10" />
      </header>

      <main className="px-5 py-8 space-y-8">
        {/* 1. OVERALL PROGRESS */}
        <section className="bg-emerald-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <BarChart3 size={80} />
          </div>
          <div className="relative z-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 mb-3">
              Perkembangan Keseluruhan
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(displayOverallStats || {}).map(
                ([key, stats]: [string, any]) => (
                  <div
                    key={key}
                    className="bg-white/10 rounded-2xl p-3 border border-white/10"
                  >
                    <p className="text-[8px] font-black uppercase text-emerald-300 mb-1">
                      {key}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold">
                        {(stats.percentage || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-1 bg-white/20 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: `${stats.percentage}%` }}
                      />
                    </div>
                    <p className="text-[7px] opacity-60 mt-1 font-bold">
                      {stats.fulfilled}/{stats.total}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 relative">
          <Quote className="absolute top-6 left-6 w-8 h-8 text-slate-50" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Narasi Observasi
          </h3>

          <div className="space-y-4 relative z-10 mt-4">
            {(() => {
              const parts = report.narrative.split(/(Guru:|AI:|Ustadz:)/g);
              const msgs = [];
              let currentSpeaker = null;
              
              for (let i = 0; i < parts.length; i++) {
                const part = parts[i].trim();
                if (!part) continue;
                
                if (part === 'Guru:' || part === 'Ustadz:') {
                  currentSpeaker = 'Guru';
                } else if (part === 'AI:') {
                  currentSpeaker = 'AI';
                } else {
                  msgs.push({
                    speaker: currentSpeaker || 'System',
                    text: part
                  });
                  currentSpeaker = null;
                }
              }

              if (msgs.length === 0 && report.narrative.trim()) {
                msgs.push({ speaker: 'System', text: report.narrative });
              }

              return msgs.map((msg, i) => {
                const isGuru = msg.speaker === 'Guru';
                const isAI = msg.speaker === 'AI';
                
                if (isGuru || isAI) {
                  return (
                    <div
                      key={i}
                      className={`flex ${isGuru ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[90%] p-4 rounded-[1.8rem] shadow-sm ${
                          isGuru
                            ? "bg-emerald-900 text-white rounded-tr-none"
                            : "bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1 opacity-60">
                          <span className="text-[9px] font-black uppercase tracking-widest">
                            {isGuru ? "Ustadz" : "Asisten CIA"}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed font-medium">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <p
                    key={i}
                    className="text-sm text-slate-700 leading-relaxed italic font-medium"
                  >
                    {msg.text}
                  </p>
                );
              });
            })()}
          </div>
          <div className="mt-6 flex items-center gap-2 text-slate-300">
            <Calendar size={12} />
            <span className="text-[9px] font-bold uppercase tracking-tighter">
              {new Date(report.created_at).toLocaleDateString("id-ID", {
                dateStyle: "full",
              })}
            </span>
          </div>
        </section>

        {/* 3. PRIORITY TREATMENT */}
        {analysis.treatment && (
          <section className="bg-white rounded-[2.5rem] p-7 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="text-emerald-600" size={18} />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Rencana Penanganan
              </h3>
            </div>
            <div className="bg-emerald-50 p-5 rounded-[2rem] border border-emerald-100">
              <div className="flex flex-col mb-4">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">
                  {analysis.treatment.priority_theme}
                </span>
                <h4 className="text-base font-bold text-slate-900 font-serif leading-tight">
                  {analysis.treatment.priority_indicator}
                </h4>
              </div>

              <div className="space-y-2 mb-5">
                {analysis.treatment.target_sub_indicators?.map(
                  (si: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-[11px] text-slate-600 font-medium leading-tight"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                      {si}
                    </div>
                  ),
                )}
              </div>

              <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {analysis.treatment.action_plan}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 4. DETAILED ANALYSIS */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
            Detail Pencapaian
          </h3>

          {categories.map((cat) => {
            const items =
              analysis.detailed_assessments?.filter(
                (a: any) => a.category === cat,
              ) || [];
            if (items.length === 0) return null;

            return (
              <div
                key={cat}
                className="bg-white rounded-[2.2rem] border border-slate-100 shadow-sm overflow-hidden"
              >
                <div className="flex items-center gap-3 p-5 border-b border-slate-50">
                  <div
                    className={`p-2.5 rounded-xl ${cat === "Karakter" ? "bg-rose-50 text-rose-500" : cat === "Mental" ? "bg-blue-50 text-blue-500" : "bg-amber-50 text-amber-500"}`}
                  >
                    {cat === "Karakter" && <Heart size={18} />}
                    {cat === "Mental" && <Brain size={18} />}
                    {cat === "Soft Skill" && <Zap size={18} />}
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm font-serif">
                    Analisis {cat}
                  </h4>
                </div>

                <div className="p-5 space-y-6">
                  {items.map((item: any, i: number) => {
                    // Look up the FULL sub-indicator list from the local framework.
                    // Falls back to the AI's combined list if the theme/indicator
                    // name doesn't match (e.g. legacy reports).
                    const fullSubs = lookupFullIndicator(
                      item.category,
                      item.theme,
                      item.indicator
                    );

                    const aiFullfilled: string[] = item.fulfilled_sub_indicators ?? [];
                    const displaySubs = fullSubs ?? [
                      ...aiFullfilled,
                      ...(item.missing_sub_indicators ?? []),
                    ];

                    const fulfilledCount = displaySubs.filter((s) =>
                      isSubFulfilled(s, aiFullfilled)
                    ).length;
                    const totalCount = displaySubs.length;
                    const fraction = `${fulfilledCount}/${totalCount}`;

                    return (
                      <div key={i} className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                              {item.theme}
                            </span>
                            <span className="font-bold text-xs text-slate-800 font-serif leading-tight">
                              {item.indicator}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 ml-2">
                            {fraction}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                          <p className="text-[11px] text-slate-500 leading-relaxed italic">
                            &ldquo;{item.reasoning}&rdquo;
                          </p>

                          <div className="space-y-1.5">
                            {displaySubs.map((si: string, idx: number) => {
                              const fulfilled = isSubFulfilled(si, aiFullfilled);
                              return (
                                <div
                                  key={idx}
                                  className={`flex items-start gap-2 p-2 rounded-xl ${
                                    fulfilled
                                      ? "bg-emerald-50/80 border border-emerald-100/50"
                                      : ""
                                  }`}
                                >
                                  <div className="mt-0.5 shrink-0">
                                    {fulfilled ? (
                                      <CheckCircle2 size={13} className="text-emerald-500" />
                                    ) : (
                                      <Circle size={13} className="text-slate-300" />
                                    )}
                                  </div>
                                  <span
                                    className={`text-[11px] leading-snug font-medium ${
                                      fulfilled ? "text-emerald-900" : "text-slate-400"
                                    }`}
                                  >
                                    {si}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
