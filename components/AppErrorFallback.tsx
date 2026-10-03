"use client";

import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

type AppErrorFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
  scope: "assessment" | "application";
};

export function AppErrorFallback({ error, reset, scope }: AppErrorFallbackProps) {
  const isAssessment = scope === "assessment";

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-5">
      <section
        className="w-full max-w-md rounded-[2rem] border-2 border-rose-100 bg-white p-7 text-center"
        style={{ boxShadow: "0 5px 0 #ffe4e6" }}
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <p className="mt-5 text-xs font-black uppercase tracking-widest text-rose-600">
          Gangguan sementara
        </p>
        <h1 className="mt-2 text-2xl font-black leading-tight text-slate-900">
          {isAssessment ? "Halaman input belum bisa dibuka" : "Halaman belum bisa dimuat"}
        </h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">
          Coba muat ulang terlebih dahulu. Jika masih terjadi, kembali ke halaman sebelumnya lalu buka lagi.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              reset();
              window.location.reload();
            }}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-3 text-sm font-black text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Muat ulang
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 px-3 text-sm font-black text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </button>
        </div>
        {error.digest && <p className="mt-5 text-[10px] font-bold text-slate-400">Kode bantuan: {error.digest}</p>}
      </section>
    </main>
  );
}
