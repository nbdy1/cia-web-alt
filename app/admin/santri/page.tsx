"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Loader2, Plus, X, AlertCircle, Sparkles, Trash2, GraduationCap } from 'lucide-react';

export default function ManageSantriPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  
  // Add Form State
  const [formData, setFormData] = useState({
    name: '',
    batch: ''
  });

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          profiles:assigned_ustadz_id (name)
        `)
        .order('name');
      
      if (!error && data) {
        setStudents(data);
      }
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleAddSantri = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      const { data, error } = await supabase
        .from('students')
        .insert([
          { name: formData.name, batch: formData.batch }
        ])
        .select();

      if (error) throw error;

      setModalSuccess("Santri berhasil ditambahkan!");
      setFormData({ name: '', batch: '' });
      fetchStudents();

      setTimeout(() => {
        setIsAddModalOpen(false);
        setModalSuccess(null);
      }, 2000);

    } catch (err: any) {
      console.error("Error adding student:", err);
      setModalError(err.message || "Gagal menambahkan santri baru");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (student: any) => {
    setStudentToDelete(student);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSantri = async () => {
    if (!studentToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentToDelete.id);

      if (error) throw error;

      setIsDeleteModalOpen(false);
      setStudentToDelete(null);
      fetchStudents();
    } catch (err) {
      console.error("Error deleting student:", err);
      alert("Gagal menghapus santri. Mungkin ada laporan yang terkait.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredList = students.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.batch?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const avatarColors = ["#22c55e","#3b82f6","#f59e0b","#a855f7","#ef4444","#06b6d4"];

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Manajemen Santri</h2>
          <p className="text-slate-400 text-sm font-bold mt-0.5">Tambah, lihat, atau hapus data santri</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-black text-sm active:translate-y-px transition-transform"
          style={{ boxShadow: "0 3px 0 0 #15803d" }}
        >
          <Plus size={15} /> Tambah Santri
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama atau angkatan…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-all"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-emerald-500" /></div>
      ) : filteredList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredList.map((student, i) => (
            <div
              key={student.id}
              className="bg-white rounded-[1.5rem] border-2 border-slate-100 p-4 flex items-center justify-between gap-3 group"
              style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base text-white shrink-0"
                  style={{ background: avatarColors[i % avatarColors.length], boxShadow: `0 2px 0 0 ${avatarColors[i % avatarColors.length]}88` }}
                >
                  {student.name?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <div className="overflow-hidden">
                  <p className="font-black text-slate-800 text-sm truncate">{student.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{student.batch || "Reguler"}</span>
                    {student.profiles?.name && (
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{student.profiles.name}</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => confirmDelete(student)}
                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-[1.5rem] border-2 border-dashed border-slate-200">
          <GraduationCap className="w-8 h-8 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400 font-black text-sm">{searchQuery ? "Tidak ada hasil pencarian" : "Belum ada data santri"}</p>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
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
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Nama Lengkap *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ahmad Zaid" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Angkatan / Kelas</label>
                <input type="text" value={formData.batch} onChange={e => setFormData({...formData, batch: e.target.value})} placeholder="2024 / Kelas 10" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-colors" />
              </div>
              <button type="submit" disabled={isSubmitting || !!modalSuccess} className="w-full mt-2 bg-emerald-500 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 active:translate-y-px transition-transform disabled:opacity-60" style={{ boxShadow: "0 3px 0 0 #15803d" }}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />} Simpan Santri
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-7 w-full max-w-sm text-center" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
            <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ boxShadow: "0 3px 0 0 #fecaca" }}>
              <AlertCircle size={26} className="text-rose-500" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Hapus Santri?</h3>
            <p className="text-slate-400 text-sm font-bold mb-6">Hapus <strong className="text-slate-700">{studentToDelete.name}</strong>? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl hover:bg-slate-200 transition-colors">Batal</button>
              <button onClick={handleDeleteSantri} disabled={isDeleting} className="flex-1 bg-rose-500 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 active:translate-y-px transition-transform disabled:opacity-60" style={{ boxShadow: "0 3px 0 0 #b91c1c" }}>
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 size={14} />} Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
