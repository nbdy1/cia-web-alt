/**
 * app/create-report/assessment/page.tsx
 *
 * Step 2 of the assessment workflow: the AI-guided interview chat.
 *
 * The ustadz describes their observations about the student in a chat interface.
 * After each message, processInterviewStep() (server action) is called to:
 *   1. Embed the last few messages and retrieve relevant CIA criteria via RAG
 *   2. Ask Gemini to generate a contextual follow-up question in Indonesian
 *   3. Return which CIA themes have been "discovered" so far
 *
 * State:
 *   messages         – chat history (teacher + AI turns)
 *   discoveredPillars – cumulative list of CIA themes surfaced during interview
 *   discoveredCount  – shown in the header badge
 *
 * Voice input: SpeechRecognition (Chrome-only). The mic button toggles
 * continuous recognition; interim results update the textarea live so the
 * ustadz can see what's being transcribed before sending.
 *
 * Voice output: useCIAVoice hook reads AI responses aloud (native
 * SpeechSynthesis by default, ElevenLabs when USE_ELEVENLABS is enabled).
 *
 * When the ustadz clicks "Selesai & Buat Laporan" (requires ≥2 messages),
 * finalizeAssessment() is called and results are stored in sessionStorage to
 * avoid URL length limits. The page then redirects to /create-report/results.
 */
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Mic, MicOff, Send, Sparkles, User, Brain, Quote, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCIAVoice } from '@/lib/hooks/use-cia-voice';
import { processInterviewStep, finalizeAssessment } from '@/app/actions/ai-analysis';

interface Message {
  role: 'teacher' | 'ai';
  text: string;
}

