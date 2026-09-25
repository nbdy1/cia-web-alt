"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpenCheck, Loader2, Mic, MicOff, Send, Sparkles } from "lucide-react";
import { processBpInterviewStep, finalizeBpSession } from "@/app/actions/bp-analysis";
import { useSettings } from "@/lib/context/settings-context";
import { MarkdownText } from "@/components/MarkdownText";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useCDSVoice } from "@/lib/hooks/use-cia-voice";

type FrameworkFocus = { category: string; theme: string; indicator: string; reason?: string };
type Message = { role: "teacher" | "assistant"; text: string; frameworkFocus?: FrameworkFocus[] };

function mergeTranscript(existing: string, incoming: string): string {
  const current = existing.trim(); const next = incoming.trim();
  if (!next) return current; if (!current) return next;
  const currentTokens = current.split(/\s+/); const nextTokens = next.split(/\s+/);
  for (let size = Math.min(currentTokens.length, nextTokens.length, 32); size > 0; size--) {
    if (currentTokens.slice(-size).join(" ").toLocaleLowerCase("id-ID") === nextTokens.slice(0, size).join(" ").toLocaleLowerCase("id-ID")) return [...currentTokens, ...nextTokens.slice(size)].join(" ");
  }
  return `${current} ${next}`.replace(/\s+/g, " ").trim();
}

