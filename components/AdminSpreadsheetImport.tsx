"use client";

import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";

type ImportKind = "students" | "teachers";
type ImportRow = { name: string; nis?: string; email?: string; password?: string; role?: string };

const configs = {
  students: {
    title: "Import Data Santri",
    description: "Tambahkan banyak santri sekaligus ke institusi aktif.",
    headers: ["nama", "nis"],
    example: [["Ahmad Fauzi", "2026001"], ["Siti Aisyah", "2026002"]],
  },
  teachers: {
    title: "Import Data Ustadz",
    description: "Buat akun ustadz, admin, atau owner sekaligus.",
    headers: ["nama", "email", "password", "role"],
    example: [["Ahmad Fauzi", "ahmad@example.com", "password", "ustadz"]],
  },
} as const;

export function AdminSpreadsheetImport({ kind, organizationId, onComplete }: { kind: ImportKind; organizationId: string; onComplete: () => void }) {
  const config = configs[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const templateUrl = useMemo(() => {
    const sheet = XLSX.utils.aoa_to_sheet([Array.from(config.headers), ...config.example.map((row) => Array.from(row))]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Template");
    const base64 = XLSX.write(workbook, { bookType: "xlsx", type: "base64" });
    return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
  }, [config]);

  function close() {
    if (busy) return;
    setOpen(false); setRows([]); setIssues([]); setFileName(""); setResult(null);
  }

  async function readFile(file: File) {
    setFileName(file.name); setRows([]); setIssues([]); setResult(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed: ImportRow[] = [];
      const nextIssues: string[] = [];
      raw.forEach((item, index) => {
        const rowNo = index + 2;
        const value = (key: string) => String(item[key] ?? item[key.toUpperCase()] ?? "").trim();
        const row: ImportRow = { name: value("nama") || value("name") };
        if (kind === "students") row.nis = value("nis");
        else { row.email = value("email").toLowerCase(); row.password = value("password"); row.role = value("role") || "ustadz"; }
        if (!row.name) nextIssues.push(`Baris ${rowNo}: nama wajib diisi.`);
        if (kind === "teachers" && (!row.email || !/^\S+@\S+\.\S+$/.test(row.email))) nextIssues.push(`Baris ${rowNo}: email tidak valid.`);
        if (kind === "teachers" && (row.password ?? "").length < 6) nextIssues.push(`Baris ${rowNo}: password minimal 6 karakter.`);
        if (kind === "teachers" && !["ustadz", "admin", "owner"].includes(row.role ?? "")) nextIssues.push(`Baris ${rowNo}: role harus ustadz, admin, atau owner.`);
        if (row.name && (kind === "students" || (row.email && row.password && row.role && ["ustadz", "admin", "owner"].includes(row.role)))) parsed.push(row);
      });
      setRows(parsed); setIssues(nextIssues);
    } catch { setIssues(["File tidak dapat dibaca. Gunakan file Excel atau CSV dengan template yang tersedia."]); }
  }

  async function importRows() {
    if (!rows.length || issues.length) return;
    setBusy(true); setResult(null);
    try {
      if (kind === "students") {
        const { supabase } = await import("@/lib/supabase");
        const { error } = await supabase.from("students").insert(rows.map((row) => ({ name: row.name, nis: row.nis || null, organization_id: organizationId })));
        if (error) throw error;
      } else {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase.auth.getSession();
        for (const row of rows) {
          const response = await fetch("/api/admin/create-org-user", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ orgIds: [organizationId], name: row.name, email: row.email, password: row.password, role: row.role }) });
          const payload = await response.json();
          if (!response.ok || !payload.success) throw new Error(`${row.email}: ${payload.error || "Import akun gagal."}`);
        }
      }
      setResult(`${rows.length} data berhasil diimpor.`); onComplete();
    } catch (error: any) { setResult(`Gagal mengimpor: ${error?.message ?? "Terjadi kesalahan."}`); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2 border-brand-200 bg-brand-50 text-brand-700 text-xs font-black hover:bg-brand-100 transition-colors"><Upload size={14} /> Import Excel</button>
    {open && createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-lg relative" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
        <button onClick={close} className="absolute right-5 top-5 w-8 h-8 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center"><X size={16} /></button>
        <div className="mb-5"><div className="w-11 h-11 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mb-3"><FileSpreadsheet size={20} /></div><h3 className="text-xl font-black text-slate-800">{config.title}</h3><p className="text-sm font-bold text-slate-400 mt-1">{config.description}</p></div>
        <div className="flex items-center gap-2 mb-4"><a download={`template-${kind}.xlsx`} href={templateUrl} className="inline-flex items-center gap-2 text-xs font-black text-brand-700 bg-brand-50 border-2 border-brand-100 rounded-xl px-3 py-2"><Download size={13} /> Download template</a><span className="text-[10px] text-slate-400 font-bold">Kolom: {config.headers.join(", ")}</span></div>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
        <button type="button" onClick={() => inputRef.current?.click()} className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center hover:border-brand-300 transition-colors"><Upload className="mx-auto text-slate-400 mb-2" size={22} /><p className="text-sm font-black text-slate-600">{fileName || "Pilih file Excel atau CSV"}</p><p className="text-[10px] font-bold text-slate-400 mt-1">Baris pertama harus berisi nama kolom</p></button>
        {issues.length > 0 && <div className="mt-4 rounded-xl bg-rose-50 border-2 border-rose-100 p-3 text-[11px] font-bold text-rose-700 space-y-1"><p className="font-black flex items-center gap-1"><AlertCircle size={13} /> Periksa data berikut:</p>{issues.slice(0, 6).map((issue) => <p key={issue}>• {issue}</p>)}{issues.length > 6 && <p>…dan {issues.length - 6} masalah lainnya.</p>}</div>}
        {rows.length > 0 && <div className="mt-4 rounded-xl bg-slate-50 border-2 border-slate-100 p-3"><p className="text-xs font-black text-slate-700">Preview: {rows.length} baris siap diimpor</p><div className="mt-2 max-h-24 overflow-y-auto space-y-1">{rows.slice(0, 5).map((row, i) => <p key={i} className="text-[11px] font-bold text-slate-500">{row.name}{row.email ? ` · ${row.email} · ${row.role}` : row.nis ? ` · NIS ${row.nis}` : ""}</p>)}</div></div>}
        {result && <p className={`mt-4 text-xs font-black ${result.startsWith("Gagal") ? "text-rose-600" : "text-brand-700"}`}>{result}</p>}
        <button type="button" disabled={busy || !rows.length || issues.length > 0} onClick={importRows} className="w-full mt-5 bg-brand-500 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50" style={{ boxShadow: "0 3px 0 0 var(--brand-700)" }}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {busy ? "Mengimpor…" : `Import ${rows.length || "data"}`}</button>
      </div>
    </div>, document.body)}
  </>;
}
