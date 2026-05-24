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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setCurrentInput(transcript);
      };

      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      stopVoice();
      recognitionRef.current?.start();
      setIsRecording(true);
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
      const result = await processInterviewStep(transcript, discoveredPillars);
      
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
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="px-6 py-6 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/create-report" className="p-2 hover:bg-slate-50 rounded-full text-slate-400">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight font-serif">Wawancara Reflektif</h1>
            <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">{studentName}</p>
          </div>
        </div>
        
        {/* Progress Badge */}
        <div className="bg-emerald-50 px-3 py-1.5 rounded-2xl border border-emerald-100 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter">
            {discoveredCount} Topik Tergali
          </span>
        </div>
      </header>

      {/* Chat Area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
            <div className="w-16 h-16 bg-slate-200 rounded-3xl flex items-center justify-center text-slate-400">
              <Quote size={32} />
            </div>
            <p className="text-lg font-bold text-slate-500 max-w-[240px] font-serif">
              Silakan mulai ceritakan observasi Ustadz tentang {studentName}...
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'teacher' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] p-4 rounded-[1.8rem] shadow-sm ${
              msg.role === 'teacher' 
              ? 'bg-emerald-900 text-white rounded-tr-none' 
              : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'
            }`}>
              <div className="flex items-center gap-2 mb-1 opacity-40">
                {msg.role === 'teacher' ? <User size={10} /> : <Brain size={10} />}
                <span className="text-[8px] font-black uppercase tracking-widest">
                  {msg.role === 'teacher' ? 'Ustadz' : 'Asisten CIA'}
                </span>
              </div>
              <p className="text-sm leading-relaxed font-medium">{msg.text}</p>
            </div>
          </div>
        ))}

        {currentInput && isRecording && (
          <div className="flex justify-end opacity-50">
            <div className="max-w-[85%] p-4 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-[1.8rem] rounded-tr-none italic text-sm">
              {currentInput}...
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 p-4 rounded-[1.8rem] rounded-tl-none shadow-sm flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-emerald-600" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI sedang berpikir...</span>
            </div>
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-6 bg-white border-t border-slate-100">
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-[2.2rem] border border-slate-100 shadow-inner">
          <button 
            onClick={toggleRecording}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isRecording 
              ? 'bg-red-500 text-white shadow-lg shadow-red-200' 
              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            }`}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <textarea
            ref={inputRef}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ketik atau bicara..."
            rows={1}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 placeholder:text-slate-400 py-3 leading-6 resize-none max-h-40 overflow-y-auto"
          />

          <button 
            onClick={handleSend}
            disabled={!currentInput.trim() || isProcessing}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              currentInput.trim() && !isProcessing
              ? 'bg-emerald-900 text-white shadow-lg shadow-emerald-100' 
              : 'text-slate-300'
            }`}
          >
            <Send size={20} />
          </button>
        </div>
        <p className="mt-2 flex justify-center  px-2 text-[11px] text-slate-400 font-medium">
          Tekan Enter untuk kirim, Shift+Enter untuk baris baru.
        </p>

        {/* Finalize Button */}
        {messages.length >= 2 && (
          <button
            onClick={handleFinalize}
            disabled={isProcessing}
            className="w-full mt-4 py-4 rounded-[1.8rem] bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl shadow-slate-200 hover:bg-black active:scale-[0.98] transition-all"
          >
            <Sparkles size={16} className="text-emerald-400" />
            Selesai & Buat Laporan
          </button>
        )}
      </footer>
    </div>
  );
}
