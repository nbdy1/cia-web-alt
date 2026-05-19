"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, BookOpen, AlertTriangle, Loader2 } from 'lucide-react';

export default function AdminOverviewPage() {
  const [stats, setStats] = useState({
    totalUstadz: 0,
    totalSantri: 0,
    totalReports: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // We'll wrap these in promise.all if possible, but profiles table might not exist yet if user hasn't run SQL
        // We try to fetch profiles to see if it exists
        const { count: ustadzCount, error: profileErr } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        const { count: santriCount } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });

        const { count: reportsCount } = await supabase
          .from('reports')
          .select('*', { count: 'exact', head: true });

        setStats({
          totalUstadz: profileErr ? 0 : (ustadzCount || 0),
          totalSantri: santriCount || 0,
          totalReports: reportsCount || 0
        });
      } catch (err) {
        console.error("Error fetching admin stats:", err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
          <p className="text-slate-500 text-sm">Monitor ringkasan aktivitas CIA secara global</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Ustadz</p>
            <p className="text-3xl font-bold text-slate-800">{stats.totalUstadz}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Santri</p>
            <p className="text-3xl font-bold text-slate-800">{stats.totalSantri}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Laporan</p>
            <p className="text-3xl font-bold text-slate-800">{stats.totalReports}</p>
          </div>
        </div>
      </div>

      {/* Notice about SQL Setup */}
      {stats.totalUstadz === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex gap-4">
          <AlertTriangle className="text-amber-500 shrink-0" />
          <div>
            <h3 className="font-bold text-amber-800">Perhatian: Database Setup</h3>
            <p className="text-amber-700 text-sm mt-1 leading-relaxed">
              Jika Total Ustadz bernilai 0 dan Anda sudah mendaftarkan Ustadz, pastikan Anda telah menjalankan <strong>SQL Script</strong> yang ada di Implementation Plan pada Supabase SQL Editor Anda agar tabel <code>profiles</code> terbuat dengan benar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
