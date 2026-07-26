/**
 * app/login/page.tsx
 *
 * Authentication page — handles login and password recovery for
 * ustadz (teachers). Accessed directly at /login and redirected to by
 * AuthProvider whenever a user attempts to access a protected route without
 * an active session.
 *
 * Auth flow:
 *   Login  → supabase.auth.signInWithPassword() → redirect to /
 *   Password recovery → supabase.auth.resetPasswordForEmail() → /reset-password
 */
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Loader2, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
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
      if (isForgotPassword) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        setSuccess("Jika email terdaftar, tautan untuk mengatur ulang kata sandi telah dikirim.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        
        setSuccess("Login berhasil! Mengalihkan ke dashboard...");
        router.push('/');
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
    <div className="min-h-screen w-full bg-paper text-slate-800 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 border-2 border-brand-100 text-brand-700 text-xs font-black mb-4">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>Portal Evaluasi Ustadz</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center justify-center gap-2 font-serif">
            <span className="text-brand-600">CDS</span> Portal
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-bold">
           Character Development System
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 relative" style={{ boxShadow: "0 6px 0 0 #e2e8f0" }}>

          {/* Feedback Messages */}
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-100 text-rose-600 text-xs rounded-2xl flex items-center gap-3 animate-fade-in font-bold">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-brand-50 border-2 border-brand-100 text-brand-700 text-xs rounded-2xl flex items-center gap-3 animate-fade-in font-bold">
              <Loader2 className="w-5 h-5 text-brand-500 shrink-0 animate-spin" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                Alamat Email
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="ustadz@pesantren.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-800 font-bold text-sm placeholder:text-slate-300 placeholder:font-normal focus:outline-none focus:border-brand-400 transition-colors"
                  style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={() => { setIsForgotPassword(true); setError(null); setSuccess(null); }}
                  className="text-xs font-black text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Lupa kata sandi?
                </button>
              </div>
            )}

            {!isForgotPassword && <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                Kata Sandi
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-12 pr-12 text-slate-800 font-bold text-sm placeholder:text-slate-300 placeholder:font-normal focus:outline-none focus:border-brand-400 transition-colors"
                  style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-6 py-4 px-6 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-3 transition-all active:translate-y-1 ${
                loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-brand-500'
              }`}
              style={loading ? {} : { boxShadow: "0 4px 0 0 var(--brand-700)" }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>{isForgotPassword ? 'Kirim Tautan Reset' : 'Masuk Portal'}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {isForgotPassword && (
            <button
              type="button"
              onClick={() => { setIsForgotPassword(false); setError(null); setSuccess(null); }}
              className="w-full mt-4 text-xs font-black text-slate-500 hover:text-slate-700"
            >
              Kembali ke halaman masuk
            </button>
          )}

          {/* Quick Info */}
          <div className="mt-8 pt-6 border-t-2 border-slate-100 text-center">
            <p className="text-slate-400 text-xs italic font-bold">
              &quot;Menjaga dan memantau perkembangan santri dengan sepenuh hati dan ketelitian.&quot;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
