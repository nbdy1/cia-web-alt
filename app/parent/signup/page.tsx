/**
 * app/parent/signup/page.tsx
 *
 * Public parent registration. A parent needs at least one pairing code from the
 * school (one per child; more can be added now or later). The account is created
 * by /api/parent/signup, then the parent is signed in straight away.
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Loader2, Lock, Mail, Plus, User, X, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GoogleButton } from "@/components/parent/GoogleButton";
import { PARENT_MAX_CODES, PARENT_MIN_PASSWORD } from "@/lib/parent";

const field =
  "w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-800 font-bold text-sm placeholder:text-slate-300 placeholder:font-normal focus:outline-none focus:border-brand-400";

export default function ParentSignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setCode = (i: number, value: string) =>
    setCodes((prev) => prev.map((c, idx) => (idx === i ? value.toUpperCase() : c)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/parent/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, codes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Pendaftaran gagal.");

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      // Document navigation so the server can route to the school's host.
      window.location.assign("/");
    } catch (err: any) {
      setError(err?.message || "Pendaftaran gagal.");
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

          <GoogleButton label="Daftar dengan Google" />
          <p className="my-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">atau dengan email · kode santri diminta setelah masuk Google</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="relative flex items-center">
              <User className="absolute left-4 w-5 h-5 text-slate-400" />
              <input className={field} placeholder="Nama lengkap" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="relative flex items-center">
              <Mail className="absolute left-4 w-5 h-5 text-slate-400" />
              <input className={field} type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 w-5 h-5 text-slate-400" />
              <input
                className={field}
                type="password"
                placeholder={`Kata sandi (min. ${PARENT_MIN_PASSWORD} karakter)`}
                required
                minLength={PARENT_MIN_PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Kode santri</p>
              <div className="space-y-2">
                {codes.map((code, i) => (
                  <div key={i} className="relative flex items-center">
                    <KeyRound className="absolute left-4 w-5 h-5 text-slate-400" />
                    <input
                      className={`${field} font-mono tracking-widest pr-12`}
                      placeholder="K7M2-9QXA"
                      required={i === 0}
                      value={code}
                      onChange={(e) => setCode(i, e.target.value)}
                    />
                    {i > 0 && (
                      <button type="button" aria-label="Hapus kode" className="absolute right-4 text-slate-400" onClick={() => setCodes((p) => p.filter((_, j) => j !== i))}>
                        <X size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {codes.length < PARENT_MAX_CODES && (
                <button type="button" onClick={() => setCodes((p) => [...p, ""])} className="mt-3 flex items-center gap-1.5 text-xs font-bold text-brand-600">
                  <Plus size={14} /> Tambah anak lain
                </button>
              )}
              <p className="mt-2 text-[11px] text-slate-400">Kode diberikan oleh sekolah, satu kode untuk setiap anak.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-2 py-4 px-6 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-3 ${loading ? "bg-slate-300" : "bg-brand-500"}`}
              style={loading ? {} : { boxShadow: "0 4px 0 0 var(--brand-700)" }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Daftar <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-xs font-bold text-slate-500">
            Sudah punya akun? <Link href="/parent/login" className="text-brand-600 underline">Masuk</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
