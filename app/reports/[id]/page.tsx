import React from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ChevronLeft, Calendar, Quote, Lightbulb, 
  BarChart3, Brain, Heart, Zap, Info, Circle, ChevronDown
} from 'lucide-react';
import Link from 'next/link';

async function getReportDetails(id: string) {
  const { data: report } = await supabase
    .from('reports')
    .select(`*, students(name)`)
    .eq('id', id)
    .single();

  return { report };
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { report } = await getReportDetails(id);

  if (!report) return <div className="p-10 text-center text-slate-500 font-serif">Report not found.</div>;

  const analysis = typeof report.treatment_plan === 'string' 
    ? JSON.parse(report.treatment_plan) 
    : report.treatment_plan;

  const categories = ["Karakter", "Mental", "Soft Skill"];
  
  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans max-w-md mx-auto border-x border-slate-100 shadow-2xl relative">
      {/* Sticky Header */}
      <header className="bg-white/80 backdrop-blur-md px-6 pt-12 pb-6 border-b border-slate-200 flex items-center justify-between sticky top-0 z-30">
        <Link href={`/students/${report.student_id}`} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-all">
          <ChevronLeft className="w-6 h-6 text-slate-800" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Growth Report</p>
          <h1 className="text-sm font-bold text-slate-900">{report.students.name}</h1>
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
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 mb-3">Overall Progress</h3>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(analysis.overall_stats || {}).map(([key, stats]: [string, any]) => (
                <div key={key} className="bg-white/10 rounded-2xl p-3 border border-white/10">
                  <p className="text-[8px] font-black uppercase text-emerald-300 mb-1">{key}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold">{(stats.percentage || 0).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/20 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-400" style={{ width: `${stats.percentage}%` }} />
                  </div>
                  <p className="text-[7px] opacity-60 mt-1 font-bold">{stats.fulfilled}/{stats.total}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. NARRATIVE OBSERVATION */}
        <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 relative">
          <Quote className="absolute top-6 left-6 w-8 h-8 text-slate-50" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Observation Narrative</h3>
          <p className="text-sm text-slate-700 leading-relaxed italic relative z-10 font-medium">
            "{report.narrative}"
          </p>
          <div className="mt-6 flex items-center gap-2 text-slate-300">
            <Calendar size={12} />
            <span className="text-[9px] font-bold uppercase tracking-tighter">
              {new Date(report.created_at).toLocaleDateString('id-ID', { dateStyle: 'full' })}
            </span>
          </div>
        </section>

        {/* 3. PRIORITY TREATMENT */}
        {analysis.treatment && (
          <section className="bg-white rounded-[2.5rem] p-7 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="text-emerald-600" size={18} />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Treatment Plan</h3>
            </div>
            <div className="bg-emerald-50 p-5 rounded-[2rem] border border-emerald-100">
              <div className="flex flex-col mb-4">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">{analysis.treatment.priority_theme}</span>
                <h4 className="text-base font-bold text-slate-900 font-serif leading-tight">{analysis.treatment.priority_indicator}</h4>
              </div>
              
              <div className="space-y-2 mb-5">
                {analysis.treatment.target_sub_indicators?.map((si: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-slate-600 font-medium leading-tight">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                    {si}
                  </div>
                ))}
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
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Detailed Fulfillment</h3>
          
          {categories.map((cat) => {
            const items = analysis.detailed_assessments?.filter((a: any) => a.category === cat) || [];
            if (items.length === 0) return null;

            return (
              <div key={cat} className="bg-white rounded-[2.2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-5 border-b border-slate-50">
                  <div className={`p-2.5 rounded-xl ${cat === "Karakter" ? "bg-rose-50 text-rose-500" : cat === "Mental" ? "bg-blue-50 text-blue-500" : "bg-amber-50 text-amber-500"}`}>
                    {cat === "Karakter" && <Heart size={18} />}
                    {cat === "Mental" && <Brain size={18} />}
                    {cat === "Soft Skill" && <Zap size={18} />}
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm font-serif">{cat} Analysis</h4>
                </div>
                
                <div className="p-5 space-y-6">
                  {items.map((item: any, i: number) => (
                    <div key={i} className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{item.theme}</span>
                          <span className="font-bold text-xs text-slate-800 font-serif leading-tight">{item.indicator}</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {item.fulfillment_fraction}
                        </span>
                      </div>
                      
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                        <p className="text-[11px] text-slate-500 leading-relaxed italic">"{item.reasoning}"</p>
                        
                        <div className="grid grid-cols-1 gap-2">
                          {item.fulfilled_sub_indicators?.map((si: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-[10px] text-emerald-700 font-bold">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                              {si}
                            </div>
                          ))}
                          {item.missing_sub_indicators?.map((si: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-200 flex-shrink-0" />
                              {si}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
