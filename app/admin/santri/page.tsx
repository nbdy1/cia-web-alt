/**
 * app/admin/santri/page.tsx
 *
 * Student (santri) management page for admins. Provides:
 *   - List active students with search filter
 *   - Add a new student (name + optional NIS)
 *   - Soft-remove a student with a required reason (sets is_removed = true,
 *     preserves all reports and history)
 *   - Toggle to view removed students, showing reason and removal date
 *
 * Soft-delete is used instead of hard-delete so that assessment history and
 * reports are never lost. Removed records can be reviewed by the admin at any
 * time via the "Dinonaktifkan" tab.
 *
 * Requires scripts/add_soft_delete.sql to have been run in Supabase.
 */
"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { Search, Loader2, Plus, X, AlertCircle, Sparkles, UserX, GraduationCap, ArchiveX, ArrowLeft } from 'lucide-react';
import { StudentAvatar } from '@/components/StudentAvatar';

export default function ManageSantriPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [removedStudents, setRemovedStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);

  // Add Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', nis: '' });

  // Remove Modal
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<any>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const [activeRes, removedRes] = await Promise.all([
        supabase
          .from('students')
          .select('*, profiles:assigned_ustadz_id (name)')
          .or('is_removed.is.null,is_removed.eq.false')
          .order('name'),
        supabase
          .from('students')
          .select('*, profiles:assigned_ustadz_id (name)')
          .eq('is_removed', true)
          .order('removed_at', { ascending: false }),
      ]);
      if (activeRes.data) setStudents(activeRes.data);
      if (removedRes.data) setRemovedStudents(removedRes.data);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleAddSantri = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    setModalSuccess(null);
    try {
      const { error } = await supabase
        .from('students')
        .insert([{ name: formData.name, nis: formData.nis }]);
      if (error) throw error;
      setModalSuccess("Santri berhasil ditambahkan!");
      setFormData({ name: '', nis: '' });
      fetchStudents();
      setTimeout(() => { setIsAddModalOpen(false); setModalSuccess(null); }, 2000);
    } catch (err: any) {
      setModalError(err.message || "Gagal menambahkan santri baru");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRemoveModal = (student: any) => {
    setStudentToRemove(student);
    setRemoveReason('');
    setRemoveError(null);
    setIsRemoveModalOpen(true);
  };

  const handleRemoveSantri = async () => {
    if (!studentToRemove || !removeReason.trim()) {
      setRemoveError("Alasan penghapusan wajib diisi.");
      return;
    }
    setIsRemoving(true);
    setRemoveError(null);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          is_removed: true,
          removed_at: new Date().toISOString(),
          removed_reason: removeReason.trim(),
        })
        .eq('id', studentToRemove.id);
      if (error) throw error;
      setIsRemoveModalOpen(false);
      setStudentToRemove(null);
      fetchStudents();
    } catch (err: any) {
      setRemoveError(err.message || "Gagal menonaktifkan santri.");
    } finally {
      setIsRemoving(false);
    }
  };

  const activeList = students.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.nis?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const removedList = removedStudents.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.nis?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // avatarColors kept for removed-student greyed state
  const avatarColors = ["#22c55e","#3b82f6","#f59e0b","#a855f7","#ef4444","#06b6d4"];
  const inputCls = "w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-colors";
  const labelCls = "block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5";

  const displayList = showRemoved ? removedList : activeList;

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Manajemen Santri</h2>
          <p className="text-slate-400 text-sm font-bold mt-0.5">Tambah, lihat, atau nonaktifkan data santri</p>
        </div>
        {!showRemoved && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-black text-sm active:translate-y-px transition-transform"
            style={{ boxShadow: "0 3px 0 0 #15803d" }}
          >
            <Plus size={15} /> Tambah Santri
          </button>
        )}
      </div>

      {/* Active / Removed tab toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowRemoved(false); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-xl font-black text-sm transition-colors ${!showRemoved ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          style={!showRemoved ? { boxShadow: "0 3px 0 0 #15803d" } : {}}
        >
          Aktif ({students.length})
        </button>
        <button
          onClick={() => { setShowRemoved(true); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-xl font-black text-sm transition-colors ${showRemoved ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          style={showRemoved ? { boxShadow: "0 3px 0 0 #b91c1c" } : {}}
        >
          Dinonaktifkan ({removedStudents.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={showRemoved ? "Cari santri yang dinonaktifkan…" : "Cari nama atau NIS…"}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-all"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-emerald-500" /></div>
      ) : displayList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayList.map((student, i) => (
            <div
              key={student.id}
              className={`bg-white rounded-[1.5rem] border-2 p-4 flex items-start gap-3 group ${showRemoved ? 'border-rose-100 opacity-80' : 'border-slate-100'}`}
              style={{ boxShadow: showRemoved ? "0 3px 0 0 #fee2e2" : "0 3px 0 0 #e2e8f0" }}
            >
              {showRemoved ? (
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base text-white shrink-0"
                  style={{ background: '#94a3b8', boxShadow: '0 2px 0 0 #cbd5e1' }}
                >
                  {student.name?.charAt(0).toUpperCase() ?? "?"}
                </div>
              ) : (
                <StudentAvatar
                  name={student.name ?? "?"}
                  photoUrl={student.photo_url ?? null}
                  size="sm"
                  colorIndex={i}
                  className="w-11 h-11 rounded-2xl shrink-0"
                />
              )}
              <div className="flex-1 overflow-hidden">
                <p className="font-black text-slate-800 text-sm truncate">{student.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{student.nis ? `NIS: ${student.nis}` : "—"}</span>
                  {student.profiles?.name && (
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{student.profiles.name}</span>
                  )}
                </div>
                {showRemoved && (
                  <div className="mt-2 p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider mb-0.5">
                      Dinonaktifkan {student.removed_at ? new Date(student.removed_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}
                    </p>
                    <p className="text-xs font-bold text-rose-700 leading-snug">{student.removed_reason}</p>
                  </div>
                )}
              </div>
              {!showRemoved && (
                <button
                  onClick={() => openRemoveModal(student)}
                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  title="Nonaktifkan santri"
                >
                  <UserX size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-[1.5rem] border-2 border-dashed border-slate-200">
          {showRemoved
            ? <ArchiveX className="w-8 h-8 mx-auto text-slate-200 mb-3" />
            : <GraduationCap className="w-8 h-8 mx-auto text-slate-200 mb-3" />}
          <p className="text-slate-400 font-black text-sm">
            {searchQuery
              ? "Tidak ada hasil pencarian"
              : showRemoved ? "Belum ada santri yang dinonaktifkan" : "Belum ada data santri"}
          </p>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-7 w-full max-w-md relative" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
            <button onClick={() => { setIsAddModalOpen(false); setModalError(null); setModalSuccess(null); }} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors">
              <X size={16} />
            </button>
            <div className="mb-6">
              <div className="w-11 h-11 bg-emerald-100 rounded-2xl flex items-center justify-center mb-3" style={{ boxShadow: "0 3px 0 0 #a7f3d0" }}>
                <Plus size={20} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Tambah Santri</h3>
              <p className="text-slate-400 text-sm font-bold mt-0.5">Masukkan data santri baru.</p>
            </div>
            {modalError && <div className="mb-4 p-3 bg-rose-50 border-2 border-rose-200 text-rose-600 text-sm rounded-xl flex items-center gap-2 font-bold"><AlertCircle size={16} />{modalError}</div>}
            {modalSuccess && <div className="mb-4 p-3 bg-emerald-50 border-2 border-emerald-200 text-emerald-700 text-sm rounded-xl flex items-center gap-2 font-black"><Sparkles size={16} />{modalSuccess}</div>}
            <form onSubmit={handleAddSantri} className="space-y-4">
              <div>
                <label className={labelCls}>Nama Lengkap *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ahmad Zaid" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>NIS (Nomor Induk Santri)</label>
                <input type="text" value={formData.nis} onChange={e => setFormData({...formData, nis: e.target.value})} placeholder="2024001" className={inputCls} />
              </div>
              <button type="submit" disabled={isSubmitting || !!modalSuccess} className="w-full mt-2 bg-emerald-500 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 active:translate-y-px transition-transform disabled:opacity-60" style={{ boxShadow: "0 3px 0 0 #15803d" }}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />} Simpan Santri
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Remove Modal */}
      {isRemoveModalOpen && studentToRemove && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-7 w-full max-w-md relative" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
            <button onClick={() => setIsRemoveModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors">
              <X size={16} />
            </button>
            <div className="mb-6">
              <div className="w-11 h-11 bg-rose-100 rounded-2xl flex items-center justify-center mb-3" style={{ boxShadow: "0 3px 0 0 #fecaca" }}>
                <UserX size={20} className="text-rose-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Nonaktifkan Santri</h3>
              <p className="text-slate-400 text-sm font-bold mt-0.5">
                <strong className="text-slate-700">{studentToRemove.name}</strong> akan disembunyikan dari daftar aktif. Riwayat laporannya tetap tersimpan.
              </p>
            </div>
            {removeError && <div className="mb-4 p-3 bg-rose-50 border-2 border-rose-200 text-rose-600 text-sm rounded-xl flex items-center gap-2 font-bold"><AlertCircle size={15} />{removeError}</div>}
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Alasan Penghapusan *</label>
                <textarea
                  required
                  rows={3}
                  value={removeReason}
                  onChange={e => setRemoveReason(e.target.value)}
                  placeholder="Contoh: Santri telah lulus dan keluar dari pesantren."
                  className={inputCls + " resize-none"}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setIsRemoveModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl hover:bg-slate-200 transition-colors">
                  Batal
                </button>
                <button
                  onClick={handleRemoveSantri}
                  disabled={isRemoving || !removeReason.trim()}
                  className="flex-1 bg-rose-500 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 active:translate-y-px transition-transform disabled:opacity-60"
                  style={{ boxShadow: "0 3px 0 0 #b91c1c" }}
                >
                  {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX size={14} />} Nonaktifkan
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
