import React from "react";
import { supabase } from "@/lib/supabase";
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  Heart,
  Brain,
  Zap,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { karakterData } from "@/lib/data/karakter";
import { mentalData } from "@/lib/data/mental";
import { softSkillData } from "@/lib/data/soft-skill";

async function getStudentRecap(id: string) {
  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  const { data: reports } = await supabase
    .from("reports")
    .select("treatment_plan")
    .eq("student_id", id);

  // Aggregate canonical fulfilled sub-indicators by category
  const fulfilledByCategory: Record<string, Set<string>> = {
    Karakter: new Set(),
    Mental: new Set(),
    "Soft Skill": new Set(),
  };

  const allDataByCategory: Record<
    string,
    { themes: { title: string; indicators: { title: string; sub_indicators: string[] }[] }[] }
  > = {
    Karakter: karakterData,
    Mental: mentalData,
    "Soft Skill": softSkillData,
  };

  const norm = (s: string) => s.trim().toLowerCase();

  const lookupFullIndicator = (
    category: string,
    themeTitle: string,
    indicatorTitle: string
  ): string[] | null => {
    const catData = allDataByCategory[category];
    if (!catData) return null;
    for (const theme of catData.themes) {
      if (norm(theme.title) !== norm(themeTitle)) continue;
      for (const ind of theme.indicators) {
        if (norm(ind.title) === norm(indicatorTitle)) {
          return ind.sub_indicators;
        }
      }
    }
    return null;
  };

  const isLikelySame = (candidate: string, target: string) => {
    const c = norm(candidate);
    const t = norm(target);
    return c === t || c.includes(t) || t.includes(c);
  };

  reports?.forEach((report) => {
    let plan = report.treatment_plan;
    if (typeof plan === "string") {
      try {
        plan = JSON.parse(plan);
      } catch (e) {
        return;
      }
    }

    if (plan && Array.isArray(plan.detailed_assessments)) {
      plan.detailed_assessments.forEach((assessment: any) => {
        const category = assessment.category as string;
        const bucket =
          fulfilledByCategory[category] ??
          fulfilledByCategory[Object.keys(fulfilledByCategory).find((k) => norm(k) === norm(category)) ?? ""];
        if (!bucket || !Array.isArray(assessment.fulfilled_sub_indicators)) return;

        const fullSubs = lookupFullIndicator(
          category,
          assessment.theme as string,
          assessment.indicator as string
        );
        if (!fullSubs) return;

        fullSubs.forEach((frameworkSub) => {
          if (assessment.fulfilled_sub_indicators.some((si: string) => isLikelySame(si, frameworkSub))) {
            bucket.add(norm(frameworkSub));
          }
        });
      });
    }
  });

  return { student, fulfilledByCategory, totalReports: reports?.length || 0 };
}

// Helper to check if a sub-indicator is fulfilled
function isFulfilled(subIndicator: string, fulfilledSet: Set<string>) {
  const normalized = subIndicator.trim().toLowerCase();
  return fulfilledSet.has(normalized);
}

