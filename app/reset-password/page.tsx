"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError("Kata sandi minimal 6 karakter.");
      return;
    }
    if (password !== confirmation) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess("Kata sandi berhasil diubah. Mengalihkan ke halaman masuk...");
    await supabase.auth.signOut();
    window.setTimeout(() => router.push("/login"), 1200);
  };

  return (
    <div className="min-h-screen w-full bg-paper text-slate-800 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 border-2 border-brand-100 text-brand-700 text-xs font-black mb-4">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>Portal Evaluasi Ustadz</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center justify-center gap-2 font-serif">
            <KeyRound className="w-7 h-7 text-brand-600" />
            Atur Ulang Kata Sandi
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-bold">Buat kata sandi baru untuk akun Anda.</p>
        </div>

        <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8" style={{ boxShadow: "0 6px 0 0 #e2e8f0" }}>
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-100 text-rose-600 text-xs rounded-2xl flex items-center gap-3 font-bold">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-brand-50 border-2 border-brand-100 text-brand-700 text-xs rounded-2xl flex items-center gap-3 font-bold">
              <Loader2 className="w-5 h-5 text-brand-500 shrink-0 animate-spin" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {[
              { label: "Kata Sandi Baru", value: password, setValue: setPassword, shown: showPassword, toggle: () => setShowPassword(!showPassword) },
              { label: "Konfirmasi Kata Sandi", value: confirmation, setValue: setConfirmation, shown: showConfirmation, toggle: () => setShowConfirmation(!showConfirmation) },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">{field.label}</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                  <input
                    type={field.shown ? "text" : "password"}
                    required
                    minLength={6}
                    value={field.value}
                    onChange={(event) => field.setValue(event.target.value)}
                    className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-12 pr-12 text-slate-800 font-bold text-sm focus:outline-none focus:border-brand-400 transition-colors"
                    style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
                  />
                  <button type="button" onClick={field.toggle} className="absolute right-4 p-1 text-slate-400 hover:text-slate-600">
                    {field.shown ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ))}

            <button type="submit" disabled={loading} className={`w-full mt-2 py-4 px-6 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-3 ${loading ? "bg-slate-300" : "bg-brand-500"}`} style={loading ? {} : { boxShadow: "0 4px 0 0 var(--brand-700)" }}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Simpan Kata Sandi</span><ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
