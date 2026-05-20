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

  // Aggregate all fulfilled sub-indicators
  const fulfilledSet = new Set<string>();

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
        if (Array.isArray(assessment.fulfilled_sub_indicators)) {
          assessment.fulfilled_sub_indicators.forEach((si: string) => {
            // Normalize for safer matching
            fulfilledSet.add(si.trim().toLowerCase());
          });
        }
      });
    }
  });

  return { student, fulfilledSet, totalReports: reports?.length || 0 };
}

// Helper to check if a sub-indicator is fulfilled
function isFulfilled(subIndicator: string, fulfilledSet: Set<string>) {
  const normalized = subIndicator.trim().toLowerCase();

  // Exact match
  if (fulfilledSet.has(normalized)) return true;

  // Fuzzy match (if AI truncated or slightly modified it)
  for (const fulfilled of fulfilledSet) {
    if (fulfilled.includes(normalized) || normalized.includes(fulfilled)) {
      return true;
    }
  }

  return false;
}

export default async function RecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student, fulfilledSet, totalReports } = await getStudentRecap(id);

  if (!student)
    return <div className="p-10 text-center">Student not found.</div>;

  const categories = [
    {
      key: "karakter",
      label: "Karakter",
      icon: Heart,
      color: "text-rose-500",
      bg: "bg-rose-50",
      data: karakterData,
    },
    {
      key: "mental",
      label: "Mental",
      icon: Brain,
      color: "text-blue-500",
      bg: "bg-blue-50",
      data: mentalData,
    },
    {
      key: "soft_skill",
      label: "Soft Skill",
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-50",
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
                  if (isFulfilled(sub, fulfilledSet)) fulfilledSub++;
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
                        className={`h-full ${cat.bg.replace("50", "400")}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className={`font-black ${cat.color} text-lg`}>
                      {percentage}%
                    </span>
                  </div>
                </summary>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-8">
                  {cat.data.themes.map((theme) => (
                    <div
                      key={theme.id}
                      className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm"
                    >
                      <div className="mb-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          Tema {theme.id}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 font-serif leading-tight mt-1">
                          {theme.title}
                        </h3>
                      </div>

                      <div className="space-y-6">
                        {theme.indicators.map((ind, iIdx) => (
                          <div key={iIdx} className="space-y-3">
                            <h4 className="text-sm font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-xl inline-block border border-slate-100">
                              {ind.title}
                            </h4>
                            <div className="space-y-2 pl-2">
                              {ind.sub_indicators.map((sub, sIdx) => {
                                const fulfilled = isFulfilled(
                                  sub,
                                  fulfilledSet,
                                );
                                return (
                                  <div
                                    key={sIdx}
                                    className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${fulfilled ? "bg-emerald-50/50" : "hover:bg-slate-50"}`}
                                  >
                                    <div className="mt-0.5 shrink-0">
                                      {fulfilled ? (
                                        <CheckCircle2
                                          size={16}
                                          className="text-emerald-500 drop-shadow-sm"
                                        />
                                      ) : (
                                        <Circle
                                          size={16}
                                          className="text-slate-300"
                                        />
                                      )}
                                    </div>
                                    <span
                                      className={`text-xs leading-relaxed font-medium ${fulfilled ? "text-emerald-800" : "text-slate-500"}`}
                                    >
                                      {sub}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </main>
    </div>
  );
}
