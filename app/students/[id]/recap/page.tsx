/**
 * app/students/[id]/recap/page.tsx
 *
 * Rekapitulasi (summary) page — aggregates ALL of a student's reports into a
 * single view showing cumulative sub-indicator fulfillment across the full
 * CDS framework.
 *
 * Key concepts:
 *
 *   Sub-indicator counting
 *     For every report, every fulfilled sub-indicator is extracted from the
 *     `treatment_plan.detailed_assessments` JSONB. A Map<string, number> tracks
 *     how many reports fulfilled each sub-indicator (normalised to lowercase).
 *
 *   5-Phase CMS Classification (replaces the old Kuat / Lemah binary)
 *     Phase is determined by (count / totalReports) × 100 per sub-indicator,
 *     or (fulfilledSub / totalSub) × 100 at the category level.
 *     1. Instingtif / Mentah   1–20%    (raw, still unstable)
 *     2. Imitasi / Adaptasi   21–40%    (imitating the environment)
 *     3. Internalisasi        41–60%    (values beginning to absorb)
 *     4. Aktualisasi          61–80%    (consciously practised)
 *     5. Integrasi / Sempurna 81–100%   (fully integrated, reflexive)
 *
 *   RadarChart component (defined in this file)
 *     Pure SVG, rendered server-side. One chart per category (Karakter, Mental,
 *     Soft Skill). Each spoke = one theme; spoke length = % of sub-indicators
 *     fulfilled across all reports (any count ≥ 1 qualifies). Grid rings at
 *     25 / 50 / 75 / 100%. Labels show theme numbers (1, 2, … N).
 *
 * This is a React Server Component — all data fetching and chart generation
 * happen server-side. No client JS required for the charts.
 */
import React from "react";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  ChevronLeft,
  CheckCircle2,
  Heart,
  Brain,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { getCDSPhase } from "@/lib/cia-phases";
import Link from "next/link";
import { getFrameworkForOrganization, isSupplementaryTheme } from "@/lib/data/framework";
import { categoryDisplayLabel } from "@/lib/data/category-labels";

