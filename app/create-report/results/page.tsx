"use client";

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Sparkles, ChevronDown, ChevronUp, 
  Save, Brain, Heart, Zap, Quote, 
  Loader2
} from 'lucide-react';
import { saveAssessmentAction } from '@/app/actions/save-assessment';

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Karakter");
  const [showNarrative, setShowNarrative] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

const studentId = searchParams.get('id');
  const studentName = searchParams.get('name') || "Student";
  const narrative = searchParams.get('narrative') || "";
  const analysisData = JSON.parse(searchParams.get('analysis') || '{"scores": [], "treatment": ""}');

  const categories = ["Karakter", "Mental", "Soft Skill"];
  const summary = categories.map(cat => {
    const relevant = analysisData.scores.filter((s: any) => s.category === cat);
    const scoreSum = relevant.reduce((acc: number, curr: any) => acc + curr.score, 0);
    const maxPossible = relevant.length * 5;
    const percentage = maxPossible > 0 ? Math.round((scoreSum / maxPossible) * 100) : 0;
    
    return { name: cat, percentage, scoreSum, maxPossible, count: relevant.length, items: relevant };
  });

  const handleSave = async () => {
    if (!studentId) return alert("Student ID missing");
    
    setIsSaving(true);
    const result = await saveAssessmentAction({
      student_id: studentId,
      narrative: narrative,
      scores: analysisData.scores,
      treatment: analysisData.treatment
    });

    if (result.success) {
      router.push('/students'); // Or wherever your success destination is
    } else {
      alert("Failed to save: " + result.error);
      setIsSaving(false);
    }
  };

  return (
    // Max-w-md here ensures the entire app stays in the "phone" container
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans max-w-md mx-auto relative border-x border-slate-100 shadow-2xl">
      
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 text-slate-400"><ArrowLeft size={20}/></button>
        <div className="text-center">
          <h1 className="text-sm font-bold text-slate-900">{studentName}</h1>
          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Assessment Report</p>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-40 space-y-6">
        
        {/* 1. COLLAPSIBLE NARRATIVE (The "Reminder") */}
        <section className="bg-emerald-50/50 rounded-3xl border border-emerald-100 overflow-hidden">
          <button 
            onClick={() => setShowNarrative(!showNarrative)}
            className="w-full flex items-center justify-between p-4 text-emerald-700"
          >
            <div className="flex items-center gap-2">
              <Quote size={16} />
              <span className="text-xs font-bold uppercase tracking-wide">Review Narrative</span>
            </div>
            {showNarrative ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
          {showNarrative && (
            <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-sm text-emerald-900/70 leading-relaxed italic bg-white/50 p-4 rounded-2xl border border-emerald-100/50">
                "{narrative}"
              </p>
            </div>
          )}
        </section>

        {/* 2. DASHBOARD SUMMARY */}
        <section className="bg-white rounded-[2.5rem] p-5 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center">
            {summary.map((cat) => (
              <div key={cat.name} className="flex-1 flex flex-col items-center border-r last:border-r-0 border-slate-50 px-1">
                <div className="relative flex items-center justify-center mb-2">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-50" />
                    <circle 
                      cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="3.5" fill="transparent" 
                      strokeDasharray={131.9} 
                      strokeDashoffset={131.9 - (131.9 * cat.percentage) / 100}
                      className={`${cat.percentage >= 70 ? 'text-emerald-500' : 'text-amber-500'} transition-all duration-700 stroke-round`} 
                    />
                  </svg>
                  <span className="absolute text-[10px] font-black text-slate-800">{cat.percentage}%</span>
                </div>
                <h3 className="text-[8px] uppercase font-black tracking-tighter text-slate-400 mb-0.5">{cat.name}</h3>
                <div className="flex items-baseline gap-0.5 text-slate-900">
                  <span className="text-xs font-black">{cat.scoreSum}</span>
                  <span className="text-[9px] font-bold text-slate-300">/{cat.maxPossible}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. DRILL-DOWN ACCORDIONS */}
        <section className="space-y-3">
          {summary.map((cat) => (
            <div key={cat.name} className="overflow-hidden bg-white rounded-[2rem] border border-slate-100 shadow-sm">
              <button 
                onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                className="w-full flex items-center justify-between p-5"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl ${expandedCategory === cat.name ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {cat.name === "Karakter" && <Heart size={18} />}
                    {cat.name === "Mental" && <Brain size={18} />}
                    {cat.name === "Soft Skill" && <Zap size={18} />}
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-slate-900 text-sm">{cat.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cat.count} Points Found</p>
                  </div>
                </div>
                {expandedCategory === cat.name ? <ChevronUp size={18} className="text-slate-300"/> : <ChevronDown size={18} className="text-slate-300"/>}
              </button>

              {expandedCategory === cat.name && (
                <div className="px-5 pb-5 space-y-3">
                  {cat.items.map((item: any, i: number) => (
                    <div key={i} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-xs text-slate-800 pr-4">{item.code}: {item.title}</span>
                        <span className="font-black text-[10px] bg-white px-2 py-1 rounded-lg border text-emerald-600">{item.score}/5</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed italic border-l-2 border-emerald-100 pl-3">"{item.reason}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        {/* 4. AI RECOMMENDATION */}
        <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">AI Recommendation</h3>
            </div>
            <p className="text-base font-medium leading-relaxed italic text-slate-100">
              {analysisData.treatment}
            </p>
          </div>
        </section>
      </main>

      {/* FIXED FOOTER: Inside the phone container */}
      <footer className="fixed z-20 bottom-0 left-0 right-0 flex justify-center items-center p-6 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={`pointer-events-auto w-full max-w-sm px-5 transition-all text-white py-5 rounded-[2rem] font-bold flex items-center justify-center gap-3 shadow-xl 
            ${isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-200'}`}
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {isSaving ? "Saving..." : "Save Assessment"}
        </button>
      </footer>
    </div>
  );
}