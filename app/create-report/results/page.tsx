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
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center font-sans gap-4">
        <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center animate-bounce-in" style={{ boxShadow: "0 4px 0 0 #a7f3d0", border: "2px solid #d1fae5" }}>
          <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
        </div>
        <p className="text-emerald-600 text-xs font-black uppercase tracking-widest">Memuat Hasil…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col font-sans relative">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b-2 border-slate-100 px-5 py-4 flex items-center justify-between" style={{ boxShadow: "0 3px 0 0 #f1f5f9" }}>
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 flex-shrink-0 active:translate-y-px transition-transform"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        >
          <ArrowLeft size={16} />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-black text-slate-900">{studentName}</h1>
          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Asesmen Perkembangan</p>
        </div>
        <div className="w-9" />
      </header>

      <main className="flex-1 overflow-y-auto px-5 pt-5 pb-36 space-y-5">
        {/* 1. Status Summary */}
        <section
          className="bg-emerald-500 rounded-[2rem] p-7 text-white relative overflow-hidden"
          style={{ boxShadow: "0 6px 0 0 #15803d" }}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles size={80} />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/20 text-white mb-3">
              <Sparkles size={9} /> Kondisi Umum
            </div>
            <p className="text-xl font-black leading-snug mb-5">{analysisData.status_summary}</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(analysisData.overall_stats || {}).map(([key, stats]: [string, any]) => (
                <div key={key} className="bg-white/15 rounded-xl p-3 border border-white/20">
                  <p className="text-[8px] font-black uppercase text-white/70 mb-1">{key}</p>
                  <span className="text-xl font-black">{stats.percentage}%</span>
                  <div className="w-full h-1.5 bg-white/20 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-white rounded-full" style={{ width: `${stats.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. Priority Treatment */}
        {analysisData.treatment && (
          <section className="card-3d p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center" style={{ boxShadow: "0 2px 0 0 #d97706" }}>
                <Target className="text-amber-600" size={16} />
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Treatment Prioritas</span>
            </div>
            <div className="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-100">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-800 mb-2">{analysisData.treatment.priority_theme}</span>
              <h4 className="text-sm font-black text-slate-900 leading-snug mb-3">{analysisData.treatment.priority_indicator}</h4>
              <div className="space-y-1.5 mb-4">
                {analysisData.treatment.target_sub_indicators?.map((si: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-slate-600 font-bold">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                    {si}
                  </div>
                ))}
              </div>
              <div className="bg-white p-3 rounded-xl border-2 border-emerald-100">
                <p className="text-xs text-slate-600 leading-relaxed italic font-bold">{analysisData.treatment.action_plan}</p>
              </div>
            </div>
          </section>
        )}

        {/* 3. Detailed Fulfillment */}
        <section className="space-y-3">
          <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
            <Bookmark size={9} /> Detail Ketercapaian
          </div>
          {categories.map((cat) => {
            const items = analysisData.detailed_assessments?.filter((a: any) => a.category === cat) || [];
            if (items.length === 0) return null;
            const isOpen = expandedCategory === cat;
            const catColors: Record<string, { bg: string; icon: string; shadow: string }> = {
              Karakter:   { bg: "bg-rose-100",   icon: "text-rose-600",   shadow: "0 3px 0 0 #e11d48" },
              Mental:     { bg: "bg-blue-100",   icon: "text-blue-600",   shadow: "0 3px 0 0 #1d4ed8" },
              "Soft Skill": { bg: "bg-purple-100", icon: "text-purple-600", shadow: "0 3px 0 0 #7c3aed" },
            };
            const c = catColors[cat] || { bg: "bg-slate-100", icon: "text-slate-600", shadow: "0 3px 0 0 #94a3b8" };
            return (
              <div key={cat} className="card-3d overflow-hidden">
                <button
                  onClick={() => setExpandedCategory(isOpen ? null : cat)}
                  className="w-full flex items-center justify-between p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOpen ? "bg-emerald-500" : c.bg}`}
                      style={{ boxShadow: isOpen ? "0 3px 0 0 #15803d" : c.shadow }}>
                      {cat === "Karakter" && <Heart size={18} className={isOpen ? "text-white" : c.icon} />}
                      {cat === "Mental"   && <Brain size={18} className={isOpen ? "text-white" : c.icon} />}
                      {cat === "Soft Skill" && <Zap size={18} className={isOpen ? "text-white" : c.icon} />}
                    </div>
                    <span className="font-black text-slate-900 text-sm">{cat}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">{items.length}</span>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 space-y-4 border-t-2 border-slate-50 pt-4">
                    {items.map((item: any, i: number) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-400 block w-fit mb-1">{item.theme}</span>
                            <span className="font-black text-xs text-slate-800 leading-snug">{item.indicator}</span>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">{item.fulfillment_fraction}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border-2 border-slate-100 space-y-2">
                          <p className="text-[11px] text-slate-500 leading-relaxed italic font-bold">"{item.reasoning}"</p>
                          <div className="space-y-1">
                            {item.fulfilled_sub_indicators?.map((si: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 text-[10px] text-emerald-700 font-black">
                                <CheckCircle2 size={10} className="mt-0.5 flex-shrink-0" /> {si}
                              </div>
                            ))}
                            {item.missing_sub_indicators?.map((si: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 text-[10px] text-slate-400 font-bold">
                                <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-200 mt-0.5 flex-shrink-0" /> {si}
                              </div>
                            ))}
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
      <footer className="fixed bottom-0 left-0 right-0 flex justify-center items-end p-5 pb-6 bg-gradient-to-t from-[#f0fdf7] via-[#f0fdf7]/90 to-transparent z-40 pointer-events-none">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full max-w-sm rounded-2xl font-black text-base flex items-center justify-center gap-3 py-5 pointer-events-auto active:translate-y-1 transition-transform ${
            isSaving ? "bg-slate-300 text-slate-400 cursor-not-allowed" : "bg-emerald-500 text-white"
          }`}
          style={isSaving ? {} : { boxShadow: "0 4px 0 0 #15803d" }}
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
          {isSaving ? "Menyimpan…" : "Simpan Asesmen"}
        </button>
      </footer>
    </div>
  );
}
