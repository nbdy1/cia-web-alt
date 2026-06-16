/**
 * app/admin/ustadz/page.tsx
 *
 * Teacher (ustadz) management page for admins. Provides:
 *   - List active ustadz/admin accounts with search
 *   - Add a new ustadz account (creates Supabase Auth user + profile row)
 *   - View/toggle password visibility for new accounts
 *   - Soft-remove an ustadz with a required reason (sets is_removed = true,
 *     preserves profile and all associated data)
 *   - Toggle to view removed ustadz, showing reason and removal date
 *
 * Note: Creating an ustadz uses a secondary auth client (persistSession: false)
 * so the currently logged-in admin session is not replaced.
 *
 * Requires scripts/add_soft_delete.sql to have been run in Supabase.
 */
"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Search, Loader2, Sparkles, Mail, Calendar, X, Plus, UserPlus, AlertCircle, Eye, EyeOff, UserX, ArchiveX } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

export default function ManageUstadzPage() {
  const [ustadzList, setUstadzList] = useState<any[]>([]);
  const [removedList, setRemovedList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);

  // Add Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'ustadz' });
  const [showPassword, setShowPassword] = useState(false);

  // Remove Modal
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<any>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const fetchUstadz = async () => {
    setLoading(true);
    try {
      const [activeRes, removedRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .or('is_removed.is.null,is_removed.eq.false')
          .order('name'),
        supabase
          .from('profiles')
          .select('*')
          .eq('is_removed', true)
          .order('removed_at', { ascending: false }),
      ]);
      if (activeRes.data) setUstadzList(activeRes.data);
      if (removedRes.data) setRemovedList(removedRes.data);
    } catch (err) {
      console.error("Error fetching ustadz profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUstadz(); }, []);

  const handleAddUstadz = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    setModalSuccess(null);
    try {
      // Separate auth client so the admin's own session isn't replaced
      const authClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      );
      const { error } = await authClient.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { name: formData.name, role: formData.role } }
      });
      if (error) throw error;
      setModalSuccess("Pengguna berhasil didaftarkan!");
      setFormData({ name: '', email: '', password: '', role: 'ustadz' });
      fetchUstadz();
      setTimeout(() => { setIsModalOpen(false); setModalSuccess(null); }, 2000);
    } catch (err: any) {
      setModalError(err.message || "Gagal mendaftarkan pengguna baru");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRemoveModal = (user: any) => {
    setUserToRemove(user);
    setRemoveReason('');
    setRemoveError(null);
    setIsRemoveModalOpen(true);
  };

  const handleRemoveUstadz = async () => {
    if (!userToRemove || !removeReason.trim()) {
      setRemoveError("Alasan penghapusan wajib diisi.");
      return;
    }
    setIsRemoving(true);
    setRemoveError(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_removed: true,
          removed_at: new Date().toISOString(),
          removed_reason: removeReason.trim(),
        })
        .eq('id', userToRemove.id);
      if (error) throw error;
      setIsRemoveModalOpen(false);
      setUserToRemove(null);
      fetchUstadz();
    } catch (err: any) {
      setRemoveError(err.message || "Gagal menonaktifkan pengguna.");
    } finally {
      setIsRemoving(false);
    }
  };

  const activeFiltered = ustadzList.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const removedFiltered = removedList.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayList = showRemoved ? removedFiltered : activeFiltered;

  const inputCls = "w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-colors";
  const labelCls = "block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5";

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Manajemen Pengguna</h2>
          <p className="text-slate-400 text-sm font-bold mt-0.5">Kelola daftar Ustadz dan Admin</p>
        </div>
        {!showRemoved && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-black text-sm active:translate-y-px transition-transform"
            style={{ boxShadow: "0 3px 0 0 #15803d" }}
          >
            <UserPlus size={15} /> Tambah Pengguna
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
          Aktif ({ustadzList.length})
        </button>
        <button
          onClick={() => { setShowRemoved(true); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-xl font-black text-sm transition-colors ${showRemoved ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          style={showRemoved ? { boxShadow: "0 3px 0 0 #b91c1c" } : {}}
        >
          Dinonaktifkan ({removedList.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={showRemoved ? "Cari pengguna yang dinonaktifkan…" : "Cari nama, email, atau role…"}
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
          {displayList.map((user) => (
            <div
              key={user.id}
              className={`bg-white rounded-[1.5rem] border-2 p-4 flex items-start gap-3 group ${showRemoved ? 'border-rose-100 opacity-80' : 'border-slate-100'}`}
              style={{ boxShadow: showRemoved ? "0 3px 0 0 #fee2e2" : "0 3px 0 0 #e2e8f0" }}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shrink-0 ${showRemoved ? 'bg-slate-200 text-slate-500' : user.role === "admin" ? "bg-slate-900 text-white" : "bg-emerald-100 text-emerald-700"}`}
                style={!showRemoved && user.role === "admin" ? { boxShadow: "0 3px 0 0 #000" } : !showRemoved ? { boxShadow: "0 3px 0 0 #a7f3d0" } : {}}
              >
                {user.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-2">
                  <p className="font-black text-slate-800 text-sm truncate">{user.name}</p>
                  {!showRemoved && user.role === "admin" && (
                    <span className="text-[9px] font-black uppercase tracking-widest bg-slate-900 text-white px-2 py-0.5 rounded-md shrink-0">Admin</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400 font-bold">
                  <Mail size={11} /><span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-black uppercase tracking-wider">
                  <Calendar size={10} /> {new Date(user.created_at).toLocaleDateString("id-ID")}
                </div>
                {showRemoved && (
                  <div className="mt-2 p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider mb-0.5">
                      Dinonaktifkan {user.removed_at ? new Date(user.removed_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}
                    </p>
                    <p className="text-xs font-bold text-rose-700 leading-snug">{user.removed_reason}</p>
                  </div>
                )}
              </div>
              {!showRemoved && (
                <button
                  onClick={() => openRemoveModal(user)}
                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  title="Nonaktifkan pengguna"
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
            : <Users className="w-8 h-8 mx-auto text-slate-200 mb-3" />}
          <p className="text-slate-400 font-black text-sm">
            {searchQuery
              ? "Tidak ada hasil pencarian"
              : showRemoved ? "Belum ada pengguna yang dinonaktifkan" : "Belum ada data pengguna"}
          </p>
        </div>
      )}

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-7 w-full max-w-md relative" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
            <button onClick={() => { setIsModalOpen(false); setModalError(null); setModalSuccess(null); }} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors">
              <X size={16} />
            </button>
            <div className="mb-6">
              <div className="w-11 h-11 bg-emerald-100 rounded-2xl flex items-center justify-center mb-3" style={{ boxShadow: "0 3px 0 0 #a7f3d0" }}>
                <UserPlus size={20} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Tambah Pengguna</h3>
              <p className="text-slate-400 text-sm font-bold mt-0.5">Daftarkan akun Ustadz atau Admin baru.</p>
            </div>
            {modalError && <div className="mb-4 p-3 bg-rose-50 border-2 border-rose-200 text-rose-600 text-sm rounded-xl flex items-center gap-2 font-bold"><AlertCircle size={15} />{modalError}</div>}
            {modalSuccess && <div className="mb-4 p-3 bg-emerald-50 border-2 border-emerald-200 text-emerald-700 text-sm rounded-xl flex items-center gap-2 font-black"><Sparkles size={15} />{modalSuccess}</div>}
            <form onSubmit={handleAddUstadz} className="space-y-4">
              <div><label className={labelCls}>Nama Lengkap *</label><input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ustaz Abdullah" className={inputCls} /></div>
              <div><label className={labelCls}>Email *</label><input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="ustadz@pesantren.com" className={inputCls} /></div>
              <div>
                <label className={labelCls}>Password *</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" className={inputCls + " pr-12"} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Role</label>
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className={inputCls + " appearance-none"}>
                  <option value="ustadz">Ustadz</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" disabled={isSubmitting || !!modalSuccess} className="w-full mt-2 bg-emerald-500 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 active:translate-y-px transition-transform disabled:opacity-60" style={{ boxShadow: "0 3px 0 0 #15803d" }}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />} Simpan Pengguna
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Remove Modal */}
      {isRemoveModalOpen && userToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-7 w-full max-w-md relative" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
            <button onClick={() => setIsRemoveModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors">
              <X size={16} />
            </button>
            <div className="mb-6">
              <div className="w-11 h-11 bg-rose-100 rounded-2xl flex items-center justify-center mb-3" style={{ boxShadow: "0 3px 0 0 #fecaca" }}>
                <UserX size={20} className="text-rose-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Nonaktifkan Pengguna</h3>
              <p className="text-slate-400 text-sm font-bold mt-0.5">
                <strong className="text-slate-700">{userToRemove.name}</strong> akan disembunyikan dari daftar aktif. Data dan riwayatnya tetap tersimpan.
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
                  placeholder="Contoh: Ustadz telah mengundurkan diri dari pesantren."
                  className={inputCls + " resize-none"}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setIsRemoveModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl hover:bg-slate-200 transition-colors">
                  Batal
                </button>
                <button
                  onClick={handleRemoveUstadz}
                  disabled={isRemoving || !removeReason.trim()}
                  className="flex-1 bg-rose-500 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 active:translate-y-px transition-transform disabled:opacity-60"
                  style={{ boxShadow: "0 3px 0 0 #b91c1c" }}
                >
                  {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX size={14} />} Nonaktifkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
