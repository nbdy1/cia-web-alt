/**
 * app/reports/[id]/page.tsx
 *
 * Individual report detail page — read-only view of a single saved assessment.
 *
 * The report's `treatment_plan` JSONB column contains the full structured
 * analysis produced by finalizeAssessment(). This page parses that JSON and
 * renders:
 *   1. Report title + creation date
 *   2. Status summary (qualitative overview)
 *   3. Overall stats per category (Karakter / Mental / Soft Skill %)
 *   4. Priority treatment plan (focus indicator + action plan)
 *   5. Detailed per-category breakdowns with fulfilled sub-indicators only
 *      and per-indicator fulfillment fractions
 *
 * This is a React Server Component — data is fetched at request time.
 * ReportBackButton provides context-aware back navigation (admin vs. ustadz).
 */
import React from "react";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  Calendar,
  Quote,
  Lightbulb,
  BarChart3,
  Brain,
  Heart,
  Zap,
  Cpu,
} from "lucide-react";
import { karakterData } from "@/lib/data/karakter";
import { mentalData } from "@/lib/data/mental";
import { softSkillData } from "@/lib/data/soft-skill";
import { SmartBackButton } from "@/components/SmartBackButton";
import { FulfilledSubsList } from "@/components/FulfilledSubsList";
import { getModelLabel } from "@/lib/data/models";
import { StudentAvatar } from "@/components/StudentAvatar";

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

function getFulfilledDisplaySubs(item: any): string[] {
  const fulfilledSubs: string[] = item.fulfilled_sub_indicators ?? [];
  const fullSubs = lookupFullIndicator(item.category, item.theme, item.indicator);

  if (!fullSubs) return fulfilledSubs;

  return fullSubs.filter((sub) => isSubFulfilled(sub, fulfilledSubs));
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
        ind.sub_indicators.forEach(() => {
          total++;
        });
      });
    });

    const fulfilled = canonicalFulfilled.size;
    result[cat.toLowerCase().replace(" ", " ")] = {
      fulfilled,
      total,
      percentage: total > 0 ? Math.round((fulfilled / total) * 10000) / 100 : 0,
    };
  });

  return result;
}


async function getReportDetails(id: string) {
  const db = await getServerSupabase();

  const { data: report } = await db
    .from("reports")
    .select(`*, students(name, photo_url)`)
    .eq("id", id)
    .single();

  return { report };
}

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string | string[] }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const { report } = await getReportDetails(id);
  const rawFrom = resolvedSearchParams?.from;
  const from = Array.isArray(rawFrom) ? rawFrom[0] : rawFrom;

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
    <div className="min-h-screen bg-paper pb-24 font-sans relative">
      {/* Sticky Header */}
      <header className="bg-white border-b-2 border-slate-100 px-5 pt-10 pb-4 flex items-center justify-between sticky top-0 z-30" style={{ boxShadow: "0 3px 0 0 #f1f5f9" }}>
        <SmartBackButton
          fallbackHref={from || `/students/${report.student_id}`}
          preferHistory={false}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 flex-shrink-0"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        />
        <div className="text-center">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Laporan</p>
          <h1 className="text-sm font-black text-slate-900">{report.students.name}</h1>
          <div className="flex items-center justify-center gap-1 mt-1">
            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              <Cpu size={8} /> {getModelLabel(report.model_used)}
            </span>
          </div>
        </div>
        <div className="w-9" />
      </header>

      <main className="px-5 py-6 space-y-6">
        {/* 0. STUDENT HERO */}
        <div className="flex flex-col items-center gap-3 pt-2 pb-2">
          <StudentAvatar
            name={report.students.name}
            photoUrl={(report.students as any).photo_url ?? null}
            size="xl"
            colorIndex={0}
            className="w-28 h-28 rounded-[2rem]"
            style={{ boxShadow: "0 6px 0 0 #a7f3d0" }}
          />
          <div className="text-center">
            <h2 className="text-xl font-black text-slate-900 leading-tight">{report.students.name}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              {new Date(report.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* 1. OVERALL PROGRESS */}
        <section className="bg-slate-900 rounded-[2rem] p-7 text-white relative overflow-hidden" style={{ boxShadow: "0 6px 0 0 #000" }}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <BarChart3 size={80} />
          </div>
          <div className="relative z-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-3">
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
                        {(stats.percentage || 0).toFixed(1).replace('.', ',')}%
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

        <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 relative" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
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
                        className={`max-w-[90%] px-4 py-3 ${
                          isGuru
                            ? "bg-emerald-500 text-white rounded-[1.4rem] rounded-br-md"
                            : "bg-slate-100 text-slate-700 rounded-[1.4rem] rounded-bl-md"
                        }`}
                        style={isGuru ? { boxShadow: "0 3px 0 0 #15803d" } : {}}
                      >
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
                          {isGuru ? "Ustadz" : "Asisten CIA"}
                        </p>
                        <p className="text-sm leading-relaxed font-bold">
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
          <section className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 space-y-4" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
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

          {(() => {
            const categoryBlocks = categories.map((cat) => {
              const items = (
                analysis.detailed_assessments?.filter(
                  (a: any) => a.category === cat,
                ) || []
              ).filter((item: any) => getFulfilledDisplaySubs(item).length > 0);
              if (items.length === 0) return null;

              return (
                <div
                  key={cat}
                  className="bg-white rounded-[2rem] border-2 border-slate-100 overflow-hidden"
                  style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}
                >
                  <div className="flex items-center gap-3 p-5 border-b border-slate-50">
                    <div
                      className={`p-2.5 rounded-xl ${cat === "Karakter" ? "bg-rose-50 text-rose-500" : cat === "Mental" ? "bg-blue-50 text-blue-500" : "bg-purple-50 text-purple-500"}`}
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

                      const displaySubs = getFulfilledDisplaySubs(item);
                      const totalCount = fullSubs?.length ?? displaySubs.length;
                      const fulfilledCount = displaySubs.length;
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

                            <FulfilledSubsList
                              reportId={report.id}
                              category={item.category}
                              theme={item.theme}
                              indicator={item.indicator}
                              subs={displaySubs}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });

            const hasAny = categoryBlocks.some(Boolean);
            if (!hasAny) {
              return (
                <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-8 flex flex-col items-center gap-3 text-center" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <BarChart3 size={22} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-400 leading-snug">
                    Tidak ada pencapaian karakter, mental, ataupun soft skill di laporan ini.
                  </p>
                </div>
              );
            }

            return categoryBlocks;
          })()}
        </section>
      </main>
    </div>
  );
}
