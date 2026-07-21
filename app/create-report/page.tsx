/**
 * app/create-report/page.tsx
 *
 * Step 1 of the 3-step assessment workflow: student selection.
 *
 * The ustadz searches for the student they want to assess. Students are fetched
 * from Supabase and filtered client-side using Fuse.js fuzzy search. Role-based
 * filtering applies: admin sees all students; ustadz sees only students with
 * assigned_ustadz_id matching their own user ID by default.
 *
 * A non-admin ustadz can deliberately expand the search to students outside
 * their own roster via the "Cari <santri> lain" toggle, which lazy-loads the
 * full org roster through the search_organization_students() RPC (only on
 * demand, so the default view never dumps the whole org on them). Selecting
 * an unassigned student is allowed — the resulting report is still readable
 * by the ustadz who created it via reports.created_by, even though the
 * student isn't theirs. See scripts/migrations/20260721_cross_assignment_reports.sql.
 *
 * Voice search: the microphone button uses the Web Speech API
 * (SpeechRecognition / webkitSpeechRecognition) for hands-free student lookup.
 * This is Chrome-only by design — Firefox users see a browser alert and should
 * use the text search field instead.
 *
 * On student selection, the "Mulai Asesmen" button navigates to:
 *   /create-report/assessment?id=<studentId>&name=<studentName>
 */
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { useAuth } from '@/lib/context/auth-context';
import { ChevronLeft, Mic, Search, Loader2, CheckCircle2, MicOff, UserSearch, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Fuse from 'fuse.js';
import { supabase } from '@/lib/supabase';
import { StudentAvatar } from '@/components/StudentAvatar';
import { useTerminology } from '@/lib/hooks/use-terminology';

export default function CreateReport() {
  const [students, setStudents] = useState<any[]>([]);
  const [otherStudents, setOtherStudents] = useState<any[]>([]);
  const [otherStudentsLoading, setOtherStudentsLoading] = useState(false);
  const [otherStudentsLoaded, setOtherStudentsLoaded] = useState(false);
  const [searchingOthers, setSearchingOthers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const { role } = useUserRole();
  const { user, activeOrganizationId } = useAuth();
  const t = useTerminology();
  const recognitionRef = useRef<any>(null);
  // Tracks user *intent* to listen — survives iOS onend auto-fires
  const shouldListenRef = useRef(false);

  const isAdmin = role === 'admin' || role === 'owner';

  // FETCH REAL STUDENTS FROM DB
  useEffect(() => {
    async function fetchStudents() {
      if (!activeOrganizationId) return;
      const { data, error } = await supabase
        .from('students')
        .select('*, user:profiles(id)')
        .eq('organization_id', activeOrganizationId)
        .or('is_removed.is.null,is_removed.eq.false')
        .order('name', { ascending: true });

      if (!error && data) setStudents(data);
      setLoading(false);
    }
    fetchStudents();
  }, [activeOrganizationId]);

  // Only fetched when a non-admin ustadz explicitly asks to search students
  // outside their own roster — keeps the default view to "my students" only.
  async function loadOtherStudents() {
    if (otherStudentsLoaded || !activeOrganizationId) return;
    setOtherStudentsLoading(true);
    const { data, error } = await supabase.rpc('search_organization_students', {
      target_organization_id: activeOrganizationId,
    });
    if (!error && data) setOtherStudents(data);
    setOtherStudentsLoading(false);
    setOtherStudentsLoaded(true);
  }

  const myStudents = React.useMemo(() => {
    if (isAdmin) return students;
    return students.filter(s => s.assigned_ustadz_id === user?.id);
  }, [students, isAdmin, user?.id]);

  const searchBase = searchingOthers ? otherStudents : myStudents;

  const fuse = useMemo(() => new Fuse(searchBase, {
    keys: ['name'],
    threshold: 0.4,
    distance: 100
  }), [searchBase]);

  const filteredStudents = React.useMemo(() => {
    return searchQuery ? fuse.search(searchQuery).map(r => r.item) : searchBase;
  }, [searchQuery, searchBase, fuse]);

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
    if (isListening) {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser tidak mendukung fitur suara");

    // iOS Safari doesn't support continuous mode — simulate it by restarting on end
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = 'id-ID';
    recognition.continuous = !isIOS;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          handleMatch(event.results[i][0].transcript);
        } else {
          interimTranscript += event.results[i][0].transcript;
          setSearchQuery(interimTranscript);
        }
      }
    };

    recognition.onerror = (event: any) => {
      const { error } = event;
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        shouldListenRef.current = false;
        setIsListening(false);
        alert("Akses mikrofon ditolak. Izinkan di pengaturan browser lalu coba lagi.");
      } else if (error !== 'no-speech' && error !== 'aborted') {
        // non-fatal errors let onend handle the restart; fatal ones stop here
        shouldListenRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        // Restart to keep listening on iOS
        try {
          recognition.start();
        } catch {
          shouldListenRef.current = false;
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    shouldListenRef.current = true;
    recognition.start();
  };

  return (
    <div className="flex flex-col h-full bg-paper">
      <div className="flex flex-col h-full animate-fade-in">
      <header className="px-6 pt-10 pb-6">
        <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
          <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500" style={{ boxShadow: "0 3px 0 0 #e2e8f0", minWidth: 32 }}>
            <ChevronLeft className="w-4 h-4" />
          </div>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-brand-600 transition-colors">Beranda</span>
        </Link>
        <h1 className="text-3xl font-black text-slate-800">Pilih {t.santri}</h1>
        <p className="text-slate-400 text-sm font-bold mt-1">
          {searchingOthers ? `Mencari di luar ${t.santriLower} bimbingan Anda` : "Siapa yang akan dinilai hari ini?"}
        </p>
      </header>

      <main className="px-6 flex-1 flex flex-col">
        {/* Search bar */}
        <div className="relative mb-2">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={isListening ? "Mendengar…" : `Cari nama ${t.santriLower}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border-2 rounded-2xl py-4 pl-12 pr-14 font-bold text-slate-800 outline-none transition-all ${
                isListening
                  ? "border-red-300 bg-red-50 placeholder:text-red-300"
                  : "border-slate-200 bg-white focus:border-brand-400"
              }`}
              style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
            />
            <button
              onClick={toggleVoiceSearch}
              className={`absolute right-2 p-2.5 rounded-xl flex items-center justify-center active:translate-y-px transition-transform border-2 ${
                isListening
                  ? "bg-red-500 text-white border-red-400"
                  : "bg-white text-brand-600 border-brand-200"
              }`}
              style={isListening ? { boxShadow: "0 3px 0 0 #b91c1c" } : { boxShadow: "0 3px 0 0 var(--brand-200)" }}
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

        {/* Cross-assignment search toggle — hidden by default so ustadz
            aren't confronted with the full org roster; only surfaced when
            they deliberately go looking for a student outside their own. */}
        {!isAdmin && (
          <div className="mb-2">
            {searchingOthers ? (
              <button
                onClick={() => { setSearchingOthers(false); setSearchQuery(''); setSelectedStudent(null); }}
                className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors px-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke {t.santriLower} saya
              </button>
            ) : (
              <button
                onClick={() => { setSearchingOthers(true); setSearchQuery(''); setSelectedStudent(null); loadOtherStudents(); }}
                className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-brand-500 hover:text-brand-700 transition-colors px-1"
              >
                <UserSearch className="w-3.5 h-3.5" /> Cari {t.santriLower} lain (di luar bimbingan Anda)
              </button>
            )}
          </div>
        )}

        {searchingOthers && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-amber-50 border-2 border-amber-100">
            <p className="text-[11px] font-bold text-amber-700 leading-snug">
              Anda sedang mencari {t.santriLower} yang bukan bimbingan Anda. Laporan tetap bisa dibuat, dan akan muncul di daftar laporan Anda untuk ditindaklanjuti.
            </p>
          </div>
        )}

        {/* Student list */}
        <div className="mt-2 flex-1 overflow-y-auto pb-28">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">
            {searchQuery ? "Hasil Pencarian" : searchingOthers ? `Semua ${t.santri}` : `${t.santri} Saya`}
          </p>
          {loading || (searchingOthers && otherStudentsLoading) ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-brand-400 w-7 h-7" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-sm font-black text-slate-400">
                {searchingOthers ? `${t.santri} tidak ditemukan` : `Belum ada ${t.santriLower} yang dibimbing`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map((student) => {
                const isSelected = selectedStudent?.id === student.id;
                const isOther = searchingOthers && student.assigned_ustadz_id !== user?.id;
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
                      {isSelected ? (
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black bg-brand-500 text-white flex-shrink-0">
                          {student.name.charAt(0)}
                        </div>
                      ) : (
                        <StudentAvatar
                          name={student.name}
                          photoUrl={student.photo_url ?? null}
                          size="sm"
                          colorIndex={filteredStudents.indexOf(student)}
                        />
                      )}
                      <div className="flex flex-col">
                        <span className={isSelected ? "text-brand-800" : "text-slate-700"}>{student.name}</span>
                        {isOther && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 mt-0.5">
                            Bukan bimbingan Anda
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-brand-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </main>
      </div>

      {/* CTA — floating/sticky footer */}
      <footer
        className="fixed bottom-0 left-1/2 w-full max-w-[450px] -translate-x-1/2 flex justify-center items-end px-5 pt-16 pb-6 z-40 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(250, 253, 252, 0.88) 0%, rgba(250, 253, 252, 0.58) 46%, rgba(250, 253, 252, 0) 100%)",
        }}
      >
        <Link
          href={selectedStudent ? `/create-report/assessment?id=${selectedStudent.id}&name=${encodeURIComponent(selectedStudent.name)}` : "#"}
          className="w-full max-w-sm pointer-events-auto"
        >
          <button
            disabled={!selectedStudent}
            className={`w-full py-5 rounded-2xl font-black text-lg active:translate-y-1 transition-transform ${
              selectedStudent
                ? "bg-brand-500 text-white"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            }`}
            style={selectedStudent ? { boxShadow: "0 4px 0 0 var(--brand-700)" } : {}}
          >
            Mulai Input →
          </button>
        </Link>
      </footer>
    </div>
  );
}
