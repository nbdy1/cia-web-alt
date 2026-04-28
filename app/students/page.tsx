import React from 'react';
import { getPerformanceData } from '@/app/actions/performance-data';
import { supabase } from '@/lib/supabase';
import { 
  TrendingUp, AlertTriangle, Users, Heart, Brain, Zap, 
  ChevronRight, ChevronLeft, LayoutDashboard, Sparkles
} from 'lucide-react';
import Link from 'next/link';

async function getStudentListWithStats() {
  // Query through the reports table to get the scores
  const { data: students, error } = await supabase
    .from('students')
    .select(`
      id, 
      name, 
      batch,
      reports (
        report_scores (category, score)
      )
    `);

  if (error) {
    console.error("Supabase Error:", error);
    return [];
  }

  return students?.map(student => {
    // Flatten all scores from all reports for this specific student
    const allScores = student.reports?.flatMap((r: any) => r.report_scores) || [];

    const calc = (cat: string) => {
      const filtered = allScores.filter((s: any) => s.category === cat);
      return filtered.length > 0 
        ? (filtered.reduce((a: number, b: any) => a + b.score, 0) / filtered.length).toFixed(1) 
        : "0.0";
    };

    return {
      ...student,
      stats: {
        karakter: calc("Karakter"),
        mental: calc("Mental"),
        softSkill: calc("Soft Skill")
      }
    };
  }) || [];
}

export default async function StudentsAnalyticsPage() {
  const [performance, students] = await Promise.all([
    getPerformanceData(),
    getStudentListWithStats()
  ]);

  const { stats, lowScores, recentReports } = performance;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Header */}
      <header className="bg-emerald-900 px-6 pt-12 pb-12 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <LayoutDashboard size={120} className="text-white" />
        </div>

        {/* Back Button to Homepage */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-emerald-300 hover:text-white transition-colors mb-6 group bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Home</span>
        </Link>

        <h1 className="text-4xl font-bold text-white tracking-tight">Student Analytics</h1>
        {/* <p className="text-emerald-300 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 opacity-70">Report & Global Pulse</p> */}

        {/* Global Stats Row */}
        <div className="grid grid-cols-3 gap-3 mt-8">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-white/10 backdrop-blur-md rounded-3xl p-4 border border-white/10 text-white">
              <p className="text-[8px] font-black uppercase tracking-widest text-emerald-300 mb-1">{stat.name}</p>
              <div className="text-2xl font-bold font-serif">{stat.avg}</div>
              <p className="text-[7px] font-bold opacity-40 uppercase">Global Avg</p>
            </div>
          ))}
        </div>
      </header>

      <main className="px-6 -mt-6 space-y-8 relative z-10">
        
        {/* 1. STUDENT DIRECTORY (Cleaned up, no search) */}
        <section>
          <div className="flex items-center justify-between mb-4 px-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Users size={12} /> My Students ({students.length})
            </h3>
          </div>
          <div className="grid gap-3">
            {students.map((student) => (
              <Link 
                key={student.id} 
                href={`/students/${student.id}`}
                className="block bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm active:scale-[0.98] transition-all hover:border-emerald-200"
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-900 text-white rounded-2xl flex items-center justify-center font-black text-sm shadow-lg shadow-emerald-100">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xl tracking-tight font-serif">{student.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter italic">{student.batch || 'Reguler'}</p>
                    </div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-full">
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </div>
                
                {/* Individual Score Averages */}
                <div className="flex gap-2">
                  {[
                    { label: 'Karakter', val: student.stats.karakter, icon: <Heart size={10} />, bg: 'bg-rose-50', text: 'text-rose-700' },
                    { label: 'Mental', val: student.stats.mental, icon: <Brain size={10} />, bg: 'bg-blue-50', text: 'text-blue-700' },
                    { label: 'Soft Skill', val: student.stats.softSkill, icon: <Zap size={10} />, bg: 'bg-amber-50', text: 'text-amber-700' }
                  ].map((chip) => (
                    <div key={chip.label} className={`flex-1 ${chip.bg} rounded-2xl py-2 px-3 flex flex-col items-center justify-center gap-0.5`}>
                      <div className="flex items-center gap-1">
                        {chip.icon}
                        <span className={`text-[10px] font-black ${chip.text}`}>{chip.val}</span>
                      </div>
                      <span className="text-[7px] font-bold uppercase opacity-50 text-slate-500">{chip.label}</span>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 2. PRIORITY FOCUS */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-3">
            <AlertTriangle size={14} className="text-amber-500" />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Priority Attention</h3>
          </div>
          <div className="space-y-3">
            {lowScores.length > 0 ? lowScores.map((item: any, idx: number) => (
              <Link 
                href={`/students/${item.reports?.student_id}`} 
                key={idx}
                className="flex items-center justify-between bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-sm active:scale-95 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{item.reports?.students?.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Lower score in {item.pillar_id}</p>
                  </div>
                </div>
                <span className="text-xs font-black text-rose-500 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
                  {item.score}.0
                </span>
              </Link>
            )) : (
              <div className="p-6 text-center bg-emerald-50/30 rounded-[2rem] border border-dashed border-emerald-100">
                <Sparkles className="w-5 h-5 text-emerald-300 mx-auto mb-2" />
                <p className="text-[10px] font-bold text-emerald-600 uppercase">All students performing well</p>
              </div>
            )}
          </div>
        </section>

        {/* 3. RECENT ACTIVITY */}
        <section>
          <div className="flex items-center justify-between mb-4 px-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Recent Reviews</h3>
          </div>
          <div className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm">
            {recentReports.map((report: any, idx: number) => {
              const scores = report.report_scores || [];
              const avg = scores.length > 0 
                ? (scores.reduce((a: number, b: any) => a + b.score, 0) / scores.length).toFixed(1)
                : "0.0";
              
              return (
                <Link 
                  href={`/reports/${report.id}`} 
                  key={report.id}
                  className={`flex items-center justify-between p-6 hover:bg-slate-50 transition-colors ${idx !== recentReports.length - 1 ? 'border-b border-slate-50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-400 text-xs">
                      {report.students?.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{report.students?.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">
                        {new Date(report.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div className={`text-xs font-black px-3 py-1 rounded-lg ${Number(avg) >= 4 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'}`}>
                    {avg}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}