export default function AssessmentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const studentId = searchParams.get('id');
  const studentName = searchParams.get('name') || 'Santri';

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [discoveredPillars, setDiscoveredPillars] = useState<string[]>([]);

  const { speak, stop: stopVoice } = useCIAVoice();
  const recognitionRef = useRef<any>(null);
  // Tracks user *intent* to record — survives iOS onend auto-fires
  const shouldRecordRef = useRef(false);
  // Accumulates final transcript text across iOS recognition restarts
  const transcriptAccumulatorRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(true);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentInput]);

  // Auto-grow textarea for long inputs while preserving scroll beyond max height
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
  }, [currentInput]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicSupported(false);
      return;
    }

    // iOS Safari doesn't support continuous mode — we simulate it by restarting
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = !isIOS;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          transcriptAccumulatorRef.current += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      setCurrentInput((transcriptAccumulatorRef.current + interim).trim());
    };

    recognition.onend = () => {
      if (shouldRecordRef.current) {
        // User still wants to record — restart (handles iOS auto-stop)
        try {
          recognition.start();
        } catch {
          shouldRecordRef.current = false;
          setIsRecording(false);
        }
      } else {
        setIsRecording(false);
      }
    };

    recognition.onerror = (event: any) => {
      const { error } = event;
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        shouldRecordRef.current = false;
        setIsRecording(false);
        setMicError('Akses mikrofon ditolak. Izinkan di pengaturan browser lalu coba lagi.');
      } else if (error === 'network') {
        shouldRecordRef.current = false;
        setIsRecording(false);
        setMicError('Koneksi bermasalah. Coba lagi.');
      }
      // 'no-speech' and 'aborted' are non-fatal — onend will handle the restart
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      shouldRecordRef.current = false;
      transcriptAccumulatorRef.current = '';
      recognitionRef.current?.stop();
    } else {
      setMicError(null);
      transcriptAccumulatorRef.current = '';
      shouldRecordRef.current = true;
      stopVoice();
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch {
        shouldRecordRef.current = false;
      }
    }
  };

  const handleSend = async () => {
    if (!currentInput.trim()) return;

    const userText = currentInput.trim();
    const newMessages = [...messages, { role: 'teacher', text: userText } as Message];
    setMessages(newMessages);
    setCurrentInput('');
    setIsProcessing(true);

    // Stop recording if active
    if (isRecording) {
      recognitionRef.current?.stop();
    }

    try {
      console.log('[Interview][Client] Step start', {
        previousAccumulatedThemes: discoveredPillars,
        previousAccumulatedCount: discoveredPillars.length,
      });
      const transcript = newMessages.map(m => `${m.role === 'teacher' ? 'Guru' : 'AI'}: ${m.text}`).join('\n');
      const result = await processInterviewStep(transcript, discoveredPillars, studentId || undefined);

      if (result.reply) {
        const newDiscovered = Array.isArray(result.discoveredPillars) ? result.discoveredPillars : [];
        const mergedDiscovered = Array.from(new Set([...discoveredPillars, ...newDiscovered]));
        const addedThisStep = mergedDiscovered.filter(theme => !discoveredPillars.includes(theme));
        console.log('[Interview][Client] Step result', {
          modelReturnedThemesThisStep: newDiscovered,
          accumulatedBefore: discoveredPillars,
          addedThisStep,
          accumulatedAfter: mergedDiscovered,
          accumulatedAfterCount: mergedDiscovered.length,
        });
        setMessages(prev => [...prev, { role: 'ai', text: result.reply }]);
        setDiscoveredPillars(mergedDiscovered);
        setDiscoveredCount(mergedDiscovered.length);
        speak(result.reply);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    } catch (error) {
      console.error("Analysis Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalize = async () => {
    setIsProcessing(true);
    const fullTranscript = messages.map(m => `${m.role === 'teacher' ? 'Guru' : 'AI'}: ${m.text}`).join('\n');

    try {
      console.log('[Finalize][Client] Sending finalization request', {
        accumulatedThemesSent: discoveredPillars,
        accumulatedThemesCount: discoveredPillars.length,
        transcriptLines: fullTranscript.split('\n').filter(Boolean).length,
      });
      const analysis = await finalizeAssessment(
        fullTranscript,
        studentId || undefined,
        discoveredPillars
      );
      console.log('[Finalize][Client] Final analysis received', {
        statusSummary: analysis?.status_summary,
        detailedAssessmentsCount: analysis?.detailed_assessments?.length ?? 0,
        themesInFinalDetailedAssessments: Array.from(
          new Set((analysis?.detailed_assessments ?? []).map((a: any) => a?.theme).filter(Boolean))
        ),
        priorityTheme: analysis?.treatment?.priority_theme,
      });

      // Save large JSON payload to sessionStorage to avoid URL length limits
      sessionStorage.setItem('current_analysis', JSON.stringify(analysis));
      sessionStorage.setItem('current_narrative', fullTranscript);

      const params = new URLSearchParams({
        id: studentId || "",
        name: studentName
      });
      router.push(`/create-report/results?${params.toString()}`);
    } catch (error) {
      console.error("Finalization Error:", error);
      setIsProcessing(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-paper font-sans">
      {/* Header */}
      <header className="px-5 py-4 bg-white border-b-2 border-slate-100 flex items-center justify-between sticky top-0 z-20" style={{ boxShadow: "0 3px 0 0 #f1f5f9" }}>
        <div className="flex items-center gap-3">
          <Link
            href="/create-report"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 active:translate-y-px transition-transform"
            style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-black text-slate-900 leading-tight">Wawancara</h1>
            <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest leading-none">{studentName}</p>
          </div>
        </div>

        {/* Topics badge */}
        <div
          className="flex items-center gap-2 px-3 py-2 bg-white rounded-2xl border-2 border-emerald-200"
          style={{ boxShadow: "0 3px 0 0 #a7f3d0" }}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-black text-emerald-700">{discoveredCount} Topik</span>
        </div>
      </header>

      {/* Chat Area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50 animate-bounce-in">
            <div
              className="w-20 h-20 bg-white rounded-[1.6rem] flex items-center justify-center"
              style={{ boxShadow: "0 4px 0 0 #e2e8f0", border: "2px solid #e2e8f0" }}
            >
              <Quote size={34} className="text-slate-300" />
            </div>
            <p className="text-base font-black text-slate-400 max-w-[220px] leading-snug">
              Ceritakan observasi tentang {studentName}…
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "teacher" ? "justify-end" : "justify-start"} animate-slide-up`}>
            {msg.role === "ai" && (
              <div
                className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center mr-2 flex-shrink-0 self-end mb-1"
                style={{ boxShadow: "0 2px 0 0 #15803d" }}
              >
                <Brain size={14} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[82%] px-4 py-3 ${
                msg.role === "teacher"
                  ? "bg-emerald-500 text-white rounded-[1.4rem] rounded-br-md"
                  : "bg-white border-2 border-slate-100 text-slate-800 rounded-[1.4rem] rounded-bl-md"
              }`}
              style={
                msg.role === "teacher"
                  ? { boxShadow: "0 3px 0 0 #15803d" }
                  : { boxShadow: "0 3px 0 0 #e2e8f0" }
              }
            >
              <p className="text-sm leading-relaxed font-bold">{msg.text}</p>
            </div>
            {msg.role === "teacher" && (
              <div className="w-8 h-8 bg-slate-200 rounded-xl flex items-center justify-center ml-2 flex-shrink-0 self-end mb-1">
                <User size={14} className="text-slate-500" />
              </div>
            )}
          </div>
        ))}

        {currentInput && isRecording && (
          <div className="flex justify-end opacity-50">
            <div className="max-w-[82%] px-4 py-3 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 rounded-[1.4rem] rounded-br-md italic text-sm font-bold">
              {currentInput}…
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex justify-start animate-slide-up">
            <div
              className="bg-white border-2 border-slate-100 px-4 py-3 rounded-[1.4rem] rounded-bl-md flex items-center gap-2"
              style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
            >
              <Loader2 size={14} className="animate-spin text-emerald-500" />
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Berpikir…</span>
            </div>
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-5 bg-white border-t-2 border-slate-100">
        {micError && (
          <p className="mb-2 text-center text-[11px] text-red-500 font-bold px-2">{micError}</p>
        )}
        <div
          className="flex items-center gap-2 bg-slate-50 p-2 rounded-[1.8rem] border-2 border-slate-200"
          style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04)" }}
        >
          {micSupported && (
            <button
              onClick={toggleRecording}
              className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center border-2 active:translate-y-px transition-transform ${
                isRecording
                  ? "bg-red-500 text-white border-red-400"
                  : "bg-white text-emerald-600 border-emerald-200"
              }`}
              style={isRecording ? { boxShadow: "0 3px 0 0 #b91c1c" } : { boxShadow: "0 3px 0 0 #a7f3d0" }}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}

          <textarea
            ref={inputRef}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ketik atau bicara…"
            rows={1}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 placeholder:text-slate-400 py-2.5 leading-5 resize-none max-h-36 overflow-y-auto"
          />

          <button
            onClick={handleSend}
            disabled={!currentInput.trim() || isProcessing}
            className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center active:translate-y-px transition-transform ${
              currentInput.trim() && !isProcessing
                ? "bg-emerald-500 text-white border-2 border-emerald-400"
                : "bg-slate-100 text-slate-300 border-2 border-slate-100 cursor-not-allowed"
            }`}
            style={currentInput.trim() && !isProcessing ? { boxShadow: "0 3px 0 0 #15803d" } : {}}
          >
            <Send size={18} />
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-slate-400 font-bold">
          Enter untuk kirim · Shift+Enter baris baru
        </p>

        {messages.length >= 2 && (
          <button
            onClick={handleFinalize}
            disabled={isProcessing}
            className="w-full mt-4 py-4 rounded-[1.4rem] bg-slate-900 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 active:translate-y-1 transition-transform"
            style={{ boxShadow: "0 4px 0 0 #000" }}
          >
            <Sparkles size={16} className="text-emerald-400" />
            Selesai & Buat Laporan
          </button>
        )}
      </footer>
    </div>
  );
}
