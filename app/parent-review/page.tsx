/**
 * app/parent-review/page.tsx
 *
 * Musyrif approval queue for the parent dashboard. Nothing reaches a parent
 * until it is approved here. For each AI draft the musyrif sees the original
 * observation next to the parent-facing version, can edit or delete parts,
 * hold it back, or approve & send. Sensitive drafts must be opened one by one
 * after the musyrif has contacted the parent directly.
 */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, CheckCheck, Loader2, PauseCircle, Send, Undo2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/context/auth-context";
import { ContentEditor } from "@/components/parent/ContentEditor";
import {
  answerParentQuestion, approveContent, bulkApprovePositive, correctPublished, holdContent,
  releaseContent, setMyContactPhone, withdrawContent,
} from "@/app/actions/parent-review";
import { KIND_LABEL, REVIEW_REMINDER_DAYS, aspectLabel, daysWaiting, monthLabel, type AnyContent, type ContentType } from "@/lib/parent";

type Item = {
  id: string; student_id: string; content_type: ContentType; kind: "kabar_baik" | "didampingi" | null; aspect: string | null;
  report_id: string | null; period_key: string | null; content: AnyContent; draft: AnyContent; status: "pending" | "held" | "published" | "superseded";
  sensitive: boolean; sensitive_reason: string | null; created_at: string; version: number; published_at: string | null;
};
type Question = { id: string; student_id: string; question: string; answer: string | null; created_at: string };
type Home = { student_id: string; interests: string; habits: string; important_notes: string };
type Original = { title: string | null; summary: string; focus: string; plan: string; id: string };

const titleOf = (i: Item) =>
  i.content_type === "update" ? `${KIND_LABEL[i.kind ?? "kabar_baik"]} · ${aspectLabel(i.aspect)}`
  : i.content_type === "summary" ? `Rangkuman ${i.period_key ? monthLabel(i.period_key) : ""}` : "Profil karakter";

function originalOf(plan: any, id: string, title: string | null): Original {
  const p = typeof plan === "string" ? (() => { try { return JSON.parse(plan); } catch { return {}; } })() : plan ?? {};
  return { id, title, summary: p?.status_summary ?? "", focus: [p?.treatment?.priority_theme, p?.treatment?.priority_indicator].filter(Boolean).join(" — "), plan: p?.treatment?.action_plan ?? "" };
}