// ─── Theme Fulfillment Bar Chart ─────────────────────────────────────────────
// Replaces the radar chart. Shows only themes with ≥ 1 fulfilled sub-indicator
// as horizontal bars — readable at any density including very sparse data.
function FulfillmentBars({
  themes,
  countMap,
  accentColor,
  categoryLabel,
}: {
  themes: { id: number; title: string; indicators: { title: string; sub_indicators: string[] }[] }[];
  countMap: Map<string, number>;
  accentColor: string;
  categoryLabel: string;
}) {
  const catTitle = categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1);

  // Per-theme: count subs at Tumbuh/Kuat tier (>= 4) for bars
  const themeStats = themes.map((theme) => {
    let total = 0;
    let fulfilled = 0;
    theme.indicators.forEach((ind) => {
      ind.sub_indicators.forEach((sub) => {
        total++;
        if ((countMap.get(sub.trim().toLowerCase()) ?? 0) >= 4) fulfilled++;
      });
    });
    return { pct: total > 0 ? Math.round((fulfilled / total) * 100) : 0, fulfilled, total };
  });

  // Themes with at least 1 Benih sub (count 1–3), but ONLY if the theme
  // is NOT already shown in the tumbuh bars (i.e. has no Tumbuh/Kuat subs)
  const benihThemes = themes.filter((theme, i) =>
    themeStats[i].pct === 0 &&
    theme.indicators.some((ind) =>
      ind.sub_indicators.some((sub) => {
        const c = countMap.get(sub.trim().toLowerCase()) ?? 0;
        return c >= 1 && c < 4;
      })
    )
  );

  const fulfilledCount = themeStats.filter((s) => s.pct > 0).length;

  if (fulfilledCount === 0 && benihThemes.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs text-slate-400 font-bold">Belum ada tema yang terpenuhi</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden space-y-1">
      {/* ── Tumbuh/Kuat bars ── */}
      {fulfilledCount > 0 && (
        <>
          <p className="text-sm font-bold text-slate-600 mb-3">
            Ada {fulfilledCount} {categoryLabel} yang sedang tumbuh dalam diri ananda:
          </p>
          {themes.map((theme, i) => {
            const { pct, fulfilled, total } = themeStats[i];
            if (pct === 0) return null;
            return (
              <div key={i} className="flex items-center gap-3 py-1 min-w-0">
                <span
                  className="text-[10px] font-black w-5 text-right flex-shrink-0"
                  style={{ color: accentColor }}
                >
                  {theme.id}
                </span>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-[11px] font-bold text-slate-600 leading-snug mb-1 break-words">
                    {theme.title}
                  </p>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: accentColor, opacity: 0.8 }}
                    />
                  </div>
                </div>
                <span className="text-[11px] font-black flex-shrink-0 tabular-nums" style={{ color: accentColor }}>
                  {fulfilled}/{total}
                </span>
              </div>
            );
          })}
        </>
      )}

      {/* ── Benih list ── */}
      {benihThemes.length > 0 && (
        <div className={fulfilledCount > 0 ? "mt-5 pt-4 border-t border-slate-100" : ""}>
          {fulfilledCount === 0 && (
            <p className="text-sm font-bold text-slate-400 mb-2">
              Belum ada {categoryLabel} yang tumbuh dalam diri ananda:
            </p>
          )}
          <p className="text-sm font-bold text-slate-600 mb-2">
            {fulfilledCount === 0 ? "Namun, sudah ada" : "Dan ada"} {benihThemes.length} benih {categoryLabel} yang sudah nampak:
          </p>
          <div className="space-y-1">
            {benihThemes.map((theme) => (
              <div key={theme.id} className="flex items-center gap-2 py-0.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex-shrink-0">
                  {catTitle} no. {theme.id}
                </span>
                <span className="text-[11px] font-bold text-slate-600 leading-snug">
                  &ldquo;{theme.title}&rdquo;
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

async function getStudentRecap(id: string) {
  const db = await getServerSupabase();

  const { data: student } = await db
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  // Ordered oldest-first: declined_sub_indicators decrements the running
  // count floored at 0, so reports must be replayed in the same chronological
  // order they were created in — otherwise a decline could be processed
  // before the fulfillment it's regressing, clamping to 0 prematurely.
  const { data: reports } = await db
    .from("reports")
    .select("treatment_plan")
    .eq("student_id", id)
    .order("created_at", { ascending: true });

  // Aggregate canonical fulfilled sub-indicators by category.
  // Map value = number of reports in which the sub-indicator was fulfilled.
  const countByCategory: Record<string, Map<string, number>> = {
    Karakter: new Map(),
    Mental: new Map(),
    "Soft Skill": new Map(),
  };

  const framework = getFrameworkForOrganization(student?.organization_id ?? null);
  const allDataByCategory: Record<
    string,
    { themes: { title: string; indicators: { title: string; sub_indicators: string[] }[] }[] }
  > = {
    Karakter: framework.Karakter,
    Mental: framework.Mental,
    "Soft Skill": framework["Soft Skill"],
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
          countByCategory[category] ??
          countByCategory[Object.keys(countByCategory).find((k) => norm(k) === norm(category)) ?? ""];
        if (!bucket || !Array.isArray(assessment.fulfilled_sub_indicators)) return;

        const fullSubs = lookupFullIndicator(
          category,
          assessment.theme as string,
          assessment.indicator as string
        );
        if (!fullSubs) return;

        fullSubs.forEach((frameworkSub) => {
          if (assessment.fulfilled_sub_indicators.some((si: string) => isLikelySame(si, frameworkSub))) {
            const key = norm(frameworkSub);
            bucket.set(key, (bucket.get(key) ?? 0) + 1);
          }
        });

        // Character/mental/soft-skill growth isn't strictly linear — a report
        // can mark a sub-indicator as regressed (declined_sub_indicators),
        // undoing one prior fulfillment. Floored at 0: it can never make a
        // sub-indicator "fulfilled" a negative number of times.
        if (Array.isArray(assessment.declined_sub_indicators)) {
          fullSubs.forEach((frameworkSub) => {
            if (assessment.declined_sub_indicators.some((si: string) => isLikelySame(si, frameworkSub))) {
              const key = norm(frameworkSub);
              bucket.set(key, Math.max(0, (bucket.get(key) ?? 0) - 1));
            }
          });
        }
      });
    }
  });

  return { student, countByCategory, totalReports: reports?.length || 0 };
}

// Returns the number of reports in which this sub-indicator was fulfilled (0 = never).
function getSubCount(subIndicator: string, countMap: Map<string, number>): number {
  return countMap.get(subIndicator.trim().toLowerCase()) ?? 0;
}

// (Kuat/Lemah replaced by 5-phase system — see getCDSPhase in lib/cia-phases.ts)

export default async function RecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student, countByCategory, totalReports } = await getStudentRecap(id);

  if (!student)
    return <div className="p-10 text-center">Santri tidak ditemukan.</div>;

  const framework = getFrameworkForOrganization(student.organization_id ?? null);
  const categories = [
    {
      key: "karakter",
      label: "Karakter",
      icon: Heart,
      color: "text-rose-500",
      bg: "bg-rose-50",
      progressBg: "bg-rose-400",
      data: framework.Karakter,
      accentColor: "#f43f5e",
    },
    {
      key: "mental",
      label: "Mental",
      icon: Brain,
      color: "text-blue-500",
      bg: "bg-blue-50",
      progressBg: "bg-blue-400",
      data: framework.Mental,
      accentColor: "#3b82f6",
    },
    {
      key: "soft_skill",
      label: "Soft Skill",
      icon: Zap,
      color: "text-purple-500",
      bg: "bg-purple-50",
      progressBg: "bg-purple-400",
      data: framework["Soft Skill"],
      accentColor: "#a855f7",
    },
  ];

  return (
    <div className="min-h-screen bg-paper pb-20 font-sans max-w-4xl mx-auto relative">
      <header className="bg-white border-b-2 border-slate-100 px-5 pt-10 pb-4 flex items-center justify-between sticky top-0 z-40" style={{ boxShadow: "0 3px 0 0 #f1f5f9" }}>
        <Link
          href={`/students/${student.id}`}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 flex-shrink-0 active:translate-y-px transition-transform"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Rekapitulasi</p>
          <h1 className="text-sm font-black text-slate-900">{student.name}</h1>
        </div>
        <div className="w-9" />
      </header>

      <main className="px-5 py-6 space-y-6 overflow-x-hidden">
        {/* Summary card */}
        <section className="bg-slate-900 rounded-[2rem] p-7 text-white relative overflow-hidden" style={{ boxShadow: "0 6px 0 0 #000" }}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400 mb-2">
              Total Laporan Dianalisis
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black">{totalReports}</span>
              <span className="text-sm font-bold text-slate-400">
                Laporan
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-4 max-w-sm leading-relaxed">
              Persentase pertumbuhan CMS ini di simpulkan dari{" "}
              <span className="text-white font-black">{totalReports}</span>{" "}
              laporan yang masuk.
            </p>
          </div>
        </section>

        <div className="space-y-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const countMap = countByCategory[cat.label] ?? new Map<string, number>();

            // Progress = sub-indicators fulfilled at least once
            let totalSub = 0;
            let fulfilledSub = 0;

            cat.data.themes.forEach((theme) => {
              theme.indicators.forEach((ind) => {
                ind.sub_indicators.forEach((sub) => {
                  totalSub++;
                  const count = getSubCount(sub, countMap);
                  if (count >= 4) fulfilledSub++;
                });
              });
            });


            const percentage =
              totalSub > 0 ? parseFloat(((fulfilledSub / totalSub) * 100).toFixed(1)) : 0;

            return (
              <details suppressHydrationWarning
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
                        {categoryDisplayLabel(cat.label)}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-xs font-bold text-slate-400">
                          {fulfilledSub} dari {totalSub} Indikator Kuat
                        </p>
                      </div>
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
                      {String(percentage).replace('.', ',')}%
                    </span>
                  </div>
                </summary>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-6 overflow-x-hidden">
                  {/* Theme fulfillment bars */}
                  <div className="bg-white rounded-[2rem] border border-slate-100 p-6">
                    <FulfillmentBars
                      themes={cat.data.themes}
                      countMap={countMap}
                      accentColor={cat.accentColor}
                      categoryLabel={categoryDisplayLabel(cat.label).toLowerCase()}
                    />
                  </div>

                  {(() => {
                    const fulfilledThemes: any[] = [];
                    const unfulfilledThemes: any[] = [];

                    cat.data.themes.forEach((theme) => {
                      const hasFulfilled = theme.indicators.some((ind) =>
                        ind.sub_indicators.some((sub) => getSubCount(sub, countMap) >= 1)
                      );
                      if (hasFulfilled) fulfilledThemes.push(theme);
                      else unfulfilledThemes.push(theme);
                    });

                    const ThemeCard = ({ theme, isUnfulfilled = false }: { theme: any; isUnfulfilled?: boolean }) => {
                      // Theme-level phase: how many of this theme's sub-indicators are fulfilled?
                      let themeTotalSub = 0, themeFilledSub = 0;
                      theme.indicators.forEach((ind: any) => {
                        ind.sub_indicators.forEach((sub: string) => {
                          themeTotalSub++;
                          if (getSubCount(sub, countMap) >= 4) themeFilledSub++;
                        });
                      });
                      const themePhase = getCDSPhase(themeFilledSub, themeTotalSub);

                      // Only show indicators that have at least one fulfilled sub-indicator.
                      const visibleIndicators = theme.indicators
                        .map((ind: any) => ({
                          ...ind,
                          sub_indicators: ind.sub_indicators.filter(
                            (sub: string) => getSubCount(sub, countMap) >= 1
                          ),
                        }))
                        .filter((ind: any) => ind.sub_indicators.length > 0);

                      return (
                        <div className={`bg-white p-5 rounded-[2rem] border shadow-sm ${isUnfulfilled ? "opacity-75 border-slate-200/60" : "border-slate-100"}`}>
                          <div className="mb-5 flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                Tema {theme.id}
                              </span>
                              {themePhase && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider ${themePhase.bg} ${themePhase.border} ${themePhase.text}`}>
                                  {themePhase.index}. {themePhase.shortLabel}
                                </span>
                              )}
                              <span className="text-[9px] text-slate-400 font-bold ml-auto">
                                {themeFilledSub}/{themeTotalSub} kuat
                              </span>
                            </div>
                            <h3 className="text-[15px] font-bold text-slate-900 font-serif leading-tight">
                              {theme.title}
                            </h3>
                            {isSupplementaryTheme(
                              student.organization_id,
                              cat.label as "Karakter" | "Mental" | "Soft Skill",
                              theme.title,
                            ) && (
                              <span className="inline-flex w-fit items-center rounded-full bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                                BM400 · Tiga Pilar
                              </span>
                            )}
                            {themePhase && (
                              <div className={`mt-3 px-3.5 py-2.5 rounded-xl border ${themePhase.bg} ${themePhase.border}`}>
                                <p className={`text-[11px] font-bold ${themePhase.text}`}>
                                  {themeFilledSub} dari {themeTotalSub} indikator kuat / {Math.round((themeFilledSub / themeTotalSub) * 100)}%
                                </p>
                                <p className={`text-[11px] font-bold mt-1 ${themePhase.text}`}>
                                  Fase pertumbuhan {categoryDisplayLabel(cat.label).toLowerCase()} nya adalah &ldquo;{themePhase.narrativeLabel}&rdquo;
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                  Yaitu {themePhase.narrativeDescription.replace(/karakter/g, categoryDisplayLabel(cat.label).toLowerCase())}.
                                </p>
                              </div>
                            )}
                          </div>

                          {visibleIndicators.length === 0 ? (
                            <p className="text-[11px] text-slate-400 font-bold italic">
                              Belum ada sub-indikator yang terpenuhi pada tema ini.
                            </p>
                          ) : (
                            <div className="space-y-5">
                              {visibleIndicators.map((ind: any, iIdx: number) => (
                                <div key={iIdx} className="space-y-3">
                                  <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg inline-block border border-slate-100">
                                    {ind.title}
                                  </h4>
                                  <div className="space-y-1.5 pl-1">
                                    {ind.sub_indicators.map((sub: string, sIdx: number) => {
                                      const subCount = getSubCount(sub, countMap);
                                      const tier = subCount >= 7 ? "kuat" : subCount >= 4 ? "tumbuh" : "benih";
                                      const rowCls = tier === "kuat" ? "border-brand-200 bg-brand-50" : tier === "tumbuh" ? "border-amber-100/80 bg-amber-50/60" : "border-slate-100/80 bg-slate-50/50";
                                      const iconCls = tier === "kuat" ? "text-brand-500" : tier === "tumbuh" ? "text-amber-400" : "text-slate-300";
                                      const badgeCls = tier === "kuat" ? "bg-brand-500 text-white" : tier === "tumbuh" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500";
                                      const label = tier === "kuat" ? "Kuat" : tier === "tumbuh" ? "Tumbuh" : "Benih";
                                      return (
                                        <div key={sIdx} className={`flex items-start gap-3 p-2.5 rounded-xl border ${rowCls}`}>
                                          <CheckCircle2 size={15} className={`${iconCls} mt-0.5 shrink-0`} />
                                          <span className="flex-1 text-[13px] leading-snug font-medium text-slate-800">
                                            {sub}
                                          </span>
                                          <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${badgeCls}`}>
                                            {label} ({subCount}×)
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    };

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
                          <details suppressHydrationWarning className="group/unfulfilled mt-6">
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
