"use client";

import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { REVIEW_REMINDER_DAYS, daysWaiting } from "@/lib/parent";

type Row = { musyrifId: string | null; name: string; count: number; oldestDays: number };

/** Admin view: how many parent-facing drafts each musyrif still has to approve. */
export function ApprovalQueuePanel({ organizationId }: { organizationId: string | null }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    void (async () => {
      const { data: items, error } = await supabase
        .from("parent_contents").select("student_id, created_at").eq("organization_id", organizationId).in("status", ["pending", "held"]).limit(1000);
      if (error) return setRows(null); // migration not applied yet
      const studentIds = Array.from(new Set((items ?? []).map((i) => i.student_id)));
      const { data: students } = studentIds.length
        ? await supabase.from("students").select("id, assigned_ustadz_id").in("id", studentIds) : { data: [] };
      const owner = new Map((students ?? []).map((s: any) => [s.id, s.assigned_ustadz_id as string | null]));
      const musyrifIds = Array.from(new Set(Array.from(owner.values()).filter(Boolean))) as string[];
      const { data: profiles } = musyrifIds.length ? await supabase.from("profiles").select("id, name").in("id", musyrifIds) : { data: [] };
      const nameOf = new Map((profiles ?? []).map((p: any) => [p.id, p.name as string]));

      const byMusyrif = new Map<string | null, Row>();
      for (const i of items ?? []) {
        const id = owner.get(i.student_id) ?? null;
        const row = byMusyrif.get(id) ?? { musyrifId: id, name: id ? nameOf.get(id) ?? "Musyrif" : "Belum ada musyrif", count: 0, oldestDays: 0 };
        row.count += 1;
        row.oldestDays = Math.max(row.oldestDays, daysWaiting(i.created_at));
        byMusyrif.set(id, row);
      }
      setRows(Array.from(byMusyrif.values()).sort((a, b) => b.oldestDays - a.oldestDays || b.count - a.count));
    })();
  }, [organizationId]);

  if (!rows) return null;
  return (
    <section className="bg-white border-2 border-slate-100 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <UsersRound size={16} className="text-brand-600" />
        <h2 className="font-bold text-slate-800 text-sm">Antrean persetujuan orang tua</h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">Semua draf untuk wali sudah ditinjau.</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {rows.map((r) => (
            <div key={r.musyrifId ?? "none"} className="flex items-center justify-between py-2 text-sm">
              <span className="font-bold text-slate-700">{r.name}</span>
              <span className={`text-xs font-bold ${r.oldestDays >= REVIEW_REMINDER_DAYS ? "text-rose-600" : "text-slate-500"}`}>
                {r.count} menunggu{r.oldestDays > 0 ? ` · tertua ${r.oldestDays} hari` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
