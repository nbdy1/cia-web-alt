"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Search, Loader2, Save, UserCheck, AlertCircle } from 'lucide-react';

export default function PlottingSantriPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [ustadzList, setUstadzList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track changes locally before saving
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [studentsRes, profilesRes] = await Promise.all([
          supabase.from('students').select('*').order('name'),
          supabase.from('profiles').select('*').eq('role', 'ustadz').order('name')
        ]);
        
        if (studentsRes.data) {
          setStudents(studentsRes.data);
          // Initialize assignments state with current values
          const initialAssigns: Record<string, string> = {};
          studentsRes.data.forEach(s => {
            if (s.assigned_ustadz_id) {
              initialAssigns[s.id] = s.assigned_ustadz_id;
            }
          });
          setAssignments(initialAssigns);
        }
        
        if (profilesRes.data) {
          setUstadzList(profilesRes.data);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleAssignmentChange = (studentId: string, ustadzId: string) => {
    setAssignments(prev => ({
      ...prev,
      [studentId]: ustadzId
    }));
  };

  const saveAssignments = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // Create updates array
      const updates = Object.entries(assignments).map(([studentId, ustadzId]) => ({
        id: studentId,
        assigned_ustadz_id: ustadzId || null
      }));

      // Update one by one or in bulk if supabase supports upsert well.
      // Easiest is to upsert if we select only id and assigned_ustadz_id, but we need other fields or it might overwrite?
      // Since it's an update, doing a Promise.all over updates is safest.
      const promises = updates.map(update => 
        supabase
          .from('students')
          .update({ assigned_ustadz_id: update.assigned_ustadz_id })
          .eq('id', update.id)
      );

      await Promise.all(promises);
      setMessage({ type: 'success', text: 'Plotting santri berhasil disimpan!' });
      
      // Update local students list to reflect saved state
      setStudents(prev => prev.map(s => ({
        ...s,
        assigned_ustadz_id: assignments[s.id] || null
      })));
      
    } catch (err: any) {
      console.error("Save error:", err);
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan plotting' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Plotting Santri</h2>
          <p className="text-slate-500 text-sm">Tugaskan santri kepada Ustadz pembimbing masing-masing</p>
        </div>
        
        <button 
          onClick={saveAssignments}
          disabled={saving || loading}
          className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-200"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
          <span>Simpan Perubahan</span>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {message.type === 'success' ? <UserCheck size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama santri..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : ustadzList.length === 0 ? (
          <div className="text-center py-16 bg-amber-50 rounded-3xl border border-dashed border-amber-200">
            <AlertCircle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
            <p className="text-amber-800 font-bold mb-1">Belum ada Ustadz terdaftar</p>
            <p className="text-amber-600 text-sm">Pastikan Anda telah menjalankan Setup SQL dan mendaftarkan Ustadz terlebih dahulu.</p>
          </div>
        ) : filteredStudents.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Santri</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Ustadz Pembimbing</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const currentUstadz = assignments[student.id] || '';
                  const hasChanged = currentUstadz !== (student.assigned_ustadz_id || '');
                  
                  return (
                    <tr key={student.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${hasChanged ? 'bg-emerald-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{student.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{student.batch || 'Reguler'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={currentUstadz}
                          onChange={(e) => handleAssignmentChange(student.id, e.target.value)}
                          className={`w-full max-w-xs p-2.5 rounded-xl text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                            currentUstadz 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}
                        >
                          <option value="">-- Belum Ditugaskan --</option>
                          {ustadzList.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Tidak ada santri ditemukan</p>
          </div>
        )}
      </div>
    </div>
  );
}
