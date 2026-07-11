/**
 * app/admin/assignments/page.tsx
 *
 * Student-to-ustadz assignment page. Allows the admin to assign each student
 * to a specific ustadz so they appear in that ustadz's student list.
 *
 * The assignment is stored in `students.assigned_ustadz_id` (a FK to
 * `profiles.id`). Changes are tracked in local state and saved in a single
 * batch operation to minimise database round-trips.
 *
 * Students without an assignment are visible to admin only; once assigned they
 * appear in the ustadz's "My Students" view (/students filtered by role).
 */
"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Search, Loader2, Save, UserCheck, AlertCircle } from 'lucide-react';
import { StudentAvatar } from '@/components/StudentAvatar';

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
          supabase.from('students').select('*').or('is_removed.is.null,is_removed.eq.false').order('name'),
          supabase.from('profiles').select('*').eq('role', 'ustadz').or('is_removed.is.null,is_removed.eq.false').order('name')
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
    <div className="space-y-5 max-w-4xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Plotting Santri</h2>
          <p className="text-slate-400 text-sm font-bold mt-0.5">Tugaskan santri ke Ustadz pembimbing</p>
        </div>
        <button
          onClick={saveAssignments}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 bg-brand-500 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl font-black text-sm active:translate-y-px transition-transform"
          style={{ boxShadow: saving || loading ? "none" : "0 3px 0 0 var(--brand-700)" }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={15} />} Simpan Perubahan
        </button>
      </div>

      {message && (
        <div className={`p-3.5 rounded-xl flex items-center gap-2.5 text-sm font-black border-2 ${
          message.type === "success" ? "bg-brand-50 text-brand-700 border-brand-200" : "bg-rose-50 text-rose-700 border-rose-200"
        }`}>
          {message.type === "success" ? <UserCheck size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Cari nama santri…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:border-brand-400 transition-all"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand-500" /></div>
      ) : ustadzList.length === 0 ? (
        <div className="text-center py-14 bg-amber-50 rounded-[1.5rem] border-2 border-amber-200">
          <AlertCircle className="w-8 h-8 mx-auto text-amber-400 mb-3" />
          <p className="text-amber-800 font-black text-sm mb-1">Belum ada Ustadz terdaftar</p>
          <p className="text-amber-600 text-xs font-bold">Daftarkan Ustadz terlebih dahulu di menu Kelola Ustadz.</p>
        </div>
      ) : filteredStudents.length > 0 ? (
        <div className="bg-white rounded-[1.5rem] border-2 border-slate-100 overflow-hidden" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
          <div className="grid grid-cols-2 px-5 py-3 bg-slate-50 border-b-2 border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Santri</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ustadz Pembimbing</p>
          </div>
          <div className="divide-y-2 divide-slate-50">
            {filteredStudents.map((student) => {
              const currentUstadz = assignments[student.id] || "";
              const hasChanged = currentUstadz !== (student.assigned_ustadz_id || "");
              return (
                <div key={student.id} className={`grid grid-cols-2 gap-4 px-5 py-3.5 items-center transition-colors ${hasChanged ? "bg-brand-50/60" : "hover:bg-slate-50/50"}`}>
                  <div className="flex items-center gap-2.5">
                    <StudentAvatar
                      name={student.name}
                      photoUrl={student.photo_url ?? null}
                      size="sm"
                      colorIndex={filteredStudents.indexOf(student)}
                      className="w-8 h-8 rounded-xl shrink-0"
                    />
                    <div>
                      <p className="font-black text-slate-800 text-sm leading-tight">{student.name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{student.nis ? `NIS: ${student.nis}` : "—"}</p>
                    </div>
                  </div>
                  <select
                    value={currentUstadz}
                    onChange={(e) => handleAssignmentChange(student.id, e.target.value)}
                    className={`w-full p-2.5 rounded-xl text-sm font-bold border-2 focus:outline-none transition-all appearance-none ${
                      currentUstadz ? "bg-brand-50 border-brand-200 text-brand-800" : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}
                  >
                    <option value="">— Belum Ditugaskan —</option>
                    {ustadzList.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-[1.5rem] border-2 border-dashed border-slate-200">
          <Users className="w-8 h-8 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400 font-black text-sm">Tidak ada santri ditemukan</p>
        </div>
      )}
    </div>
  );
}
