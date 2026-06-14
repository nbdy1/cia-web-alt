/**
 * app/admin/ustadz/page.tsx
 *
 * Teacher (ustadz) management page for admins. Reads from the `profiles` table
 * (which mirrors Supabase Auth users). Provides:
 *   - List all ustadz with search and email/date display
 *   - Add a new ustadz account (creates Supabase Auth user + profile row)
 *   - View/toggle password visibility for accounts
 *   - Delete an ustadz account
 *
 * Note: Creating an ustadz here uses the Admin Auth API (service role key
 * is required on the server side). Confirm this is handled securely before
 * exposing the create/delete features in production.
 */
"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Search, Loader2, Sparkles, Mail, Calendar, ExternalLink, X, Plus, UserPlus, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

export default function ManageUstadzPage() {
  const [ustadzList, setUstadzList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ustadz'
  });
  const [showPassword, setShowPassword] = useState(false);

  const fetchUstadz = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name');
      
      if (!error && data) {
        setUstadzList(data);
      }
    } catch (err) {
      console.error("Error fetching ustadz profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUstadz();
  }, []);

  const handleAddUstadz = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      // Create a local supabase client without session persistence 
      // so we don't log out the currently logged-in Admin!
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const { data, error } = await authClient.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: formData.role
          }
        }
      });

      if (error) throw error;

      setModalSuccess("Pengguna berhasil didaftarkan!");
      
      // Clear form
      setFormData({ name: '', email: '', password: '', role: 'ustadz' });
      
      // Refresh list
      fetchUstadz();

      // Auto close after 2 seconds
      setTimeout(() => {
        setIsModalOpen(false);
        setModalSuccess(null);
      }, 2000);

    } catch (err: any) {
      console.error("Error creating user:", err);
      setModalError(err.message || "Gagal mendaftarkan pengguna baru");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredList = ustadzList.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const inputCls = "w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-colors";
  const labelCls = "block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5";

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Manajemen Pengguna</h2>
          <p className="text-slate-400 text-sm font-bold mt-0.5">Kelola daftar Ustadz dan Admin</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-black text-sm active:translate-y-px transition-transform"
          style={{ boxShadow: "0 3px 0 0 #15803d" }}
        >
          <UserPlus size={15} /> Tambah Pengguna
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Cari nama, email, atau role…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-all"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-emerald-500" /></div>
      ) : filteredList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredList.map((user) => (
            <div key={user.id} className="bg-white rounded-[1.5rem] border-2 border-slate-100 p-4 flex items-start gap-3" style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}>
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shrink-0 ${user.role === "admin" ? "bg-slate-900 text-white" : "bg-emerald-100 text-emerald-700"}`}
                style={user.role === "admin" ? { boxShadow: "0 3px 0 0 #000" } : { boxShadow: "0 3px 0 0 #a7f3d0" }}>
                {user.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div className="overflow-hidden flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-slate-800 text-sm truncate">{user.name}</p>
                  {user.role === "admin" && <span className="text-[9px] font-black uppercase tracking-widest bg-slate-900 text-white px-2 py-0.5 rounded-md shrink-0">Admin</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400 font-bold">
                  <Mail size={11} /><span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-black uppercase tracking-wider">
                  <Calendar size={10} /> {new Date(user.created_at).toLocaleDateString("id-ID")}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-[1.5rem] border-2 border-dashed border-slate-200">
          <Users className="w-8 h-8 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400 font-black text-sm">{searchQuery ? "Tidak ada hasil pencarian" : "Belum ada data pengguna"}</p>
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
    </div>
  );
}
