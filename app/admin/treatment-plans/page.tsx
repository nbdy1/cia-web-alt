/**
 * app/admin/treatment-plans/page.tsx
 *
 * Cross-student view of every "Rencana Penanganan" (treatment plan) an ustadz
 * has produced, and whether they've since marked it done (see
 * components/TreatmentPlanStatus.tsx + app/actions/reports.ts setTreatmentPlanStatus).
 *
 * Flat list sorted by most recent report first, with a completion filter and
 * search — simplest layout that scales to hundreds of reports without forcing
 * the admin to drill into per-student or per-ustadz pages first.
 */
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, Lightbulb, CheckCircle2, XCircle, Clock, FileText, Users } from 'lucide-react';
import Link from 'next/link';
import { StudentAvatar } from '@/components/StudentAvatar';
import { useAuth } from '@/lib/context/auth-context';
import { useTerminology } from '@/lib/hooks/use-terminology';

type TreatmentStatus = 'pending' | 'completed' | 'declined';

type PlanRow = {
  reportId: string;
  createdAt: string;
  studentId: string;
  studentName: string;
  studentPhoto: string | null;
  ustadzName: string;
  priorityTheme: string;
  actionPlan: string;
  status: TreatmentStatus;
  resolvedAt: string | null;
  outcomeNote: string | null;
};

type FilterOption = 'all' | 'pending' | 'done' | 'declined';

function parsePlan(raw: any) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

export default function TreatmentPlansPage() {
  const { activeOrganizationId } = useAuth();
  const t = useTerminology();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');

  useEffect(() => {
    async function fetchData() {
      if (!activeOrganizationId) return;
      setLoading(true);

      const { data: memberRows } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', activeOrganizationId);
      const memberIds = (memberRows ?? []).map((m: any) => m.user_id);

      const { data: profiles } = memberIds.length > 0
        ? await supabase.from('profiles').select('id, name').in('id', memberIds)
        : { data: [] as any[] };
      const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.name]));

      const { data: reportsRaw, error } = await supabase
        .from('reports')
        .select(`
          id,
          created_at,
          treatment_plan,
          students!inner ( id, name, photo_url, assigned_ustadz_id, organization_id )
        `)
        .eq('students.organization_id', activeOrganizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch treatment plans:', error);
        setLoading(false);
        return;
      }

      const formatted: PlanRow[] = (reportsRaw ?? [])
        .map((r: any) => {
          const plan = parsePlan(r.treatment_plan);
          const treatment = plan?.treatment;
          if (!treatment?.action_plan) return null;
          const student = r.students;
          const status: TreatmentStatus = treatment.status ?? (treatment.completed ? 'completed' : 'pending');
          return {
            reportId: r.id,
            createdAt: r.created_at,
            studentId: student?.id,
            studentName: student?.name ?? t.santri,
            studentPhoto: student?.photo_url ?? null,
            ustadzName: nameById.get(student?.assigned_ustadz_id) ?? `Belum ada ${t.ustadz} yang dipasangkan`,
            priorityTheme: treatment.priority_theme ?? '',
            actionPlan: treatment.action_plan ?? '',
            status,
            resolvedAt: treatment.resolved_at ?? treatment.completed_at ?? null,
            outcomeNote: treatment.outcome_note ?? null,
          } as PlanRow;
        })
        .filter(Boolean) as PlanRow[];

      setRows(formatted);
      setLoading(false);
    }

    fetchData();
  }, [activeOrganizationId]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'done' && r.status !== 'completed') return false;
      if (filter === 'pending' && r.status !== 'pending') return false;
      if (filter === 'declined' && r.status !== 'declined') return false;
      if (!q) return true;
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.ustadzName.toLowerCase().includes(q) ||
        r.priorityTheme.toLowerCase().includes(q)
      );
    });
  }, [rows, searchQuery, filter]);

  const doneCount = rows.filter((r) => r.status === 'completed').length;
  const declinedCount = rows.filter((r) => r.status === 'declined').length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Rencana Penanganan</h2>
        <p className="text-slate-400 text-sm font-bold mt-0.5">
          Semua rencana penanganan yang dibuat {t.ustadzLower}, dan status penyelesaiannya
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-100 text-brand-700">
          <Lightbulb size={10} /> {rows.length} Rencana
        </div>
        <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 size={10} /> {doneCount} Selesai
        </div>
        <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
          <XCircle size={10} /> {declinedCount} Ditolak
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={`Cari ${t.santriLower}, ${t.ustadzLower}, atau tema…`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:border-brand-400 transition-all"
            style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
          {([
            { id: 'all', label: 'Semua' },
            { id: 'pending', label: 'Belum Selesai' },
            { id: 'done', label: 'Selesai' },
            { id: 'declined', label: 'Ditolak' },
          ] as { id: FilterOption; label: string }[]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all whitespace-nowrap ${
                filter === opt.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
        </div>
      ) : filteredRows.length > 0 ? (
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <Link
              key={row.reportId}
              href={`/reports/${row.reportId}?from=${encodeURIComponent("/admin/treatment-plans")}`}
              className="block bg-white rounded-[1.5rem] border-2 border-slate-100 hover:border-brand-200 transition-colors p-5"
              style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <StudentAvatar
                    name={row.studentName}
                    photoUrl={row.studentPhoto}
                    size="sm"
                    colorIndex={0}
                  />
                  <div className="min-w-0">
                    <p className="font-black text-slate-800 text-sm truncate">{row.studentName}</p>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 truncate">
                      <Users size={10} /> {row.ustadzName}
                    </div>
                  </div>
                </div>
                {row.status === 'completed' ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={10} /> Selesai
                  </span>
                ) : row.status === 'declined' ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                    <XCircle size={10} /> Ditolak
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                    <Clock size={10} /> Belum
                  </span>
                )}
              </div>

              {row.priorityTheme && (
                <p className="text-[10px] font-black text-brand-600 uppercase tracking-tighter mb-1">
                  {row.priorityTheme}
                </p>
              )}
              <p className="text-xs text-slate-600 font-medium leading-relaxed line-clamp-2">
                {row.actionPlan}
              </p>

              {row.status === 'completed' && row.outcomeNote && (
                <p className="mt-2 text-xs text-emerald-700 font-medium italic leading-relaxed line-clamp-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                  {row.outcomeNote}
                </p>
              )}
              {row.status === 'declined' && row.outcomeNote && (
                <p className="mt-2 text-xs text-rose-700 font-medium italic leading-relaxed line-clamp-2 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                  {row.outcomeNote}
                </p>
              )}

              <div className="flex items-center gap-1.5 mt-3 text-[10px] font-bold text-slate-300">
                <FileText size={11} />
                {new Date(row.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                {" · "}
                {new Date(row.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-[1.5rem] border-2 border-dashed border-slate-200">
          <Lightbulb className="w-8 h-8 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400 font-black text-sm">
            {searchQuery || filter !== 'all' ? "Tidak ada hasil" : "Belum ada rencana penanganan"}
          </p>
        </div>
      )}
    </div>
  );
}
