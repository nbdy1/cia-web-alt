"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { ArrowLeft, ArrowRight, MessageSquareHeart, Search, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/context/auth-context";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTerminology } from "@/lib/hooks/use-terminology";
import { StudentAvatar } from "@/components/StudentAvatar";

export default function BpHomePage() {
  const { activeOrganizationId, user } = useAuth();
  const { role } = useUserRole();
  const t = useTerminology();
  const isEnglish = t.language === "en";
  const [students, setStudents] = useState<any[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!activeOrganizationId) return;
    supabase.from("students").select("id, name, nis, photo_url, assigned_ustadz_id").eq("organization_id", activeOrganizationId)
      .or("is_removed.is.null,is_removed.eq.false").order("name").then(({ data }) => setStudents(data ?? []));
  }, [activeOrganizationId]);

  const visibleStudents = useMemo(() => (role === "owner" || role === "admin") ? students : students.filter((student) => student.assigned_ustadz_id === user?.id), [students, role, user?.id]);
  const results = useMemo(() => {
    if (!query.trim()) return visibleStudents;
    return new Fuse(visibleStudents, { keys: ["name", "nis"], threshold: 0.35 }).search(query).map((result) => result.item);
  }, [visibleStudents, query]);

  return (
    <div className="min-h-screen bg-paper pb-10">
      <header className="border-b-2 border-slate-100 bg-white px-6 pb-5 pt-9" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-700"><ArrowLeft className="h-4 w-4" />{isEnglish ? "Home" : "Beranda"}</Link>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white" style={{ boxShadow: "0 4px 0 var(--brand-700)" }}><MessageSquareHeart className="h-6 w-6" /></div>
          <div><p className="text-[10px] font-black uppercase tracking-widest text-brand-600">{isEnglish ? "Counselling mode" : "Mode BP"}</p><h1 className="text-2xl font-black text-slate-800">{isEnglish ? "Student counselling" : `Bimbingan ${t.santri}`}</h1></div>
        </div>
      </header>
      <main className="space-y-5 px-6 pt-6">
        <div className="flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-[11px] font-bold text-brand-900"><MessageSquareHeart className="h-4 w-4 shrink-0 text-brand-600" />{isEnglish ? "Counselling notes are separate from CMS progress." : "Catatan bimbingan terpisah dari progres CMS."}</div>
        <label className="relative block"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isEnglish ? `Search ${t.santriLower}…` : `Cari ${t.santriLower}…`} className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-white pl-12 pr-4 text-sm font-bold outline-none focus:border-brand-300" style={{ boxShadow: "0 3px 0 #e2e8f0" }} /></label>
        <div className="space-y-3">
          {results.map((student, index) => <Link key={student.id} href={`/bp/assessment?id=${encodeURIComponent(student.id)}&name=${encodeURIComponent(student.name)}`} className="flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-white p-3 transition-colors hover:border-brand-200" style={{ boxShadow: "0 3px 0 #e2e8f0" }}><StudentAvatar name={student.name} photoUrl={student.photo_url} size="md" colorIndex={index} /><div className="min-w-0 flex-1"><p className="truncate text-base font-black text-slate-800">{student.name}</p>{student.nis && <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">NIS: {student.nis}</p>}</div><ArrowRight className="h-5 w-5 text-slate-300" /></Link>)}
          {!results.length && <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400"><UserRound className="mx-auto mb-2 h-6 w-6" />{isEnglish ? "No students found." : `${t.santri} tidak ditemukan.`}</div>}
        </div>
      </main>
    </div>
  );
}
