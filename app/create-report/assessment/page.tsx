"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Mic, MicOff, Save, Edit3, Trash2, CheckCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function AssessmentPage() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get('id');
  const studentName = searchParams.get('name') || 'Student';
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const recognitionRef = useRef<any>(null); 

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + ' ';
        }
        setTranscript(currentTranscript.trim());
      };

      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setIsEditing(false); // Close editor while recording
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 animate-in fade-in duration-500">
      {/* Header */}
      <header className="px-6 pt-10 pb-4 flex items-center justify-between bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/create-report" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-slate-800" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-none">Assessment</h1>
            <p className="text-xs text-emerald-600 font-semibold uppercase mt-1">{studentName}</p>
          </div>
        </div>
        <button onClick={() => setTranscript('')} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 px-6 pt-8 flex flex-col gap-6 overflow-hidden">
        
        {/* Narrative Input Card */}
        <div className={`flex-1 flex flex-col bg-white rounded-[2rem] shadow-xl shadow-slate-200 border-2 transition-all duration-300 relative ${isRecording ? 'border-emerald-400 ring-4 ring-emerald-50' : 'border-transparent'}`}>
          
          {/* Editor Header */}
          <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Santri Narrative</span>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-emerald-100 text-emerald-600' : 'text-slate-400 hover:bg-slate-100'}`}
            >
              <Edit3 className="w-5 h-5" />
            </button>
          </div>

          {/* Text Area / Live Transcript */}
          <div className="flex-1 p-6 overflow-y-auto">
            {isEditing ? (
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Type or speak to describe the student's behavior..."
                className="w-full h-full text-lg text-slate-700 bg-transparent resize-none focus:outline-none leading-relaxed"
              />
            ) : (
              <div className={`text-lg leading-relaxed ${transcript ? 'text-slate-700' : 'text-slate-300 italic'}`}>
                {transcript || "The story will appear here as you speak..."}
                {isRecording && <span className="inline-block w-1 h-6 bg-emerald-500 ml-1 animate-pulse" />}
              </div>
            )}
          </div>

          {/* Live Recording Indicator Bottom */}
          {isRecording && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-emerald-600 text-white px-6 py-2 rounded-full shadow-lg animate-bounce">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-bold uppercase tracking-tighter">AI Listening</span>
            </div>
          )}
        </div>

        {/* Control Center */}
        <div className="pb-10 flex flex-col items-center gap-6">
          
          {/* Main Record Button */}
          <button 
            onClick={toggleRecording}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all transform active:scale-90 ${
                isRecording 
                ? 'bg-red-500 shadow-2xl shadow-red-200' 
                : 'bg-emerald-600 shadow-2xl shadow-emerald-200'
            }`}
          >
            {isRecording ? (
                <MicOff className="w-10 h-10 text-white" />
            ) : (
                <Mic className="w-10 h-10 text-white" />
            )}
          </button>

          <p className="text-slate-400 text-sm font-medium">
            {isRecording ? "Tap to stop recording" : "Tap to start speaking"}
          </p>

          {/* Submit Action */}
          <Link href={`/create-report/analysis?id=${studentId}&name=${encodeURIComponent(studentName)}&narrative=${encodeURIComponent(transcript)}`}>
          <button
            disabled={!transcript || isRecording}
            className={`w-full py-5 px-5 rounded-[2rem] font-bold text-lg flex items-center justify-center gap-3 transition-all ${
              transcript && !isRecording
              ? 'bg-slate-900 text-white shadow-xl shadow-slate-300 hover:bg-black' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Analyze with CIA Engine
          </button>
          </Link>
          
        </div>
      </main>
    </div>
  );
}