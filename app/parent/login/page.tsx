/**
 * app/parent/login/page.tsx
 *
 * Separate sign-in for parents. Staff sign in at /login. One email is one
 * account, so a teacher who is also a parent uses a different email here
 * (e.g. name+ortu@gmail.com); a staff account that tries this page is refused.
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GoogleButton } from "@/components/parent/GoogleButton";

const field =
  "w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-800 font-bold text-sm placeholder:text-slate-300 placeholder:font-normal focus:outline-none focus:border-brand-400";

export default function ParentLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        throw new Error(/invalid login/i.test(signInError.message) ? "Email atau kata sandi tidak valid." : signInError.message);
      }
      const { data: memberships } = await supabase.from("organization_members").select("role").eq("user_id", data.user.id);
      const roles = (memberships ?? []).map((m: { role: string }) => m.role);
      if (roles.some((r) => r !== "parent")) {
        await supabase.auth.signOut();
        throw new Error("Ini akun staf sekolah. Masuk lewat halaman staf, atau daftar akun orang tua dengan email yang berbeda.");
      }
      window.location.assign(roles.length === 0 ? "/parent/link" : "/parent");
    } catch (err: any) {
      setError(err?.message || "Gagal masuk.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-paper flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-serif">
            <span className="text-brand-600">CDS</span> Orang Tua
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-bold">Pantau perkembangan karakter anak Anda</p>
        </div>

        <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-7" style={{ boxShadow: "0 6px 0 0 #e2e8f0" }}>
          {error && (
            <div className="mb-5 p-4 bg-rose-50 border-2 border-rose-100 text-rose-600 text-xs rounded-2xl flex items-center gap-3 font-bold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <GoogleButton label="Masuk dengan Google" />
          <p className="my-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">atau dengan email</p>

          <form onSubmit={submit} className="space-y-4">
            <div className="relative flex items-center">
              <Mail className="absolute left-4 w-5 h-5 text-slate-400" />
              <input className={field} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 w-5 h-5 text-slate-400" />
              <input className={`${field} pr-12`} type={show ? "text" : "password"} required placeholder="Kata sandi" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-4 text-slate-400" aria-label="Tampilkan kata sandi">
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-3 ${loading ? "bg-slate-300" : "bg-brand-500"}`}
              style={loading ? {} : { boxShadow: "0 4px 0 0 var(--brand-700)" }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Masuk <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-xs font-bold text-slate-500">
            Belum punya akun? <Link href="/parent/signup" className="text-brand-600 underline">Daftar dengan kode santri</Link>
          </p>
          <p className="mt-2 text-center text-xs font-bold text-slate-400">
            Guru atau admin? <Link href="/login" className="underline">Masuk di sini</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
