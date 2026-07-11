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
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { Users, Search, Loader2, Sparkles, Mail, Calendar, X, Plus, UserPlus, AlertCircle, Eye, EyeOff, UserX, ArchiveX, ShieldCheck, ArrowLeftRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useUserRole } from '@/lib/hooks/use-user-role';

export default function ManageUstadzPage() {
  const { organizationId } = useUserRole();
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

  // Role Change Modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [userToChangeRole, setUserToChangeRole] = useState<any>(null);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const fetchUstadz = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      // Membership in the ACTIVE org is the source of truth for who belongs
      // here — querying `profiles` directly (as this used to) is scoped only
      // by RLS, which allows reading any profile that shares ANY org with the
      // caller. For an owner of multiple orgs that leaked every org's
      // members into every org's list.
      const membersRes = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organizationId);
      const memberIds = (membersRes.data ?? []).map((m: any) => m.user_id);
      const roleByUserId = new Map((membersRes.data ?? []).map((m: any) => [m.user_id, m.role]));

      if (memberIds.length === 0) {
        setUstadzList([]);
        setRemovedList([]);
        return;
      }

      const [activeRes, removedRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .in('id', memberIds)
          .or('is_removed.is.null,is_removed.eq.false')
          .order('name'),
        supabase
          .from('profiles')
          .select('*')
          .in('id', memberIds)
          .eq('is_removed', true)
          .order('removed_at', { ascending: false }),
      ]);
      if (activeRes.data) {
        setUstadzList(activeRes.data.map((u: any) => ({ ...u, role: roleByUserId.get(u.id) ?? u.role })));
      }
      if (removedRes.data) {
        setRemovedList(removedRes.data.map((u: any) => ({ ...u, role: roleByUserId.get(u.id) ?? u.role })));
      }
    } catch (err) {
      console.error("Error fetching ustadz profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUstadz(); }, [organizationId]);

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
      const { data: signUpData, error } = await authClient.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { name: formData.name, role: formData.role } }
      });
      if (error) throw error;

      // A DB trigger auto-enrolls every new profile into the hardcoded
      // "sekolah-impian" org. That's wrong when the admin creating this
      // account is currently switched into a different org — explicitly
      // upsert membership into the ACTIVE org so the new ustadz lands where
      // the admin actually intended.
      if (signUpData.user?.id && organizationId) {
        const { error: memberError } = await supabase
          .from('organization_members')
          .upsert(
            { organization_id: organizationId, user_id: signUpData.user.id, role: formData.role },
            { onConflict: 'organization_id,user_id' }
          );
        if (memberError) throw memberError;
      }

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

  const openRoleModal = (user: any) => {
    setUserToChangeRole(user);
    setRoleError(null);
    setIsRoleModalOpen(true);
  };

  const handleChangeRole = async () => {
    if (!userToChangeRole) return;
    setIsChangingRole(true);
    setRoleError(null);
    const newRole = userToChangeRole.role === 'admin' ? 'ustadz' : 'admin';
    try {
      const { error: memberError } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('organization_id', organizationId)
        .eq('user_id', userToChangeRole.id);
      if (memberError) throw memberError;

      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userToChangeRole.id);
      if (error) throw error;
      setIsRoleModalOpen(false);
      setUserToChangeRole(null);
      fetchUstadz();
    } catch (err: any) {
      setRoleError(err.message || 'Gagal mengubah role pengguna.');
    } finally {
      setIsChangingRole(false);
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

  const inputCls = "w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-brand-400 transition-colors";
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
            className="inline-flex items-center gap-2 bg-brand-500 text-white px-5 py-2.5 rounded-xl font-black text-sm active:translate-y-px transition-transform"
            style={{ boxShadow: "0 3px 0 0 var(--brand-700)" }}
          >
            <UserPlus size={15} /> Tambah Pengguna
          </button>
        )}
      </div>

      {/* Active / Removed tab toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowRemoved(false); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-xl font-black text-sm transition-colors ${!showRemoved ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          style={!showRemoved ? { boxShadow: "0 3px 0 0 var(--brand-700)" } : {}}
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
          className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:border-brand-400 transition-all"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand-500" /></div>
      ) : displayList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayList.map((user) => (
            <div
              key={user.id}
              className={`bg-white rounded-[1.5rem] border-2 p-4 flex items-start gap-3 ${showRemoved ? 'border-rose-100 opacity-80' : 'border-slate-100'}`}
              style={{ boxShadow: showRemoved ? "0 3px 0 0 #fee2e2" : "0 3px 0 0 #e2e8f0" }}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shrink-0 ${showRemoved ? 'bg-slate-200 text-slate-500' : user.role === "admin" ? "bg-slate-900 text-white" : "bg-brand-100 text-brand-700"}`}
                style={!showRemoved && user.role === "admin" ? { boxShadow: "0 3px 0 0 #000" } : !showRemoved ? { boxShadow: "0 3px 0 0 var(--brand-200)" } : {}}
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
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => openRoleModal(user)}
                    className="p-2 text-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 rounded-xl transition-colors"
                    title={user.role === 'admin' ? 'Jadikan Ustadz' : 'Jadikan Admin'}
                  >
                    <ArrowLeftRight size={15} />
                  </button>
                  <button
                    onClick={() => openRemoveModal(user)}
                    className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 active:bg-rose-100 rounded-xl transition-colors"
                    title="Nonaktifkan pengguna"
                  >
                    <UserX size={15} />
                  </button>
                </div>
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
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-7 w-full max-w-md relative" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
            <button onClick={() => { setIsModalOpen(false); setModalError(null); setModalSuccess(null); }} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors">
              <X size={16} />
            </button>
            <div className="mb-6">
              <div className="w-11 h-11 bg-brand-100 rounded-2xl flex items-center justify-center mb-3" style={{ boxShadow: "0 3px 0 0 var(--brand-200)" }}>
                <UserPlus size={20} className="text-brand-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Tambah Pengguna</h3>
              <p className="text-slate-400 text-sm font-bold mt-0.5">Daftarkan akun Ustadz atau Admin baru.</p>
            </div>
            {modalError && <div className="mb-4 p-3 bg-rose-50 border-2 border-rose-200 text-rose-600 text-sm rounded-xl flex items-center gap-2 font-bold"><AlertCircle size={15} />{modalError}</div>}
            {modalSuccess && <div className="mb-4 p-3 bg-brand-50 border-2 border-brand-200 text-brand-700 text-sm rounded-xl flex items-center gap-2 font-black"><Sparkles size={15} />{modalSuccess}</div>}
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
              <button type="submit" disabled={isSubmitting || !!modalSuccess} className="w-full mt-2 bg-brand-500 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 active:translate-y-px transition-transform disabled:opacity-60" style={{ boxShadow: "0 3px 0 0 var(--brand-700)" }}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />} Simpan Pengguna
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Role Change Modal */}
      {isRoleModalOpen && userToChangeRole && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-7 w-full max-w-md relative" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
            <button onClick={() => setIsRoleModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors">
              <X size={16} />
            </button>
            <div className="mb-6">
              <div className="w-11 h-11 bg-indigo-100 rounded-2xl flex items-center justify-center mb-3" style={{ boxShadow: "0 3px 0 0 #c7d2fe" }}>
                <ShieldCheck size={20} className="text-indigo-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Ubah Role</h3>
              <p className="text-slate-400 text-sm font-bold mt-0.5">
                <strong className="text-slate-700">{userToChangeRole.name}</strong> saat ini adalah{' '}
                <span className={`font-black ${userToChangeRole.role === 'admin' ? 'text-slate-900' : 'text-brand-600'}`}>
                  {userToChangeRole.role === 'admin' ? 'Admin' : 'Ustadz'}
                </span>.
              </p>
            </div>
            {roleError && <div className="mb-4 p-3 bg-rose-50 border-2 border-rose-200 text-rose-600 text-sm rounded-xl flex items-center gap-2 font-bold"><AlertCircle size={15} />{roleError}</div>}
            <div className="flex items-center justify-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
              <div className="text-center">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base mx-auto mb-1.5 ${userToChangeRole.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-brand-100 text-brand-700'}`}>
                  {userToChangeRole.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {userToChangeRole.role === 'admin' ? 'Admin' : 'Ustadz'}
                </span>
              </div>
              <ArrowLeftRight size={18} className="text-indigo-400 shrink-0" />
              <div className="text-center">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base mx-auto mb-1.5 ${userToChangeRole.role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-slate-900 text-white'}`}>
                  {userToChangeRole.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {userToChangeRole.role === 'admin' ? 'Ustadz' : 'Admin'}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsRoleModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl hover:bg-slate-200 transition-colors">
                Batal
              </button>
              <button
                onClick={handleChangeRole}
                disabled={isChangingRole}
                className="flex-1 bg-indigo-500 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 active:translate-y-px transition-transform disabled:opacity-60"
                style={{ boxShadow: "0 3px 0 0 #4338ca" }}
              >
                {isChangingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck size={14} />}
                Konfirmasi
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Remove Modal */}
      {isRemoveModalOpen && userToRemove && createPortal(
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
        </div>,
        document.body
      )}
    </div>
  );
}