export default async function RecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student, fulfilledByCategory, totalReports } = await getStudentRecap(id);

  if (!student)
    return <div className="p-10 text-center">Santri tidak ditemukan.</div>;

  const categories = [
    {
      key: "karakter",
      label: "Karakter",
      icon: Heart,
      color: "text-rose-500",
      bg: "bg-rose-50",
      progressBg: "bg-rose-400",
      data: karakterData,
    },
    {
      key: "mental",
      label: "Mental",
      icon: Brain,
      color: "text-blue-500",
      bg: "bg-blue-50",
      progressBg: "bg-blue-400",
      data: mentalData,
    },
    {
      key: "soft_skill",
      label: "Soft Skill",
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-50",
      progressBg: "bg-amber-400",
      data: softSkillData,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans max-w-4xl mx-auto border-x border-slate-100 shadow-2xl relative">
      <header className="bg-white/80 backdrop-blur-md px-6 pt-12 pb-6 border-b border-slate-200 flex items-center justify-between sticky top-0 z-40">
        <Link
          href={`/students/${student.id}`}
          className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-all"
        >
          <ChevronLeft className="w-6 h-6 text-slate-800" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">
            Rekapitulasi Pencapaian
          </p>
          <h1 className="text-sm font-bold text-slate-900">{student.name}</h1>
        </div>
        <div className="w-10" />
      </header>

      <main className="px-5 py-8 space-y-8">
        <section className="bg-emerald-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 mb-2">
              Total Laporan Dianalisis
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black">{totalReports}</span>
              <span className="text-sm font-bold text-emerald-200">
                Laporan
              </span>
            </div>
            <p className="text-xs text-emerald-100 mt-4 max-w-sm leading-relaxed opacity-80">
              Berikut adalah rekapitulasi permanen dari semua kriteria yang
              telah terpenuhi berdasarkan riwayat laporan observasi ananda.
            </p>
          </div>
        </section>

        <div className="space-y-6">
          {categories.map((cat) => {
            const Icon = cat.icon;

            // Calculate progress
            let totalSub = 0;
            let fulfilledSub = 0;

            cat.data.themes.forEach((theme) => {
              theme.indicators.forEach((ind) => {
                ind.sub_indicators.forEach((sub) => {
                  totalSub++;
                  const categorySet = fulfilledByCategory[cat.label] ?? new Set<string>();
                  if (isFulfilled(sub, categorySet)) fulfilledSub++;
                });
              });
            });

            const percentage =
              totalSub > 0 ? Math.round((fulfilledSub / totalSub) * 100) : 0;

            return (
              <details
                key={cat.key}
                className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden group [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="p-6 cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-between select-none">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-2xl ${cat.bg} ${cat.color} flex items-center justify-center`}
                    >
                      <Icon size={24} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">
                        {cat.label}
                      </h2>
                      <p className="text-xs font-bold text-slate-400 mt-1">
                        {fulfilledSub} dari {totalSub} Terpenuhi
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div className="hidden md:block w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${cat.progressBg}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className={`font-black ${cat.color} text-lg`}>
                      {percentage}%
                    </span>
                  </div>
                </summary>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-6">
                  {(() => {
                    const fulfilledThemes: any[] = [];
                    const unfulfilledThemes: any[] = [];

                    cat.data.themes.forEach((theme) => {
                      let hasFulfilled = false;
                      theme.indicators.forEach((ind) => {
                        ind.sub_indicators.forEach((sub) => {
                          const categorySet = fulfilledByCategory[cat.label] ?? new Set<string>();
                          if (isFulfilled(sub, categorySet)) {
                            hasFulfilled = true;
                          }
                        });
                      });
                      if (hasFulfilled) fulfilledThemes.push(theme);
                      else unfulfilledThemes.push(theme);
                    });

                    const ThemeCard = ({ theme, isUnfulfilled = false }: { theme: any, isUnfulfilled?: boolean }) => (
                      <div className={`bg-white p-5 rounded-[2rem] border shadow-sm ${isUnfulfilled ? "opacity-75 border-slate-200/60" : "border-slate-100"}`}>
                        <div className="mb-5 flex flex-col gap-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            Tema {theme.id}
                          </span>
                          <h3 className="text-[15px] font-bold text-slate-900 font-serif leading-tight">
                            {theme.title}
                          </h3>
                        </div>

                        <div className="space-y-5">
                          {theme.indicators.map((ind: any, iIdx: number) => {
                            // If this is a fulfilled theme, we optionally could filter out completely empty indicators,
                            // but keeping them preserves context. We will just visually dim the empty ones.
                            const categorySet = fulfilledByCategory[cat.label] ?? new Set<string>();
                            const hasAnyFulfilledSub = ind.sub_indicators.some((sub: string) => isFulfilled(sub, categorySet));
                            
                            return (
                              <div key={iIdx} className={`space-y-3 ${!hasAnyFulfilledSub && !isUnfulfilled ? "opacity-50" : ""}`}>
                                <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg inline-block border border-slate-100">
                                  {ind.title}
                                </h4>
                                <div className="space-y-1.5 pl-1">
                                  {ind.sub_indicators.map((sub: string, sIdx: number) => {
                                    const categorySet = fulfilledByCategory[cat.label] ?? new Set<string>();
                                    const fulfilled = isFulfilled(sub, categorySet);
                                    return (
                                      <div
                                        key={sIdx}
                                        className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                                          fulfilled ? "bg-emerald-50/80 border border-emerald-100/50 shadow-sm" : "hover:bg-slate-50"
                                        }`}
                                      >
                                        <div className="mt-0.5 shrink-0">
                                          {fulfilled ? (
                                            <CheckCircle2 size={16} className="text-emerald-500 drop-shadow-sm" />
                                          ) : (
                                            <Circle size={16} className="text-slate-200" />
                                          )}
                                        </div>
                                        <span
                                          className={`text-[13px] leading-snug font-medium ${
                                            fulfilled ? "text-emerald-900" : "text-slate-500"
                                          }`}
                                        >
                                          {sub}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );

                    return (
                      <>
                        {/* Fulfilled Themes */}
                        {fulfilledThemes.length > 0 ? (
                          fulfilledThemes.map((theme) => (
                            <ThemeCard key={theme.id} theme={theme} />
                          ))
                        ) : (
                          <div className="text-center p-8 bg-white rounded-[2rem] border border-dashed border-slate-200">
                            <p className="text-sm font-bold text-slate-400">Belum ada kriteria yang terpenuhi</p>
                          </div>
                        )}

                        {/* Unfulfilled Themes Toggle */}
                        {unfulfilledThemes.length > 0 && (
                          <details className="group/unfulfilled mt-6">
                            <summary className="cursor-pointer flex items-center justify-center gap-2 bg-slate-200/50 hover:bg-slate-200 transition-colors py-4 px-6 rounded-2xl text-xs font-black text-slate-500 uppercase tracking-widest select-none">
                              <span className="group-open/unfulfilled:hidden">Tampilkan {unfulfilledThemes.length} Tema Belum Terpenuhi</span>
                              <span className="hidden group-open/unfulfilled:inline">Sembunyikan Tema Belum Terpenuhi</span>
                            </summary>
                            <div className="pt-6 space-y-6">
                              {unfulfilledThemes.map((theme) => (
                                <ThemeCard key={theme.id} theme={theme} isUnfulfilled={true} />
                              ))}
                            </div>
                          </details>
                        )}
                      </>
                    );
                  })()}
                </div>
              </details>
            );
          })}
        </div>
      </main>
    </div>
  );
}
