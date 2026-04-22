import React from 'react';
import { getPerformanceData } from '@/app/actions/performance-data';
import { 
  TrendingUp, AlertTriangle, Users, Heart, Brain, Zap, ChevronRight 
} from 'lucide-react';
import Link from 'next/link';

export default async function PerformancePage() {
  const { studentCount, stats, lowScores, recentReports } = await getPerformanceData();

  // Helper for UI styling since the action is now data-only
  const getCategoryStyles = (name: string) => {
    switch (name) {
      case "Karakter": return { icon: <Heart size={14} />, color: "text-rose-400" };
      case "Mental": return { icon: <Brain size={14} />, color: "text-blue-400" };
      case "Soft Skill": return { icon: <Zap size={14} />, color: "text-amber-400" };
      default: return { icon: <TrendingUp size={14} />, color: "text-slate-400" };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      <header className="bg-emerald-900 px-6 pt-16 pb-12 rounded-b-[3.5rem] shadow-2xl">
        <h1 className="text-3xl font-black text-white tracking-tight">Performance</h1>
        <p className="text-emerald-300 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 opacity-70">Community Pulse</p>

        {/* 3-Column Pillar Stats */}
        <div className="grid grid-cols-3 gap-3 mt-8">
          {stats.map((stat) => {
            const style = getCategoryStyles(stat.name);
            return (
              <div key={stat.name} className="bg-white/10 backdrop-blur-md rounded-[2rem] p-4 border border-white/10 text-white">
                <div className={`flex items-center gap-2 mb-2 ${style.color}`}>
                  {style.icon}
                  <span className="text-[9px] font-black uppercase tracking-tighter text-white/60">{stat.name}</span>
                </div>
                <div className="text-2xl font-black">{stat.avg}</div>
                <div className="text-[8px] font-bold opacity-30">Avg Score</div>
              </div>
            );
          })}
        </div>
      </header>

      <main className="px-6 -mt-6 space-y-8">
        {/* Total Students Card */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{studentCount}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Santri</p>
            </div>
          </div>
          <TrendingUp className="text-emerald-500 w-5 h-5 opacity-30" />
        </div>

        {/* Priority Focus */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Priority Attention</h3>
          </div>
          <div className="space-y-3">
            {lowScores.map((item: any, idx: number) => (
              <Link 
                href={`/students/${item.reports?.student_id}`} 
                key={idx}
                className="flex items-center justify-between bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm active:scale-95 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{item.reports?.students?.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Struggling: {item.pillar_id}</p>
                  </div>
                </div>
                <span className="text-xs font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
                  {item.score}.0
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Activity Feed */}
        <section>
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Recent Reviews</h3>
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
                  className={`flex items-center justify-between p-5 hover:bg-slate-50 transition-colors ${idx !== recentReports.length - 1 ? 'border-b border-slate-50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 text-xs">
                      {report.students?.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{report.students?.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">
                        {new Date(report.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div className={`text-sm font-black ${Number(avg) >= 4 ? 'text-emerald-500' : 'text-slate-900'}`}>
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