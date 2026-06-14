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
  Flame,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { karakterData } from "@/lib/data/karakter";
import { mentalData } from "@/lib/data/mental";
import { softSkillData } from "@/lib/data/soft-skill";

// ─── Radar Chart ──────────────────────────────────────────────────────────────
function RadarChart({
  themes,
  countMap,
  accentColor,
  fillColor,
  label,
}: {
  themes: { id: number; title: string; indicators: { title: string; sub_indicators: string[] }[] }[];
  countMap: Map<string, number>;
  accentColor: string;
  fillColor: string;
  label: string;
}) {
  const n = themes.length;
  const cx = 220;
  const cy = 220;
  const r = 160;        // max spoke radius (= 100%)
  const labelR = 185;   // number label distance from centre

  // Per-theme fulfilled percentage (any count ≥ 1 counts)
  const pcts = themes.map((theme) => {
    let total = 0;
    let fulfilled = 0;
    theme.indicators.forEach((ind) => {
      ind.sub_indicators.forEach((sub) => {
        total++;
        if ((countMap.get(sub.trim().toLowerCase()) ?? 0) >= 1) fulfilled++;
      });
    });
    return total > 0 ? fulfilled / total : 0;
  });

  const angle = (i: number) => (2 * Math.PI * i) / n - Math.PI / 2;

  // Point at a given fraction along spoke i
  const pt = (i: number, frac: number) => ({
    x: cx + r * frac * Math.cos(angle(i)),
    y: cy + r * frac * Math.sin(angle(i)),
  });

  // Closed polygon string for a given fraction (grid rings)
  const ring = (frac: number) =>
    Array.from({ length: n }, (_, i) => {
      const p = pt(i, frac);
      return `${p.x},${p.y}`;
    }).join(" ");

  const dataPolygon = pcts
    .map((pct, i) => {
      const p = pt(i, pct);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  const fontSize = n > 25 ? 7.5 : n > 15 ? 9 : 11;

  return (
    <div className="w-full">
      {/* Chart */}
      <svg viewBox="0 0 440 440" className="w-full max-w-xs mx-auto block">
        {/* Grid rings at 25 / 50 / 75 / 100 % */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <polygon
            key={frac}
            points={ring(frac)}
            fill="none"
            stroke={frac === 1 ? "#cbd5e1" : "#e2e8f0"}
            strokeWidth={frac === 1 ? 1.5 : 1}
            strokeDasharray={frac < 1 ? "3 3" : undefined}
          />
        ))}

        {/* Percentage labels on top spoke */}
        {[
          { frac: 0.25, label: "25%" },
          { frac: 0.5, label: "50%" },
          { frac: 0.75, label: "75%" },
          { frac: 1, label: "100%" },
        ].map(({ frac, label: l }) => {
          const p = pt(0, frac);
          return (
            <text
              key={frac}
              x={p.x + 4}
              y={p.y}
              fontSize={7}
              fill="#94a3b8"
              fontWeight="600"
              dominantBaseline="middle"
            >
              {l}
            </text>
          );
        })}

        {/* Spokes */}
        {Array.from({ length: n }, (_, i) => {
          const end = pt(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          );
        })}

        {/* Filled data polygon */}
        <polygon
          points={dataPolygon}
          fill={fillColor}
          stroke={accentColor}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Dots at each data point (only if > 0) */}
        {pcts.map((pct, i) => {
          if (pct === 0) return null;
          const p = pt(i, pct);
          return (
            <circle key={i} cx={p.x} cy={p.y} r={3} fill={accentColor} />
          );
        })}

        {/* Spoke number labels */}
        {Array.from({ length: n }, (_, i) => {
          const a = angle(i);
          const lx = cx + labelR * Math.cos(a);
          const ly = cy + labelR * Math.sin(a);
          return (
            <text
              key={i}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={fontSize}
              fontWeight="800"
              fill="#475569"
            >
              {i + 1}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-4 px-1">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">
          Keterangan Tema
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {themes.map((theme, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span
                className="text-[10px] font-black shrink-0 min-w-[20px]"
                style={{ color: accentColor }}
              >
                {i + 1}.
              </span>
              <span className="text-[10px] text-slate-600 leading-tight">
                {theme.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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

  // Aggregate canonical fulfilled sub-indicators by category.
  // Map value = number of reports in which the sub-indicator was fulfilled.
  const countByCategory: Record<string, Map<string, number>> = {
    Karakter: new Map(),
    Mental: new Map(),
    "Soft Skill": new Map(),
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
      });
    }
  });

  return { student, countByCategory, totalReports: reports?.length || 0 };
}

// Returns the number of reports in which this sub-indicator was fulfilled (0 = never).
function getSubCount(subIndicator: string, countMap: Map<string, number>): number {
  return countMap.get(subIndicator.trim().toLowerCase()) ?? 0;
}

// ≥ 3 = kuat, 1–2 = lemah, 0 = unfulfilled
type SubStrength = "kuat" | "lemah" | "unfulfilled";
function getStrength(count: number): SubStrength {
  if (count >= 3) return "kuat";
  if (count >= 1) return "lemah";
  return "unfulfilled";
}

export default async function RecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student, countByCategory, totalReports } = await getStudentRecap(id);

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
      accentColor: "#f43f5e",
      fillColor: "rgba(244,63,94,0.15)",
    },
    {
      key: "mental",
      label: "Mental",
      icon: Brain,
      color: "text-blue-500",
      bg: "bg-blue-50",
      progressBg: "bg-blue-400",
      data: mentalData,
      accentColor: "#3b82f6",
      fillColor: "rgba(59,130,246,0.15)",
    },
    {
      key: "soft_skill",
      label: "Soft Skill",
      icon: Zap,
      color: "text-purple-500",
      bg: "bg-purple-50",
      progressBg: "bg-purple-400",
      data: softSkillData,
      accentColor: "#a855f7",
      fillColor: "rgba(168,85,247,0.15)",
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
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Rekapitulasi</p>
          <h1 className="text-sm font-black text-slate-900">{student.name}</h1>
        </div>
        <div className="w-9" />
      </header>

      <main className="px-5 py-6 space-y-6">
        {/* Summary card */}
        <section className="bg-slate-900 rounded-[2rem] p-7 text-white relative overflow-hidden" style={{ boxShadow: "0 6px 0 0 #000" }}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2">
              Total Laporan Dianalisis
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black">{totalReports}</span>
              <span className="text-sm font-bold text-slate-400">
                Laporan
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-4 max-w-sm leading-relaxed">
              Rekapitulasi permanen semua kriteria yang telah terpenuhi
              berdasarkan riwayat laporan observasi ananda.
            </p>
          </div>
        </section>

        {/* Legend */}
        <div className="flex items-center gap-3 px-1 flex-wrap">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Keterangan:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
            <Flame size={10} className="text-emerald-600" />
            Kuat ≥ 3×
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-black uppercase tracking-wider">
            <TrendingUp size={10} className="text-amber-600" />
            Lemah 1–2×
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-wider">
            <Circle size={10} />
            Belum
          </span>
        </div>

        <div className="space-y-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const countMap = countByCategory[cat.label] ?? new Map<string, number>();

            // Progress = sub-indicators fulfilled at least once
            let totalSub = 0;
            let fulfilledSub = 0;
            let kuatSub = 0;

            cat.data.themes.forEach((theme) => {
              theme.indicators.forEach((ind) => {
                ind.sub_indicators.forEach((sub) => {
                  totalSub++;
                  const count = getSubCount(sub, countMap);
                  if (count >= 1) fulfilledSub++;
                  if (count >= 3) kuatSub++;
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
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-xs font-bold text-slate-400">
                          {fulfilledSub} dari {totalSub} Terpenuhi
                        </p>
                        {kuatSub > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wider">
                            <Flame size={8} />
                            {kuatSub} Kuat
                          </span>
                        )}
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
                      {percentage}%
                    </span>
                  </div>
                </summary>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-6">
                  {/* Radar chart */}
                  <div className="bg-white rounded-[2rem] border border-slate-100 p-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                      Diagram Radian — {cat.label}
                    </p>
                    <RadarChart
                      themes={cat.data.themes}
                      countMap={countMap}
                      accentColor={cat.accentColor}
                      fillColor={cat.fillColor}
                      label={cat.label}
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

                    const ThemeCard = ({ theme, isUnfulfilled = false }: { theme: any; isUnfulfilled?: boolean }) => (
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
                            const hasAnyFulfilledSub = ind.sub_indicators.some(
                              (sub: string) => getSubCount(sub, countMap) >= 1
                            );

                            return (
                              <div key={iIdx} className={`space-y-3 ${!hasAnyFulfilledSub && !isUnfulfilled ? "opacity-50" : ""}`}>
                                <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg inline-block border border-slate-100">
                                  {ind.title}
                                </h4>
                                <div className="space-y-1.5 pl-1">
                                  {ind.sub_indicators.map((sub: string, sIdx: number) => {
                                    const count = getSubCount(sub, countMap);
                                    const strength = getStrength(count);

                                    const rowStyle =
                                      strength === "kuat"
                                        ? "bg-emerald-50/80 border border-emerald-100/50 shadow-sm"
                                        : strength === "lemah"
                                        ? "bg-amber-50/70 border border-amber-100/50"
                                        : "hover:bg-slate-50";

                                    return (
                                      <div
                                        key={sIdx}
                                        className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${rowStyle}`}
                                      >
                                        <div className="mt-0.5 shrink-0">
                                          {strength === "kuat" ? (
                                            <CheckCircle2 size={16} className="text-emerald-500 drop-shadow-sm" />
                                          ) : strength === "lemah" ? (
                                            <CheckCircle2 size={16} className="text-amber-400" />
                                          ) : (
                                            <Circle size={16} className="text-slate-200" />
                                          )}
                                        </div>
                                        <span
                                          className={`flex-1 text-[13px] leading-snug font-medium ${
                                            strength === "kuat"
                                              ? "text-emerald-900"
                                              : strength === "lemah"
                                              ? "text-amber-900"
                                              : "text-slate-500"
                                          }`}
                                        >
                                          {sub}
                                        </span>
                                        {strength === "kuat" && (
                                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider">
                                            <Flame size={8} />
                                            Kuat
                                          </span>
                                        )}
                                        {strength === "lemah" && (
                                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-white text-[9px] font-black uppercase tracking-wider">
                                            <TrendingUp size={8} />
                                            Lemah
                                          </span>
                                        )}
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
