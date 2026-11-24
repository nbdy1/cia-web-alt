"use client";

import { Plus, X } from "lucide-react";
import type { AnyContent, ContentType } from "@/lib/parent";

const box = "w-full bg-white border-2 border-slate-200 rounded-xl p-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-brand-400";

function TextField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={`${box} mt-1`} />
    </label>
  );
}

/** Each item can be edited or removed ("hapus bagian tertentu"). */
function ListField({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <div className="mt-1 space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1.5">
            <textarea rows={2} value={item} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className={box} />
            <button type="button" aria-label="Hapus bagian ini" onClick={() => onChange(items.filter((_, j) => j !== i))} className="shrink-0 w-8 h-8 rounded-lg border-2 border-slate-200 text-slate-400 flex items-center justify-center">
              <X size={14} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, ""])} className="text-xs font-bold text-brand-600 flex items-center gap-1"><Plus size={13} /> Tambah</button>
      </div>
    </div>
  );
}

/** Edits the parent-facing text of one item; trends are computed and not editable. */
export function ContentEditor({ type, value, onChange }: { type: ContentType; value: AnyContent; onChange: (v: AnyContent) => void }) {
  const v = value as any;
  const set = (patch: Record<string, unknown>) => onChange({ ...v, ...patch });
  if (type === "update") {
    return (
      <div className="space-y-3">
        <TextField label="Ringkasan untuk orang tua (2–3 kalimat)" value={v.text ?? ""} onChange={(t) => set({ text: t })} />
        {v.focus !== null && v.focus !== undefined && (
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2"><TextField label="Fokus" rows={2} value={v.focus ?? ""} onChange={(t) => set({ focus: t })} /></div>
            <TextField label="Durasi" rows={2} value={v.duration ?? ""} onChange={(t) => set({ duration: t })} />
          </div>
        )}
        <ListField label="Yang bisa Ayah/Bunda lakukan (1–2)" items={v.actions ?? []} onChange={(a) => set({ actions: a })} />
      </div>
    );
  }
  if (type === "summary") {
    return (
      <div className="space-y-3">
        <TextField label="Ringkasan" rows={5} value={v.overview ?? ""} onChange={(t) => set({ overview: t })} />
        <ListField label="Kekuatan utama" items={v.strengths ?? []} onChange={(a) => set({ strengths: a })} />
        <ListField label="Area tumbuh" items={v.growth_areas ?? []} onChange={(a) => set({ growth_areas: a })} />
        <TextField label="Fokus berikutnya" rows={2} value={v.next_focus ?? ""} onChange={(t) => set({ next_focus: t })} />
        {v.trends?.length > 0 && (
          <p className="text-[11px] text-slate-400">Tren: {v.trends.map((t: any) => `${t.aspect} ${t.label}`).join(" · ")} (dihitung otomatis).</p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <TextField label="Gambaran karakter (berbasis kekuatan)" rows={5} value={v.overview ?? ""} onChange={(t) => set({ overview: t })} />
      <ListField label="Kekuatan karakter" items={v.strengths ?? []} onChange={(a) => set({ strengths: a })} />
      <ListField label="Cara terbaik mendampingi" items={v.best_approach ?? []} onChange={(a) => set({ best_approach: a })} />
    </div>
  );
}
