"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, Search, Loader2, Users, FileText, ChevronRight, Calendar, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function MonitoringPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUstadz, setExpandedUstadz] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMonitoringData() {
      try {
        // Fetch all Ustadz
        const { data: ustadzList, error: ustadzError } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('role', 'ustadz')
          .order('name');

        if (ustadzError) throw ustadzError;

        // Fetch all students with their reports
        const { data: studentsList, error: studentsError } = await supabase
          .from('students')
          .select(`
            id, 
            name, 
            assigned_ustadz_id,
            reports (
              id, 
              created_at, 
              narrative
            )
          `)
          .order('name');

        if (studentsError) throw studentsError;

        // Map students to their Ustadz
        const formattedData = (ustadzList || []).map(ustadz => {
          const assignedStudents = (studentsList || []).filter(s => s.assigned_ustadz_id === ustadz.id);
          
          return {
            ...ustadz,
            students: assignedStudents.map(student => ({
              ...student,
              // Sort reports by newest first
              reports: (student.reports || []).sort((a: any, b: any) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
            }))
          };
        });

        setData(formattedData);
      } catch (err) {
        console.error("Error fetching monitoring data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchMonitoringData();
  }, []);

  const filteredData = data.filter(ustadz => {
    // Match ustadz name
    if (ustadz.name?.toLowerCase().includes(searchQuery.toLowerCase())) return true;
    
    // Match student name under this ustadz
    const hasMatchingStudent = ustadz.students.some((s: any) => 
      s.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return hasMatchingStudent;
  });

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Monitor Laporan</h2>
        <p className="text-slate-400 text-sm font-bold mt-0.5">Progres laporan santri per Ustadz pembimbing</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari Ustadz atau Santri…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-all"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
        </div>
      ) : filteredData.length > 0 ? (
        <div className="space-y-3">
          {filteredData.map((ustadz) => {
            const isExpanded = expandedUstadz === ustadz.id;
            const totalStudents = ustadz.students.length;
            const totalReports = ustadz.students.reduce((acc: number, curr: any) => acc + curr.reports.length, 0);

            return (
              <div key={ustadz.id} className="bg-white rounded-[1.5rem] border-2 border-slate-100 overflow-hidden" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
                <button
                  onClick={() => setExpandedUstadz(isExpanded ? null : ustadz.id)}
                  className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-emerald-500 text-white rounded-2xl flex items-center justify-center font-black text-base shrink-0" style={{ boxShadow: "0 3px 0 0 #15803d" }}>
                      {ustadz.name ? ustadz.name.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-sm">{ustadz.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-100">
                          <Users size={9} /> {totalStudents} Santri
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-100">
                          <BookOpen size={9} /> {totalReports} Laporan
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t-2 border-slate-50 pt-4 space-y-5">
                    {ustadz.students.length > 0 ? (
                      ustadz.students.map((student: any) => (
                        <div key={student.id}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-600 text-xs">{student.name.charAt(0)}</div>
                            <span className="font-black text-slate-700 text-sm">{student.name}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black">
                              {student.reports.length} laporan
                            </span>
                          </div>
                          {student.reports.length > 0 ? (
                            <div className="pl-3 border-l-2 border-slate-100 ml-3.5 space-y-2">
                              {student.reports.map((report: any) => (
                                <div key={report.id} className="bg-slate-50 rounded-xl p-3.5 border-2 border-slate-100 hover:border-emerald-200 transition-colors">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                      <Calendar size={11} className="text-emerald-500" />
                                      {new Date(report.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Link href={`/students/${student.id}?from=${encodeURIComponent("/admin/monitoring")}`} className="text-[10px] font-black text-slate-600 bg-white px-2.5 py-1 rounded-lg border-2 border-slate-200 hover:border-slate-300 transition-colors flex items-center gap-1">
                                        <Users size={10} /> Profil
                                      </Link>
                                      <Link href={`/reports/${report.id}?from=${encodeURIComponent("/admin/monitoring")}`} className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border-2 border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1">
                                        <FileText size={10} /> Detail
                                      </Link>
                                    </div>
                                  </div>
                                  <p className="text-xs text-slate-500 italic line-clamp-2 leading-relaxed font-bold">"{report.narrative?.slice(0, 120)}…"</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 font-bold ml-3.5 pl-3 border-l-2 border-slate-100 py-1">Belum ada laporan.</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6">
                        <AlertCircle className="w-7 h-7 mx-auto text-amber-300 mb-2" />
                        <p className="text-sm text-slate-400 font-black">Belum ada santri yang ditugaskan.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-[1.5rem] border-2 border-dashed border-slate-200">
          <BookOpen className="w-8 h-8 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400 font-black text-sm">
            {searchQuery ? "Tidak ada hasil pencarian" : "Belum ada data monitoring"}
          </p>
        </div>
      )}
    </div>
  );
}
