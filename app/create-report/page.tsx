"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { useAuth } from '@/lib/context/auth-context';
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
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const { role } = useUserRole();
  const { user } = useAuth();
  const recognitionRef = useRef<any>(null);

  // FETCH REAL STUDENTS FROM DB
  useEffect(() => {
    async function fetchStudents() {
      const { data, error } = await supabase
        .from('students')
        .select('*, user:profiles(id)')
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
  
  const filteredStudents = React.useMemo(() => {
    const list = searchQuery ? fuse.search(searchQuery).map(r => r.item) : students;
    if (role === 'admin') return list;
    // For ustadz: only show students assigned to them
    return list.filter(s => s.assigned_ustadz_id === user?.id);
  }, [searchQuery, students, role, user?.id]);

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
    if (!SpeechRecognition) return alert("Browser tidak mendukung fitur suara");

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
    <div className="flex flex-col h-full animate-fade-in bg-paper">
      <header className="px-6 pt-10 pb-6">
        <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
          <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500" style={{ boxShadow: "0 3px 0 0 #e2e8f0", minWidth: 32 }}>
            <ChevronLeft className="w-4 h-4" />
          </div>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-600 transition-colors">Beranda</span>
        </Link>
        <h1 className="text-3xl font-black text-slate-800">Pilih Santri</h1>
        <p className="text-slate-400 text-sm font-bold mt-1">Siapa yang akan dinilai hari ini?</p>
      </header>

      <main className="px-6 flex-1 flex flex-col">
        {/* Search bar */}
        <div className="relative mb-2">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={isListening ? "Mendengar…" : "Cari nama santri…"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border-2 rounded-2xl py-4 pl-12 pr-14 font-bold text-slate-800 outline-none transition-all ${
                isListening
                  ? "border-red-300 bg-red-50 placeholder:text-red-300"
                  : "border-slate-200 bg-white focus:border-emerald-400"
              }`}
              style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
            />
            <button
              onClick={toggleVoiceSearch}
              className={`absolute right-2 p-2.5 rounded-xl flex items-center justify-center active:translate-y-px transition-transform border-2 ${
                isListening
                  ? "bg-red-500 text-white border-red-400"
                  : "bg-white text-emerald-600 border-emerald-200"
              }`}
              style={isListening ? { boxShadow: "0 3px 0 0 #b91c1c" } : { boxShadow: "0 3px 0 0 #a7f3d0" }}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>
          {isListening && (
            <div className="flex items-center gap-2 mt-2 px-1">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-[10px] text-red-500 font-black uppercase tracking-widest">Suara Aktif</span>
            </div>
          )}
        </div>

        {/* Selected student banner */}
        {selectedStudent && (
          <div
            className="mt-4 p-4 bg-white border-2 border-emerald-300 rounded-2xl flex justify-between items-center animate-bounce-in"
            style={{ boxShadow: "0 4px 0 0 #15803d" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-xl font-black" style={{ boxShadow: "0 3px 0 0 #15803d" }}>
                {selectedStudent.name[0]}
              </div>
              <div>
                <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Dipilih ✓</p>
                <p className="text-slate-900 font-black text-lg leading-tight">{selectedStudent.name}</p>
              </div>
            </div>
            <button onClick={() => setSelectedStudent(null)} className="w-8 h-8 bg-slate-100 hover:bg-rose-50 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Student list */}
        <div className="mt-6 flex-1 overflow-y-auto pb-6">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">
            {searchQuery ? "Hasil Pencarian" : "Semua Santri"}
          </p>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-emerald-400 w-7 h-7" />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map((student) => {
                const isSelected = selectedStudent?.id === student.id;
                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl font-black text-left transition-all ${
                      isSelected
                        ? "card-3d-selected"
                        : "card-3d"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${isSelected ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {student.name.charAt(0)}
                      </div>
                      <span className={isSelected ? "text-emerald-800" : "text-slate-700"}>{student.name}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="py-5 border-t-2 border-slate-100">
          <Link href={selectedStudent ? `/create-report/assessment?id=${selectedStudent.id}&name=${encodeURIComponent(selectedStudent.name)}` : "#"}>
            <button
              disabled={!selectedStudent}
              className={`w-full py-5 rounded-2xl font-black text-lg active:translate-y-1 transition-transform ${
                selectedStudent
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-100 text-slate-300 cursor-not-allowed"
              }`}
              style={selectedStudent ? { boxShadow: "0 4px 0 0 #15803d" } : {}}
            >
              Mulai Asesmen →
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
