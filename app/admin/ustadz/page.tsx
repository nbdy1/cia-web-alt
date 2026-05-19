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

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manajemen Pengguna</h2>
          <p className="text-slate-500 text-sm">Lihat dan kelola daftar Ustadz serta Admin</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-200"
        >
          <UserPlus size={16} />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, email, atau role..."
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
            {filteredList.map((user) => (
              <div key={user.id} className="p-5 rounded-3xl border border-slate-100 hover:border-emerald-200 transition-colors bg-white shadow-sm flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${user.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                  {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-slate-800 text-base truncate flex items-center gap-2">
                    {user.name}
                    {user.role === 'admin' && (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">Admin</span>
                    )}
                  </h3>
                  <div className="flex flex-col gap-1 mt-2">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail size={12} />
                      <span className="truncate">{user.email}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      <Calendar size={12} />
                      Terdaftar: {new Date(user.created_at).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">
              {searchQuery ? 'Tidak ada pengguna yang cocok dengan pencarian' : 'Belum ada data pengguna'}
            </p>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            <button 
              onClick={() => {
                setIsModalOpen(false);
                setModalError(null);
                setModalSuccess(null);
              }}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-8">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                <UserPlus size={24} />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Tambah Pengguna</h3>
              <p className="text-slate-500 text-sm mt-1">Daftarkan akun Ustadz atau Admin baru.</p>
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

            <form onSubmit={handleAddUstadz} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Ustaz Abdullah"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="ustadz@pesantren.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors appearance-none"
                >
                  <option value="ustadz">Ustadz</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || modalSuccess !== null}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-emerald-200"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus size={20} />}
                <span>Simpan Pengguna</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