export default function ParentReviewPage() {
  const { activeOrganizationId, user } = useAuth();
  const [tab, setTab] = useState<"queue" | "sent" | "ask">("queue");
  const [items, setItems] = useState<Item[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [originals, setOriginals] = useState<Record<string, Original>>({});
  const [latest, setLatest] = useState<Record<string, Original>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [homes, setHomes] = useState<Home[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<AnyContent | null>(null);
  const [contacted, setContacted] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [phone, setPhone] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!activeOrganizationId) return;
    const [c, q, h, me] = await Promise.all([
      supabase.from("parent_contents").select("*").eq("organization_id", activeOrganizationId).in("status", ["pending", "held", "published"]).order("created_at", { ascending: false }).limit(300),
      supabase.from("parent_questions").select("id, student_id, question, answer, created_at").eq("organization_id", activeOrganizationId).order("created_at", { ascending: false }).limit(100),
      supabase.from("parent_home_profiles").select("student_id, interests, habits, important_notes").eq("organization_id", activeOrganizationId),
      user ? supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const rows = (c.data ?? []) as Item[];
    setItems(rows);
    setQuestions((q.data ?? []) as Question[]);
    setHomes((h.data ?? []) as Home[]);
    setPhone((me.data as { phone?: string } | null)?.phone ?? "");

    const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
    const reportIds = Array.from(new Set(rows.map((r) => r.report_id).filter(Boolean))) as string[];
    const [s, r, l] = await Promise.all([
      studentIds.length ? supabase.from("students").select("id, name").in("id", studentIds) : Promise.resolve({ data: [] }),
      reportIds.length ? supabase.from("reports").select("id, title, treatment_plan").in("id", reportIds) : Promise.resolve({ data: [] }),
      studentIds.length ? supabase.from("reports").select("id, student_id, title, treatment_plan, created_at").in("student_id", studentIds).order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
    ]);
    setNames(Object.fromEntries(((s.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])));
    setOriginals(Object.fromEntries(((r.data ?? []) as any[]).map((x) => [x.id, originalOf(x.treatment_plan, x.id, x.title)])));
    const lat: Record<string, Original> = {};
    ((l.data ?? []) as any[]).forEach((x) => { if (!lat[x.student_id]) lat[x.student_id] = originalOf(x.treatment_plan, x.id, x.title); });
    setLatest(lat);
    setLoading(false);
  }, [activeOrganizationId, user]);

  useEffect(() => { void load(); }, [load]);

  const queue = useMemo(() => items.filter((i) => i.status === "pending" || i.status === "held"), [items]);
  const sent = useMemo(() => items.filter((i) => i.status === "published"), [items]);
  const eligible = (i: Item) => i.content_type === "update" && i.kind === "kabar_baik" && !i.sensitive;

  const run = async (key: string, fn: () => Promise<{ success: boolean; error?: string }>, okText: string) => {
    setBusy(key); setNotice(null);
    const r = await fn();
    setNotice({ ok: r.success, text: r.success ? okText : r.error ?? "Gagal." });
    if (r.success) { setOpenId(null); setEdit(null); setContacted(false); setSelected(new Set()); await load(); }
    setBusy(null);
  };

  const open = (i: Item) => { setOpenId(i.id === openId ? null : i.id); setEdit(i.content); setContacted(false); };

  const renderItem = (i: Item, mode: "queue" | "sent") => {
    const orig = i.report_id ? originals[i.report_id] : latest[i.student_id];
    const waiting = daysWaiting(i.created_at);
    const isOpen = openId === i.id;
    return (
      <div key={i.id} className={`bg-white border-2 rounded-2xl p-4 ${i.sensitive ? "border-amber-200" : "border-slate-100"}`}>
        <div className="flex items-start gap-3">
          {mode === "queue" && eligible(i) && (
            <input type="checkbox" className="mt-1 w-4 h-4" checked={selected.has(i.id)}
              onChange={(e) => setSelected((p) => { const n = new Set(p); e.target.checked ? n.add(i.id) : n.delete(i.id); return n; })} />
          )}
          <button onClick={() => open(i)} className="flex-1 min-w-0 text-left">
            <p className="font-bold text-slate-900 truncate">{names[i.student_id] ?? "Santri"}</p>
            <p className="text-xs font-bold text-slate-500">{titleOf(i)}{i.version > 1 ? ` · versi ${i.version}` : ""}</p>
            <div className="mt-1 flex gap-1.5 flex-wrap">
              {i.sensitive && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">Sensitif · hubungi wali dulu</span>}
              {i.status === "held" && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">Ditahan</span>}
              {mode === "queue" && waiting >= REVIEW_REMINDER_DAYS && <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold">Menunggu {waiting} hari</span>}
            </div>
          </button>
        </div>

        {isOpen && edit && (
          <div className="mt-4 space-y-4">
            {i.sensitive && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs font-bold text-amber-800 flex gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{i.sensitive_reason ?? "Ditandai sensitif."} Hubungi wali langsung terlebih dahulu; jangan kirim lewat feed sebelum itu.</span>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 p-3 space-y-2 text-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Catatan asli (hanya untuk Anda)</p>
                {orig ? (
                  <>
                    {orig.summary && <p className="text-slate-700">{orig.summary}</p>}
                    {orig.focus && <p className="text-slate-500"><b>Prioritas:</b> {orig.focus}</p>}
                    {orig.plan && <p className="text-slate-500"><b>Rencana:</b> {orig.plan}</p>}
                    <Link href={`/reports/${orig.id}`} className="text-xs font-bold text-brand-600 underline">Buka laporan lengkap</Link>
                  </>
                ) : <p className="text-slate-400">Laporan asal tidak ditemukan.</p>}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mb-2">Versi untuk wali (bisa diedit)</p>
                <ContentEditor type={i.content_type} value={edit} onChange={setEdit} />
              </div>
            </div>

            {mode === "queue" ? (
              <div className="space-y-3">
                {i.sensitive && (
                  <label className="flex items-start gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" className="mt-0.5" checked={contacted} onChange={(e) => setContacted(e.target.checked)} />
                    Saya sudah menghubungi wali secara langsung.
                  </label>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button disabled={!!busy || (i.sensitive && !contacted)} onClick={() => run(i.id, () => approveContent(i.id, edit, contacted), "Terkirim ke wali.")}
                    className="px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold flex items-center gap-2 disabled:bg-slate-300">
                    {busy === i.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Setujui & kirim
                  </button>
                  {i.status === "pending" ? (
                    <button disabled={!!busy} onClick={() => run(i.id, () => holdContent(i.id), "Ditahan. Tidak tampil ke wali.")} className="px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-600 flex items-center gap-2"><PauseCircle size={14} /> Tahan</button>
                  ) : (
                    <button disabled={!!busy} onClick={() => run(i.id, () => releaseContent(i.id), "Kembali ke antrean.")} className="px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-600 flex items-center gap-2"><Undo2 size={14} /> Lepas tahan</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <button disabled={!!busy} onClick={() => run(i.id, () => correctPublished(i.id, edit), "Koreksi terkirim sebagai versi baru.")} className="px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold">Simpan koreksi (versi baru)</button>
                <button disabled={!!busy} onClick={() => confirm("Tarik kembali dari wali? Konten akan ditahan.") && run(i.id, () => withdrawContent(i.id), "Ditarik dari wali.")} className="px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-600">Tarik kembali</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const tabBtn = (key: typeof tab, label: string, count?: number) => (
    <button key={key} onClick={() => setTab(key)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${tab === key ? "bg-brand-500 text-white" : "bg-white border-2 border-slate-200 text-slate-600"}`}>
      {label}{count ? ` (${count})` : ""}
    </button>
  );

  return (
    <div className="min-h-screen bg-paper pb-20 font-sans">
      <div className="px-5 pt-10 pb-4 max-w-4xl mx-auto">
        <Link href="/" className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 mb-4"><ChevronLeft size={18} /></Link>
        <h1 className="text-2xl font-bold text-slate-900">Persetujuan Orang Tua</h1>
        <p className="text-sm text-slate-500 mt-1">Tidak ada yang tampil ke wali sebelum Anda menyetujuinya.</p>

        <div className="mt-4 flex gap-2 items-center">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Nomor HP Anda untuk wali (08… / +62…)" className="flex-1 bg-white border-2 border-slate-200 rounded-xl py-2 px-3 text-sm font-bold" />
          <button onClick={() => run("phone", () => setMyContactPhone(phone), "Kontak tersimpan.")} className="px-3 py-2 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-600">Simpan</button>
        </div>

        <div className="mt-4 flex gap-2">
          {tabBtn("queue", "Menunggu", queue.length)}
          {tabBtn("sent", "Terkirim", sent.length)}
          {tabBtn("ask", "Pertanyaan & rumah", questions.filter((q) => !q.answer).length)}
        </div>
        {notice && <p className={`mt-3 text-xs font-bold ${notice.ok ? "text-brand-700" : "text-rose-600"}`}>{notice.text}</p>}
      </div>

      <div className="px-5 max-w-4xl mx-auto space-y-3">
        {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand-600" /></div> : null}

        {!loading && tab === "queue" && (
          <>
            {queue.some(eligible) && (
              <div className="flex items-center justify-between gap-3 bg-white border-2 border-slate-100 rounded-2xl p-3">
                <button onClick={() => setSelected(new Set(queue.filter(eligible).map((i) => i.id)))} className="text-xs font-bold text-brand-600">Pilih semua kabar baik</button>
                <button disabled={selected.size === 0 || !!busy} onClick={() => run("bulk", () => bulkApprovePositive([...selected]), `${selected.size} kartu terkirim.`)}
                  className="px-3 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:bg-slate-300"><CheckCheck size={14} /> Setujui terpilih ({selected.size})</button>
              </div>
            )}
            {queue.length === 0 && <p className="text-center text-sm text-slate-500 py-12">Tidak ada yang menunggu. 🎉</p>}
            {queue.map((i) => renderItem(i, "queue"))}
          </>
        )}

        {!loading && tab === "sent" && (
          <>
            {sent.length === 0 && <p className="text-center text-sm text-slate-500 py-12">Belum ada yang terkirim.</p>}
            {sent.map((i) => renderItem(i, "sent"))}
          </>
        )}

        {!loading && tab === "ask" && (
          <>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider pt-2">Pertanyaan dari wali</h2>
            {questions.length === 0 && <p className="text-sm text-slate-500">Belum ada pertanyaan.</p>}
            {questions.map((q) => (
              <div key={q.id} className="bg-white border-2 border-slate-100 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500">{names[q.student_id] ?? "Santri"}</p>
                <p className="text-sm text-slate-800">{q.question}</p>
                {q.answer ? <p className="text-sm text-brand-700"><b>Jawaban:</b> {q.answer}</p> : (
                  <div className="flex gap-2">
                    <input value={answers[q.id] ?? ""} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))} placeholder="Tulis jawaban…" className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm" />
                    <button onClick={() => run(q.id, () => answerParentQuestion(q.id, answers[q.id] ?? ""), "Jawaban terkirim.")} className="px-3 rounded-xl bg-brand-500 text-white text-xs font-bold">Kirim</button>
                  </div>
                )}
              </div>
            ))}
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider pt-4">Konteks dari rumah</h2>
            {homes.filter((h) => h.interests || h.habits || h.important_notes).length === 0 && <p className="text-sm text-slate-500">Belum ada.</p>}
            {homes.filter((h) => h.interests || h.habits || h.important_notes).map((h, idx) => (
              <div key={idx} className="bg-white border-2 border-slate-100 rounded-2xl p-4 text-sm text-slate-700 space-y-1">
                <p className="font-bold">{names[h.student_id] ?? "Santri"}</p>
                {h.interests && <p><b>Minat:</b> {h.interests}</p>}
                {h.habits && <p><b>Kebiasaan:</b> {h.habits}</p>}
                {h.important_notes && <p><b>Penting:</b> {h.important_notes}</p>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
