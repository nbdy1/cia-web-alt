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

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manajemen Santri</h2>
          <p className="text-slate-500 text-sm">Kelola data santri, tambah santri baru, atau hapus data santri</p>
        </div>
        
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-200"
        >
          <Plus size={16} />
          <span>Tambah Santri</span>
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau angkatan santri..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : filteredList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredList.map((student) => (
              <div key={student.id} className="p-5 rounded-3xl border border-slate-100 hover:border-emerald-200 transition-colors bg-white shadow-sm flex items-center justify-between gap-4 group">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shrink-0">
                    {student.name ? student.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-slate-800 text-base truncate flex items-center gap-2">
                      {student.name}
                    </h3>
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Angkatan: {student.batch || 'Reguler'}
                      </span>
                      {student.profiles?.name && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block w-fit">
                          Ustadz: {student.profiles.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => confirmDelete(student)}
                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors md:opacity-0 md:group-hover:opacity-100"
                  title="Hapus Santri"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <GraduationCap className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">
              {searchQuery ? 'Tidak ada santri yang cocok dengan pencarian' : 'Belum ada data santri'}
            </p>
          </div>
        )}
      </div>

      {/* Add Santri Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            <button 
              onClick={() => {
                setIsAddModalOpen(false);
                setModalError(null);
                setModalSuccess(null);
              }}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-8">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                <Plus size={24} />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Tambah Santri</h3>
              <p className="text-slate-500 text-sm mt-1">Masukkan data santri baru ke dalam sistem.</p>
            </div>

            {modalError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-2xl flex items-start gap-3">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl flex items-center justify-center gap-2 font-bold">
                <Sparkles size={18} className="text-emerald-500" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddSantri} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Misal: Ahmad Zaid"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Angkatan / Kelas</label>
                <input
                  type="text"
                  value={formData.batch}
                  onChange={e => setFormData({...formData, batch: e.target.value})}
                  placeholder="Misal: 2024 / Kelas 10"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || modalSuccess !== null}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-emerald-200"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus size={20} />}
                <span>Simpan Santri</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl text-center relative animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Santri?</h3>
            <p className="text-slate-500 text-sm mb-6">
              Apakah Anda yakin ingin menghapus <strong>{studentToDelete.name}</strong>? Tindakan ini tidak dapat dibatalkan dan dapat gagal jika santri memiliki laporan yang terhubung.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteSantri}
                disabled={isDeleting}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-2xl transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 size={16} />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
