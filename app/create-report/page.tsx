"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, Mic, Search, X, Loader2, CheckCircle2, MicOff } from 'lucide-react';
import Link from 'next/link';
import Fuse from 'fuse.js';
import { supabase } from '@/lib/supabase';

const STUDENTS = [
  { id: '1', name: 'Ahmad Fauzi' },
  { id: '2', name: 'Zaid Ramadhan' },
  { id: '3', name: 'Muhammad Ali' },
  { id: '4', name: 'Umar Abdurrahman' },
  { id: '5', name: 'Hamzah Fansuri' },
];export default function CreateReport() {
  const [students, setStudents] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<{id: string, name: string} | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // FETCH REAL STUDENTS FROM DB
  useEffect(() => {
    async function fetchStudents() {
      const { data, error } = await supabase
        .from('students')
        .select('id, name')
        .order('name', { ascending: true });
      
      if (!error && data) setStudents(data);
      setLoading(false);
    }
    fetchStudents();
  }, []);

  const fuse = useMemo(() => new Fuse(students, { 
    keys: ['name'], 
    threshold: 0.4,
    distance: 100 
  }), [students]);
  
  const results = searchQuery 
    ? fuse.search(searchQuery).map(r => r.item) 
    : students;

  // Function to handle the matching logic
  const handleMatch = (text: string) => {
    setSearchQuery(text);
    const voiceResult = fuse.search(text);
    if (voiceResult.length > 0 && voiceResult[0].score! < 0.2) {
      setSelectedStudent(voiceResult[0].item);
    }
  };

  const toggleVoiceSearch = () => {
    // If already listening, stop it
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser not supported");

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = 'id-ID';
    recognition.continuous = true; // Keep listening until manual stop
    recognition.interimResults = true; // SHOW LIVE TEXT

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          handleMatch(event.results[i][0].transcript);
        } else {
          interimTranscript += event.results[i][0].transcript;
          // Update the search bar live as you speak
          setSearchQuery(interimTranscript);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Error:", event.error);
      if (event.error !== 'no-speech') setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 bg-white">
      <header className="px-6 pt-10 pb-4 flex items-center gap-4">
        <Link href="/" className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-800" />
        </Link>
        <h1 className="text-xl font-bold text-slate-800">Select Student</h1>
      </header>

      <main className="px-6 flex-1 flex flex-col">
        <div className="relative mt-4">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={isListening ? "Listening..." : "Search student name..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border-2 rounded-2xl py-4 pl-12 pr-14 transition-all outline-none text-slate-800 ${
                isListening ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50 focus:border-emerald-500'
              }`}
            />
            <button 
              onClick={toggleVoiceSearch}
              className={`absolute right-2 p-2 rounded-xl transition-all ${
                isListening 
                ? 'bg-red-500 text-white shadow-lg shadow-red-200' 
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Live Recognition Indicator */}
          {isListening && (
            <div className="absolute -bottom-6 left-4 flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Voice Active</span>
            </div>
          )}
        </div>

        {selectedStudent && (
          <div className="mt-10 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex justify-between items-center animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                {selectedStudent.name[0]}
              </div>
              <div>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">Target Selected</p>
                <p className="text-slate-900 font-bold text-lg leading-tight">{selectedStudent.name}</p>
              </div>
            </div>
            <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        )}

        <div className="mt-8 flex-1 overflow-y-auto pb-10">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">
            {searchQuery ? 'Suggestions' : 'Student Directory'}
          </p>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300" /></div>
          ) : (
            <div className="space-y-2">
              {results.map((student) => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                    selectedStudent?.id === student.id 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' 
                    : 'bg-white border border-slate-100 text-slate-700 hover:border-emerald-200'
                  }`}
                >
                  <span className="font-semibold">{student.name}</span>
                  {selectedStudent?.id === student.id && <CheckCircle2 className="w-5 h-5 text-emerald-200" />}
                </button>
              ))}
            </div>
          )}
        </div>

      <div className="py-6 border-t border-slate-50">
          {/* PASSING DATA VIA URL PARAMS */}
          <Link href={selectedStudent ? `/create-report/assessment?id=${selectedStudent.id}&name=${encodeURIComponent(selectedStudent.name)}` : '#'}>
            <button
              disabled={!selectedStudent}
              className={`w-full py-5 rounded-2xl font-bold text-lg transition-all transform active:scale-[0.98] ${
                selectedStudent 
                ? 'bg-emerald-950 text-white shadow-xl shadow-slate-200' 
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              Start Assessment
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}