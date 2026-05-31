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
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Monitor Laporan</h2>
          <p className="text-slate-500 text-sm">Pantau progres laporan santri dari setiap Ustadz pembimbing</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama Ustadz atau Santri..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : filteredData.length > 0 ? (
          <div className="space-y-4">
            {filteredData.map((ustadz) => {
              const isExpanded = expandedUstadz === ustadz.id;
              const totalStudents = ustadz.students.length;
              const totalReports = ustadz.students.reduce((acc: number, curr: any) => acc + curr.reports.length, 0);

              return (
                <div key={ustadz.id} className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm bg-white transition-all">
                  <button 
                    onClick={() => setExpandedUstadz(isExpanded ? null : ustadz.id)}
                    className="w-full p-5 flex items-center justify-between bg-slate-50 hover:bg-slate-100/70 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 shadow-md shadow-emerald-200">
                        {ustadz.name ? ustadz.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{ustadz.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            <Users size={12} className="text-emerald-500" /> {totalStudents} Santri
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            <BookOpen size={12} className="text-blue-500" /> {totalReports} Laporan
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="p-5 bg-white border-t border-slate-100">
                      {ustadz.students.length > 0 ? (
                        <div className="space-y-6">
                          {ustadz.students.map((student: any) => (
                            <div key={student.id} className="space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <h4 className="font-bold text-slate-700 text-sm">{student.name}</h4>
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                                  {student.reports.length} Laporan
                                </span>
                              </div>
                              
                              {student.reports.length > 0 ? (
                                <div className="pl-4 border-l-2 border-slate-100 space-y-3 ml-1">
                                  {student.reports.map((report: any) => (
                                    <div key={report.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 group hover:border-emerald-200 transition-colors">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                          <Calendar size={14} className="text-emerald-500" />
                                          {new Date(report.created_at).toLocaleDateString('id-ID', {
                                            day: 'numeric', month: 'long', year: 'numeric'
                                          })}
                                        </div>
                                        <div className="flex items-center gap-2">
                                        <Link
                                          href={`/students/${student.id}?from=${encodeURIComponent("/admin/monitoring")}`}
                                          className="text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 px-3 py-1 rounded-full transition-colors flex items-center gap-1 border border-slate-200"
                                        >
                                          <Users size={12} />
                                          Profil Santri
                                        </Link>
                                        <Link
                                          href={`/reports/${report.id}?from=${encodeURIComponent("/admin/monitoring")}`}
                                          className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                                        >
                                          <FileText size={12} />
                                          Buka Detail
                                        </Link>
                                        </div>
                                      </div>
                                      <p className="text-sm text-slate-600 italic line-clamp-2 leading-relaxed">
                                        "{report.narrative}"
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="pl-4 ml-1">
                                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 inline-block">
                                    Belum ada laporan untuk santri ini.
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <AlertCircle className="w-8 h-8 mx-auto text-amber-300 mb-2" />
                          <p className="text-sm text-slate-500 font-medium">Ustadz ini belum dipetakan ke santri manapun.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">
              {searchQuery ? 'Tidak ada hasil yang cocok dengan pencarian' : 'Belum ada data monitoring'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
