"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Save,
  Brain,
  Heart,
  Zap,
  Quote,
  Loader2,
  CheckCircle2,
  Bookmark,
  Target,
} from "lucide-react";
import { saveAssessmentAction } from "@/app/actions/save-assessment";

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    "Karakter",
  );
  const [showNarrative, setShowNarrative] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const studentId = searchParams.get("id");
  const studentName = searchParams.get("name") || "Santri";
  const [narrative, setNarrative] = useState("");
  const [analysisData, setAnalysisData] = useState<any>(null);

  useEffect(() => {
    const storedAnalysis = sessionStorage.getItem('current_analysis');
    const storedNarrative = sessionStorage.getItem('current_narrative');
    
    if (storedAnalysis) {
      try {
        setAnalysisData(JSON.parse(storedAnalysis));
      } catch (e) {
        console.error("Failed to parse stored analysis", e);
      }
    }
    
    if (storedNarrative) {
      setNarrative(storedNarrative);
    }
  }, []);

  const categories = ["Karakter", "Mental", "Soft Skill"];

  const getFulfillmentColor = (level: string) => {
    const l = level.toLowerCase();
    if (l.includes("membudaya")) return "bg-emerald-500 text-white";
    if (l.includes("berkembang")) return "bg-emerald-100 text-emerald-700";
    if (l.includes("tumbuh")) return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-500";
  };

  const handleSave = async () => {
    if (!studentId) return alert("ID santri tidak ditemukan");

    setIsSaving(true);
    const result = await saveAssessmentAction({
      student_id: studentId,
      narrative: narrative,
      analysis: analysisData,
    });

    if (result.success) {
      sessionStorage.removeItem('current_analysis');
      sessionStorage.removeItem('current_narrative');
      router.push("/students");
    } else {
      alert("Gagal menyimpan: " + result.error);
      setIsSaving(false);
    }
  };

  if (!analysisData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Memuat Hasil...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 text-slate-400">
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-bold text-slate-900">{studentName}</h1>
          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">
            Asesmen Perkembangan
          </p>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-40 space-y-6">
        {/* 1. Status Summary */}
        <section className="bg-emerald-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles size={80} />
          </div>
          <div className="relative z-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 mb-3">
              Kondisi Umum
            </h3>
            <p className="text-2xl font-bold leading-tight font-serif mb-4">
              {analysisData.status_summary}
            </p>

            {/* Fulfillment Overview */}
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(analysisData.overall_stats || {}).map(
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
                        {stats.percentage}%
                      </span>
                      <span className="text-[8px] opacity-60">
                        {stats.fulfilled}/{stats.total}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-white/20 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: `${stats.percentage}%` }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        {/* 2. Priority Treatment */}
        {analysisData.treatment && (
          <section className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Target className="text-emerald-600" size={18} />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Treatment Prioritas
              </h3>
            </div>
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
              <div className="flex flex-col mb-3">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">
                  {analysisData.treatment.priority_theme}
                </span>
                <h4 className="text-base font-bold text-slate-900 font-serif leading-tight">
                  {analysisData.treatment.priority_indicator}
                </h4>
              </div>

              <div className="space-y-2 mb-4">
                {analysisData.treatment.target_sub_indicators?.map(
                  (si: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-[11px] text-slate-600 font-medium"
                    >
                      <div className="w-1 h-1 rounded-full bg-emerald-400" />
                      {si}
                    </div>
                  ),
                )}
              </div>

              <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                <p className="text-xs text-slate-700 leading-relaxed italic">
                  {analysisData.treatment.action_plan}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 3. Detailed Fulfillment */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 mb-2 px-2">
            <Bookmark className="text-slate-400" size={14} />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Detail Ketercapaian
            </h3>
          </div>
          {categories.map((cat) => {
            const items =
              analysisData.detailed_assessments?.filter(
                (a: any) => a.category === cat,
              ) || [];
            if (items.length === 0) return null;

            return (
              <div
                key={cat}
                className="overflow-hidden bg-white rounded-4xl border border-slate-100 shadow-sm"
              >
                <button
                  onClick={() =>
                    setExpandedCategory(expandedCategory === cat ? null : cat)
                  }
                  className="w-full flex items-center justify-between p-5"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2.5 rounded-xl ${expandedCategory === cat ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}
                    >
                      {cat === "Karakter" && <Heart size={18} />}
                      {cat === "Mental" && <Brain size={18} />}
                      {cat === "Soft Skill" && <Zap size={18} />}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{cat}</h4>
                  </div>
                  {expandedCategory === cat ? (
                    <ChevronUp size={18} className="text-slate-300" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-300" />
                  )}
                </button>

                {expandedCategory === cat && (
                  <div className="px-5 pb-5 space-y-4">
                    {items.map((item: any, i: number) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                              {item.theme}
                            </span>
                            <span className="font-bold text-xs text-slate-800 font-serif leading-tight">
                              {item.indicator}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {item.fulfillment_fraction}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-3">
                          <p className="text-[11px] text-slate-500 leading-relaxed italic">
                            "{item.reasoning}"
                          </p>

                          <div className="space-y-1">
                            {item.fulfilled_sub_indicators?.map(
                              (si: string, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2 text-[10px] text-emerald-700 font-bold"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {si}
                                </div>
                              ),
                            )}
                            {item.missing_sub_indicators?.map(
                              (si: string, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2 text-[10px] text-slate-400"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                  {si}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 flex justify-center items-center p-6 bg-linear-to-t from-slate-50 via-slate-50/90 to-transparent z-40">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full max-w-sm px-5 transition-all text-white py-5 rounded-4xl font-bold flex items-center justify-center gap-3 shadow-xl 
            ${isSaving ? "bg-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-200"}`}
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {isSaving ? "Menyimpan..." : "Simpan Asesmen"}
        </button>
      </footer>
    </div>
  );
}
