"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, User, Eye, EyeOff, ShieldCheck, Loader2, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        
        setSuccess("Login berhasil! Mengalihkan ke dashboard...");
        router.push('/');
      } else {
        if (!name.trim()) {
          throw new Error("Nama lengkap Ustadz wajib diisi");
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name.trim()
            }
          }
        });

        if (signUpError) throw signUpError;

        if (!data.session) {
          // Supabase Email Confirmation is required
          setSuccess("Akun berhasil didaftarkan!");
        } else {
          setSuccess("Akun berhasil dibuat! Mengalihkan ke dashboard...");
          router.push('/');
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      const msg = err?.message || "Terjadi kesalahan saat autentikasi";
      if (msg.toLowerCase().includes("email not confirmed")) {
        setError("Email belum diverifikasi.");
      } else if (msg.toLowerCase().includes("invalid login credentials")) {
        setError("Email atau kata sandi tidak valid.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Gradients & Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[300px] h-[300px] bg-teal-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Portal Evaluasi Ustadz</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2 font-serif">
            <span className="text-emerald-500">CIA.</span> Portal
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">
           Character Integrated Assessment Platform
          </p>
        </div>

        {/* Auth Glassmorphism Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl shadow-emerald-950/40 relative">
          
          {/* Tab Switcher */}
          <div className="flex bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800 mb-8">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                isLogin
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(null); setSuccess(null); }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                !isLogin
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Daftar Ustadz
            </button>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 font-medium">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 font-medium">
              <Loader2 className="w-5 h-5 text-emerald-400 shrink-0 animate-spin" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Nama Lengkap & Gelar
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-4 w-5 h-5 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ustaz Abdullah Fauzi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Alamat Email
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-4 w-5 h-5 text-slate-500 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="ustadz@pesantren.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Kata Sandi
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 w-5 h-5 text-slate-500 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-12 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-6 py-4 px-6 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] ${
                loading
                  ? 'bg-emerald-600/50 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-950'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? 'Masuk Portal' : 'Daftar & Masuk'}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Info */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
            <p className="text-slate-500 text-xs italic">
              &quot;Menjaga dan memantau perkembangan santri dengan sepenuh hati dan ketelitian.&quot;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
