import React from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ChevronLeft, Calendar, Quote, Lightbulb, 
  BarChart3, Brain, Heart, Zap, Info, Circle, ChevronDown
} from 'lucide-react';
import Link from 'next/link';

async function getReportDetails(id: string) {
  // Fetch both the report and the master pillar list simultaneously
  const [reportRes, masterRes] = await Promise.all([
    supabase
      .from('reports')
      .select(`*, students(name), report_scores(*)`)
      .eq('id', id)
      .single(),
    supabase
      .from('assessment_pillars')
      .select('pillar_id, pillar_title, category')
  ]);

  return {
    report: reportRes.data,
    masterPillars: masterRes.data || []
  };
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const {report, masterPillars} = await getReportDetails(id);

  if (!report) return <div className="p-10 text-center text-slate-500">Report not found.</div>;

const observedIds = new Set(report.report_scores.map((s: any) => s.pillar_id));
  const unobservedPillars = masterPillars.filter(p => !observedIds.has(p.pillar_id));

  const categories = ["Karakter", "Mental", "Soft Skill"];
  
  const summaries = categories.map(cat => {
  const found = report.report_scores.filter((s: any) => s.category === cat);
  
  // Sum of all scores in this category (e.g., 4 + 3 + 5 = 12)
  const totalPoints = found.reduce((a: number, b: any) => a + b.score, 0);
  
  // Total potential points (e.g., 3 pillars * 5 max score = 15)
  const potentialPoints = found.length * 5;
  
  const avg = found.length > 0 ? (totalPoints / found.length).toFixed(1) : "0.0";
  
  return { 
    name: cat, 
    avg, 
    points: totalPoints, 
    max: potentialPoints, 
    count: found.length 
  };
});

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Sticky Header */}
      <header className="bg-white/80 backdrop-blur-md px-6 pt-12 pb-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-30">
        <Link href={`/students/${report.student_id}`} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-all">
          <ChevronLeft className="w-6 h-6 text-slate-800" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Diagnostic Session</p>
          <h1 className="text-sm font-bold text-slate-900">{report.students.name}</h1>
        </div>
        <div className="w-10" />
      </header>

      <main className="px-6 py-8 space-y-6 max-w-2xl mx-auto">
        
        {/* 1. NARRATIVE CONTEXT (Primary Focus) */}
        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative">
          <Quote className="absolute top-6 left-6 w-8 h-8 text-slate-50" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">The Narrative</h3>
          <p className="text-sm text-slate-700 leading-relaxed italic relative z-10">
            "{report.narrative}"
          </p>
          <div className="mt-6 flex items-center gap-2 text-slate-300">
            <Calendar size={12} />
            <span className="text-[9px] font-bold uppercase tracking-tighter">
              {new Date(report.created_at).toLocaleDateString('id-ID', { dateStyle: 'full' })}
            </span>
          </div>
        </section>

        {/* 2. OVERALL SCORECARD */}
        <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 grid grid-cols-3 gap-4">
        {summaries.map((s) => (
    <div key={s.name} className="text-center space-y-2">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{s.name}</p>
      
      {/* The Large Average */}
      <p className="text-3xl font-black text-slate-900 leading-none">{s.avg}</p>
      
      {/* The Fraction: Points / Max Possible */}
      <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 rounded-full border border-slate-100">
        <span className="text-[10px] font-black text-emerald-600">{s.points}</span>
        <span className="text-[8px] font-bold text-slate-300">/</span>
        <span className="text-[10px] font-bold text-slate-400">{s.max}</span>
      </div>
      
      <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
        {s.count} Pillars
      </p>
    </div>
  ))}
        </section>

        {/* 3. COLLAPSIBLE CATEGORY ANALYSIS */}
        <section className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
            <BarChart3 className="w-4 h-4" /> Detected Pillars
          </h3>
          
          {categories.map((cat) => {
            const scores = report.report_scores.filter((s: any) => s.category === cat);
            if (scores.length === 0) return null;

            return (
              <details key={cat} className="group bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden" open>
                <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${cat === "Karakter" ? "bg-rose-50 text-rose-500" : cat === "Mental" ? "bg-blue-50 text-blue-500" : "bg-amber-50 text-amber-500"}`}>
                      {cat === "Karakter" && <Heart size={18} />}
                      {cat === "Mental" && <Brain size={18} />}
                      {cat === "Soft Skill" && <Zap size={18} />}
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">{cat} Analysis</h4>
                  </div>
                  <ChevronDown size={18} className="text-slate-300 group-open:rotate-180 transition-transform" />
                </summary>
                
                <div className="px-5 pb-5 grid gap-3 border-t border-slate-50 pt-4">
                  {scores.map((s: any) => (
                    <div key={s.id} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-black text-slate-900 text-xs">{s.pillar_title || s.pillar_id}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.pillar_id}</p>
                        </div>
                        <span className="text-xs font-black text-emerald-600 bg-white px-2 py-1 rounded-lg border">{s.score}/5</span>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed italic border-l-2 border-emerald-100 pl-3">
                        "{s.reason}"
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </section>

        {/* 4. AI TREATMENT */}
        <section className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10">
            <Lightbulb size={80} />
          </div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-4">Recommended Treatment</h3>
          <p className="text-base font-medium leading-relaxed italic text-emerald-50/90">
            {report.treatment_plan || "No specific treatment recorded."}
          </p>
        </section>

        {/* 5. INACTIVE PILLARS */}
        <section className="pt-8 border-t border-slate-200">
        <div className="flex items-center gap-2 mb-4 px-2 text-slate-400">
          <Info size={14} />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Unobserved in this Session</h3>
        </div>
        
        <div className="flex flex-wrap gap-2 px-2">
          {unobservedPillars.length > 0 ? (
            unobservedPillars.map((p: any) => (
              <div 
                key={p.pillar_id} 
                className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-slate-100 shadow-sm opacity-50 grayscale"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${
                  p.category === 'Karakter' ? 'bg-rose-300' : 
                  p.category === 'Mental' ? 'bg-blue-300' : 'bg-amber-300'
                }`} />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                  {p.pillar_title || p.pillar_id}
                </span>
              </div>
            ))
          ) : (
            <p className="text-[10px] text-slate-400 italic">All curriculum pillars were observed in this narrative.</p>
          )}
        </div>
        
        <div className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
          <p className="text-[10px] text-blue-600/70 leading-relaxed italic">
            <strong>Note for Ustadz:</strong> Unobserved pillars are not a sign of failure. They simply indicate that these specific traits were not identified within the provided narrative text.
          </p>
        </div>
      </section>

      </main>
    </div>
  );
}