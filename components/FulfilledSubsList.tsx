/**
 * components/FulfilledSubsList.tsx
 *
 * Client component that renders the fulfilled sub-indicators for a single
 * assessment item in the report detail page, with inline delete-with-confirm.
 *
 * Interaction model:
 *   • Each row has a small ✕ button (always visible, not hover-only — supports touch).
 *   • Clicking ✕ puts that row into "pending delete" mode: the row turns red
 *     and shows "Hapus" / "Batal" buttons.
 *   • Confirming calls removeSubIndicator (server action) which permanently
 *     splices the item from fulfilled_sub_indicators in Supabase and revalidates
 *     the page. Optimistic local removal keeps the UI snappy.
 *   • useEffect re-syncs local state when the parent re-renders after revalidation.
 */
"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, X } from "lucide-react";
import { removeSubIndicator } from "@/app/actions/reports";

interface Props {
  reportId: string;
  category: string;
  theme: string;
  indicator: string;
  subs: string[];
}

export function FulfilledSubsList({
  reportId,
  category,
  theme,
  indicator,
  subs,
}: Props) {
  const [items, setItems] = useState<string[]>(subs);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-sync when the server re-renders with updated props after revalidation
  useEffect(() => {
    setItems(subs);
  }, [subs]);

  const handleConfirm = (sub: string) => {
    // Optimistic: remove immediately from local state
    setItems((prev) => prev.filter((s) => s !== sub));
    setPendingDelete(null);

    startTransition(async () => {
      const result = await removeSubIndicator(reportId, category, theme, indicator, sub);
      if (!result.success) {
        // Revert on failure
        setItems((prev) => [...prev, sub]);
        console.error("removeSubIndicator failed:", result.error);
      }
    });
  };

  if (items.length === 0) {
    return (
      <p className="text-[11px] text-slate-400 font-medium italic px-2">
        Semua sub-indikator telah dihapus.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {items.map((si) => {
        const isConfirming = pendingDelete === si;

        if (isConfirming) {
          return (
            <div
              key={si}
              className="flex items-start gap-2 p-2 rounded-xl bg-red-50 border border-red-200"
            >
              <span className="flex-1 text-[11px] leading-snug font-medium text-red-800">
                {si}
              </span>
              <div className="flex gap-1.5 shrink-0 mt-0.5">
                <button
                  onClick={() => setPendingDelete(null)}
                  disabled={isPending}
                  className="px-2 py-0.5 text-[10px] font-black text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleConfirm(si)}
                  disabled={isPending}
                  className="px-2 py-0.5 text-[10px] font-black text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isPending ? "…" : "Hapus"}
                </button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={si}
            className="flex items-start gap-2 p-2 rounded-xl bg-brand-50/80 border border-brand-100/50"
          >
            <div className="mt-0.5 shrink-0">
              <CheckCircle2 size={13} className="text-brand-500" />
            </div>
            <span className="flex-1 text-[11px] leading-snug font-medium text-brand-900">
              {si}
            </span>
            <button
              onClick={() => setPendingDelete(si)}
              className="shrink-0 p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors mt-0.5"
              title="Hapus sub-indikator ini"
              aria-label="Hapus sub-indikator"
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