export default function BpAssessmentPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { selectedModel, temperature, language } = useSettings();
  const studentId = params.get("id") ?? "";
  const studentName = params.get("name") ?? "Siswa";
  const draftKey = `bp_draft_${studentId}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmBack, setConfirmBack] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const shouldRecordRef = useRef(false);
  const transcriptAccumulatorRef = useRef("");
  const recognitionRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEnglish = language === "en";
  const { speak, stop: stopVoice, unlock: unlockVoice } = useCDSVoice(language);

  useEffect(() => {
    const saved = sessionStorage.getItem(draftKey);
    if (saved) { try { setMessages(JSON.parse(saved)); return; } catch {} }
    setMessages([{ role: "assistant", text: isEnglish ? `Tell me what has been happening with ${studentName}. We can start with one situation that needs attention.` : `Ceritakan situasi yang sedang dialami ${studentName}. Kita bisa mulai dari satu kejadian yang paling perlu diperhatikan.` }]);
  // A draft belongs to this student and language at the moment it is first opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);
  useEffect(() => { if (messages.length) sessionStorage.setItem(draftKey, JSON.stringify(messages)); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, draftKey]);
  useEffect(() => { if (!inputRef.current) return; inputRef.current.style.height = "auto"; inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 144)}px`; }, [input]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (messages.length > 1) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload); return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [messages.length]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const recognition = new SpeechRecognition();
    recognition.lang = language === "en" ? "en-US" : "id-ID";
    recognition.continuous = !isIOS; recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) transcriptAccumulatorRef.current = mergeTranscript(transcriptAccumulatorRef.current, result[0].transcript);
        else interim += result[0].transcript;
      }
      setInput(mergeTranscript(transcriptAccumulatorRef.current, interim));
    };
    recognition.onend = () => {
      if (!shouldRecordRef.current) { setIsRecording(false); return; }
      if (recognitionRestartTimerRef.current) clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = setTimeout(() => { if (!shouldRecordRef.current) return; try { recognition.start(); } catch { shouldRecordRef.current = false; setIsRecording(false); } }, 250);
    };
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") { shouldRecordRef.current = false; setIsRecording(false); setMicError(isEnglish ? "Microphone access was denied. Allow it in browser settings, then try again." : "Akses mikrofon ditolak. Izinkan di pengaturan browser lalu coba lagi."); }
      else if (event.error === "network") { shouldRecordRef.current = false; setIsRecording(false); setMicError(isEnglish ? "Connection problem. Please try again." : "Koneksi bermasalah. Coba lagi."); }
    };
    recognitionRef.current = recognition;
    return () => { if (recognitionRestartTimerRef.current) clearTimeout(recognitionRestartTimerRef.current); shouldRecordRef.current = false; recognition.abort?.(); };
  }, [isEnglish, language]);

  function toggleRecording() {
    // Preserve ElevenLabs playback after the browser hands audio control to the mic.
    unlockVoice();
    if (isRecording) { shouldRecordRef.current = false; transcriptAccumulatorRef.current = ""; recognitionRef.current?.stop(); return; }
    if (!recognitionRef.current) { setMicError(isEnglish ? "Your browser does not support voice input." : "Browser Anda belum mendukung input suara."); return; }
    setMicError(null); transcriptAccumulatorRef.current = input.trim() ? `${input.trim()} ` : ""; shouldRecordRef.current = true; stopVoice();
    try { recognitionRef.current.start(); setIsRecording(true); } catch { shouldRecordRef.current = false; }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim(); if (!text || loading || !studentId) return;
    unlockVoice();
    if (isRecording) { shouldRecordRef.current = false; recognitionRef.current?.stop(); }
    const next = [...messages, { role: "teacher" as const, text }]; setMessages(next); setInput(""); setLoading(true);
    const transcript = next.map((message) => `${message.role === "teacher" ? "Guru" : "Asisten"}: ${message.text}`).join("\n");
    const result = await processBpInterviewStep(transcript, studentId, selectedModel, temperature, language);
    setLoading(false);
    if (result.error) { setMessages((current) => [...current, { role: "assistant", text: isEnglish ? "I could not continue right now. Please try again." : "Saya belum dapat melanjutkan saat ini. Silakan coba lagi." }]); return; }
    setMessages((current) => [...current, { role: "assistant", text: result.reply, frameworkFocus: result.framework_focus }]);
    speak(result.reply);
  }

  async function finish() {
    if (loading || messages.filter((message) => message.role === "teacher").length === 0) return;
    setLoading(true);
    const transcript = messages.map((message) => `${message.role === "teacher" ? "Guru" : "Asisten"}: ${message.text}`).join("\n");
    const analysis = await finalizeBpSession(transcript, studentId, selectedModel, temperature, language);
    setLoading(false);
    if (analysis.error) return alert(analysis.error);
    sessionStorage.setItem("bp_analysis", JSON.stringify(analysis));
    sessionStorage.setItem("bp_narrative", transcript);
    router.push(`/bk/results?id=${encodeURIComponent(studentId)}&name=${encodeURIComponent(studentName)}`);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isMobile = typeof window !== "undefined" && (window.matchMedia("(max-width: 767px)").matches || window.matchMedia("(pointer: coarse)").matches);
    if (event.key === "Enter" && !event.shiftKey && !isMobile) { event.preventDefault(); void submit(event as unknown as FormEvent); }
  }

  return <div className="flex min-h-screen flex-col bg-paper">
    <header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-slate-100 bg-white px-5 py-4" style={{ boxShadow: "0 3px 0 #e2e8f0" }}><button onClick={() => messages.length > 1 ? setConfirmBack(true) : router.back()} className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 text-slate-500"><ArrowLeft className="h-4 w-4" /></button><div className="text-center"><h1 className="text-sm font-black text-slate-800">{studentName}</h1><p className="text-[10px] font-black uppercase tracking-widest text-brand-600">{isEnglish ? "Counselling conversation" : "Percakapan bimbingan"}</p></div><div className="w-9" /></header>
    {isRecording && <div className="px-5 pt-3"><div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-600"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />{isEnglish ? "Recording is active. Press stop before sending." : "Rekaman aktif. Tekan berhenti sebelum mengirim."}</div></div>}
    <main className="flex-1 space-y-4 px-5 py-5 pb-44">{messages.map((message, index) => <div key={index} className={message.role === "assistant" ? "w-full" : "ml-auto max-w-[85%]"}><div className={message.role === "assistant" ? "rounded-2xl border-2 border-slate-100 bg-white p-4 text-sm font-bold leading-relaxed text-slate-700" : "rounded-2xl bg-brand-500 p-4 text-sm font-bold leading-relaxed text-white"} style={message.role === "assistant" ? { boxShadow: "0 3px 0 #e2e8f0" } : { boxShadow: "0 3px 0 var(--brand-700)" }}><MarkdownText>{message.text}</MarkdownText></div>{message.role === "assistant" && message.frameworkFocus?.length ? <div className="mt-2 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-brand-900"><div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-brand-700"><BookOpenCheck className="h-3.5 w-3.5" />{isEnglish ? "CMS development direction" : "Arah pengembangan CMS"}</div><div className="mt-1.5 space-y-1">{message.frameworkFocus.map((focus, focusIndex) => <p key={`${focus.theme}-${focusIndex}`} className="text-[11px] font-bold leading-snug"><span className="text-brand-700">{focus.category}:</span> {focus.theme}{focus.reason ? <span className="text-slate-500"> — {focus.reason}</span> : null}</p>)}</div></div> : null}</div>)}{loading && <div className="flex items-center gap-2 text-xs font-black text-brand-600"><Loader2 className="h-4 w-4 animate-spin" />{isEnglish ? "Preparing a response…" : "Menyiapkan respons…"}</div>}<div ref={bottomRef} /></main>
    <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[450px] -translate-x-1/2 border-t-2 border-slate-100 bg-white p-4">{micError && <p className="mb-2 text-center text-[11px] font-bold text-rose-500">{micError}</p>}<form onSubmit={submit}><div className="flex items-center gap-2 rounded-[1.8rem] border-2 border-slate-200 bg-slate-50 p-2"><button type="button" onClick={toggleRecording} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 ${isRecording ? "border-rose-400 bg-rose-500 text-white" : "border-brand-200 bg-white text-brand-600"}`} style={{ boxShadow: isRecording ? "0 3px 0 #b91c1c" : "0 3px 0 var(--brand-200)" }}>{isRecording ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}</button><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleInputKeyDown} rows={1} placeholder={isEnglish ? "Type or speak…" : "Ketik atau bicara…"} className="max-h-36 flex-1 resize-none overflow-y-auto border-none bg-transparent py-2.5 text-sm font-bold leading-5 text-slate-700 outline-none" /><button disabled={!input.trim() || loading} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-brand-400 bg-brand-500 text-white disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300" style={input.trim() && !loading ? { boxShadow: "0 3px 0 var(--brand-700)" } : {}}><Send className="h-[18px] w-[18px]" /></button></div></form><button onClick={finish} disabled={loading || messages.filter((message) => message.role === "teacher").length === 0} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-xs font-black uppercase tracking-widest text-white disabled:bg-slate-300"><Sparkles className="h-4 w-4 text-brand-300" />{isEnglish ? "Finish & prepare plan" : "Selesai & susun rencana"}</button></div>
    <ConfirmModal isOpen={confirmBack} title={isEnglish ? "Leave this conversation?" : "Keluar dari percakapan?"} description={isEnglish ? "Your draft is saved, so you can continue it later." : "Draf Anda tersimpan dan dapat dilanjutkan nanti."} confirmLabel={isEnglish ? "Leave" : "Keluar"} cancelLabel={isEnglish ? "Stay" : "Tetap di sini"} confirmVariant="success" onConfirm={() => router.push("/bk")} onCancel={() => setConfirmBack(false)} />
  </div>;
}
