"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { REVIEW_REMINDER_DAYS, daysWaiting } from "@/lib/parent";

/**
 * Home-hub entry for the musyrif's parent-approval queue, with a badge for how many
 * drafts wait and a reminder when something has been stuck for a few days.
 * Renders nothing until the parent-dashboard migration exists.
 */
export function ApprovalQueueCard({ organizationId }: { organizationId: string | null }) {
  const [state, setState] = useState<{ count: number; oldestDays: number } | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    void supabase
      .from("parent_contents")
      .select("created_at")
      .eq("organization_id", organizationId)
      .in("status", ["pending", "held"])
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (error) return setState(null);
        setState({ count: data?.length ?? 0, oldestDays: data?.[0] ? daysWaiting(data[0].created_at) : 0 });
      });
  }, [organizationId]);

  if (!state) return null;
  const late = state.count > 0 && state.oldestDays >= REVIEW_REMINDER_DAYS;
  return (
    <Link href="/parent-review" className="block active:translate-y-1 transition-transform">
      <div className="relative w-full p-5 rounded-[2rem] flex items-center gap-4 bg-white border-2 border-slate-200" style={{ boxShadow: "0 5px 0 0 #cbd5e1" }}>
        <div className="w-12 h-12 shrink-0 bg-brand-50 rounded-[1rem] flex items-center justify-center border-2 border-brand-100">
          <UsersRound className="w-6 h-6 text-brand-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-800">Persetujuan Orang Tua</p>
          <p className={`text-xs font-bold ${late ? "text-rose-600" : "text-slate-400"}`}>
            {state.count === 0 ? "Tidak ada yang menunggu" : late ? `${state.count} menunggu · tertahan ${state.oldestDays} hari` : `${state.count} draf menunggu persetujuan`}
          </p>
        </div>
        {state.count > 0 && (
          <span className={`min-w-6 h-6 px-2 rounded-full text-white text-xs font-bold flex items-center justify-center ${late ? "bg-rose-500" : "bg-brand-500"}`}>{state.count}</span>
        )}
      </div>
    </Link>
  );
}
