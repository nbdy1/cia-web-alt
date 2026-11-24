"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AutoTextarea } from "@/components/parent/AutoTextarea";
import { Check, Heart, Loader2, LogOut, MessageCircle, Plus, Printer, Share2 } from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";
import {
  acceptParentConsent,
  addChildByCode,
  askMusyrif,
  claimParentAccount,
  markUpdateRead,
  saveHomeProfile,
  thankForUpdate,
} from "@/app/actions/parent";

const input =
  "w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 px-4 text-base font-bold text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100";
const primary =
  "w-full min-h-12 rounded-2xl bg-brand-500 text-white font-bold text-base flex items-center justify-center gap-2 disabled:bg-slate-300";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ success: boolean; error?: string }>, okText: string, after?: () => void) => {
    setMessage(null);
    start(async () => {
      const result = await fn();
      if (result.success) {
        setMessage({ ok: true, text: okText });
        after?.();
        router.refresh();
      } else setMessage({ ok: false, text: result.error ?? "Gagal." });
    });
  };
  return { pending, message, run };
}

const Msg = ({ m }: { m: { ok: boolean; text: string } | null }) =>
  m ? <p className={`text-xs font-bold ${m.ok ? "text-brand-700" : "text-rose-600"}`}>{m.text}</p> : null;

export function ParentSignOut() {
  const { signOut } = useAuth();
  return (
    <button
      onClick={() => void signOut()}
      aria-label="Keluar"
      className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500"
      style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
    >
      <LogOut size={16} />
    </button>
  );
}

export function AddChildForm() {
  const [code, setCode] = useState("");
  const { pending, message, run } = useAction();
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); run(() => addChildByCode(code), "Anak berhasil ditambahkan.", () => setCode("")); }}
      className="space-y-3"
    >
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="K7M2-9QXA" autoCapitalize="characters" className={`${input} font-mono tracking-widest`} />
      <button disabled={pending || !code.trim()} className={primary}>
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Tambahkan anak
      </button>
      <Msg m={message} />
    </form>
  );
}

/** First step for Google sign-ins: pair at least one child code. */
export function ClaimForm() {
  const [codes, setCodes] = useState([""]);
  const { pending, message, run } = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => claimParentAccount(codes), "Terhubung.", () => window.location.assign("/"));
      }}
      className="space-y-3"
    >
      {codes.map((c, i) => (
        <input key={i} required={i === 0} value={c} placeholder="K7M2-9QXA" className={`${input} font-mono tracking-widest`}
          onChange={(e) => setCodes((p) => p.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)))} />
      ))}
      <button type="button" onClick={() => setCodes((p) => [...p, ""])} className="text-xs font-bold text-brand-600 flex items-center gap-1"><Plus size={14} /> Tambah anak lain</button>
      <button disabled={pending} className={primary}>{pending && <Loader2 size={16} className="animate-spin" />} Hubungkan</button>
      <Msg m={message} />
    </form>
  );
}

export function ConsentForm() {
  const [agree, setAgree] = useState(false);
  const { pending, message, run } = useAction();
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 text-sm font-bold text-slate-700">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 w-4 h-4" />
        Saya telah membaca dan menyetujui penggunaan data anak saya sebagaimana dijelaskan di atas.
      </label>
      <button disabled={!agree || pending} onClick={() => run(acceptParentConsent, "Terima kasih.", () => window.location.assign("/parent"))} className={primary}>
        {pending && <Loader2 size={16} className="animate-spin" />} Setuju dan lanjutkan
      </button>
      <Msg m={message} />
    </div>
  );
}

/** Light responses on one update card: read, thanks, one question. */
export function FeedActions({
  id, read, thanked, question,
}: { id: string; read: boolean; thanked: boolean; question: { text: string; answer: string | null } | null }) {
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState("");
  const { pending, message, run } = useAction();
  return (
    <div className="mt-4 pt-3 border-t-2 border-slate-50 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button disabled={read || pending} onClick={() => run(() => markUpdateRead(id), "")}
          className={`px-4 min-h-11 rounded-xl border-2 text-sm font-bold flex items-center gap-2 ${read ? "border-brand-100 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}>
          <Check size={13} /> {read ? "Sudah dibaca" : "Tandai sudah dibaca"}
        </button>
        <button disabled={thanked || pending} onClick={() => run(() => thankForUpdate(id), "")}
          className={`px-4 min-h-11 rounded-xl border-2 text-sm font-bold flex items-center gap-2 ${thanked ? "border-rose-100 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-600"}`}>
          <Heart size={13} /> {thanked ? "Terima kasih terkirim" : "Terima kasih"}
        </button>
        {!question && (
          <button onClick={() => setAsking((v) => !v)} className="px-4 min-h-11 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-600 flex items-center gap-2">
            <MessageCircle size={15} /> Tanya musyrif
          </button>
        )}
      </div>
      {asking && !question && (
        <div className="space-y-2">
          <AutoTextarea value={text} onChange={setText} minRows={3} maxLength={500} placeholder="Tulis satu pertanyaan untuk musyrif…" />
          <button disabled={pending || text.trim().length < 3} onClick={() => run(() => askMusyrif(id, text), "Pertanyaan terkirim.", () => { setAsking(false); setText(""); })} className={primary}>
            {pending && <Loader2 size={16} className="animate-spin" />} Kirim pertanyaan
          </button>
        </div>
      )}
      {question && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="text-slate-600"><span className="font-bold">Pertanyaan Anda:</span> {question.text}</p>
          <p className="mt-1 text-slate-700">{question.answer ? <><span className="font-bold text-brand-700">Jawaban musyrif:</span> {question.answer}</> : <span className="text-slate-400">Menunggu jawaban musyrif.</span>}</p>
        </div>
      )}
      <Msg m={message} />
    </div>
  );
}

export function HomeProfileForm({
  childId, childName, initial,
}: { childId: string; childName: string; initial: { interests: string; habits: string; importantNotes: string } }) {
  const [v, setV] = useState(initial);
  const { pending, message, run } = useAction();
  const area = (label: string, key: keyof typeof v, hint: string) => (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <div className="mt-1.5"><AutoTextarea minRows={3} maxLength={1000} value={v[key]} placeholder={hint} onChange={(t) => setV((p) => ({ ...p, [key]: t }))} /></div>
    </label>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => saveHomeProfile(childId, v), "Tersimpan. Musyrif dapat melihat ini."); }} className="space-y-3">
      {area(`Minat ${childName}`, "interests", "Mis. sepak bola, menggambar, kisah para nabi")}
      {area("Kebiasaan di rumah", "habits", "Mis. bangun subuh sendiri, suka membantu adik")}
      {area("Hal penting yang perlu diketahui musyrif", "importantNotes", "Mis. alergi, kondisi keluarga, hal yang membuatnya nyaman atau cemas")}
      <button disabled={pending} className={primary}>{pending && <Loader2 size={16} className="animate-spin" />} Simpan</button>
      <Msg m={message} />
    </form>
  );
}

export function RaporActions({ shareText }: { shareText: string }) {
  return (
    <div className="flex gap-2 print:hidden">
      <button onClick={() => window.print()} className={primary}><Printer size={16} /> Unduh / Cetak PDF</button>
      <button
        onClick={() => (navigator.share ? navigator.share({ title: "Rapor CMS", text: shareText }) : navigator.clipboard.writeText(shareText))}
        className="px-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm flex items-center gap-2"
      >
        <Share2 size={16} /> Bagikan
      </button>
    </div>
  );
}
