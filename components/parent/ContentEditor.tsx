"use client";

import { Plus, X } from "lucide-react";
import { AutoTextarea } from "@/components/parent/AutoTextarea";
import type { AnyContent, ContentType } from "@/lib/parent";

const label = "block text-xs font-bold uppercase tracking-wider text-slate-500";
const removeBtn =
  "shrink-0 w-11 h-11 rounded-xl border-2 border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center";

function TextField({ title, hint, value, onChange, rows = 3 }: { title: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1.5">
      <span className={label}>{title}</span>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      <AutoTextarea minRows={rows} value={value} onChange={onChange} />
    </div>
  );
}

/** Each item can be edited or removed ("hapus bagian tertentu"). */
function ListField({ title, hint, items, onChange }: { title: string; hint?: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      <span className={label}>{title}</span>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <AutoTextarea minRows={2} value={item} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} />
            <button type="button" aria-label="Hapus bagian ini" onClick={() => onChange(items.filter((_, j) => j !== i))} className={removeBtn}>
              <X size={18} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, ""])} className="min-h-11 px-3 text-sm font-bold text-brand-700 flex items-center gap-1.5 rounded-xl hover:bg-brand-50">
          <Plus size={16} /> Tambah
        </button>
      </div>
    </div>
  );
}

/** CMS behaviours: edit the wording or remove one; the CMS theme stays fixed. */
function ObservedField({ items, onChange }: { items: { theme: string; text: string }[]; onChange: (v: { theme: string; text: string }[]) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <span className={label}>Perilaku yang terlihat (CMS)</span>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="space-y-1">
            <p className="text-xs font-bold text-brand-700">{item.theme}</p>
            <div className="flex gap-2 items-start">
              <AutoTextarea minRows={2} value={item.text} onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, text: v } : x)))} />
              <button type="button" aria-label="Hapus perilaku ini" onClick={() => onChange(items.filter((_, j) => j !== i))} className={removeBtn}>
                <X size={18} />
              </button>
            </div>
          </div>
        ))}
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
      <div className="space-y-5">
        <TextField title="Ringkasan untuk orang tua" hint="2–3 kalimat, bahasa sederhana." value={v.text ?? ""} onChange={(t) => set({ text: t })} rows={4} />
        <ObservedField items={v.observed ?? []} onChange={(o) => set({ observed: o })} />
        {v.focus !== null && v.focus !== undefined && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2"><TextField title="Fokus pendampingan" value={v.focus ?? ""} onChange={(t) => set({ focus: t })} rows={2} /></div>
            <TextField title="Durasi" value={v.duration ?? ""} onChange={(t) => set({ duration: t })} rows={2} />
          </div>
        )}
        <ListField title="Yang bisa Ayah/Bunda lakukan" hint="1–2 langkah sederhana di rumah atau saat menelepon." items={v.actions ?? []} onChange={(a) => set({ actions: a })} />
      </div>
    );
  }
  if (type === "summary") {
    return (
      <div className="space-y-5">
        <TextField title="Ringkasan" value={v.overview ?? ""} onChange={(t) => set({ overview: t })} rows={6} />
        <ListField title="Kekuatan utama" items={v.strengths ?? []} onChange={(a) => set({ strengths: a })} />
        <ListField title="Area tumbuh" items={v.growth_areas ?? []} onChange={(a) => set({ growth_areas: a })} />
        <TextField title="Fokus berikutnya" value={v.next_focus ?? ""} onChange={(t) => set({ next_focus: t })} rows={2} />
        {v.trends?.length > 0 && (
          <p className="text-xs text-slate-400">Tren per aspek: {v.trends.map((t: any) => `${t.aspect} ${t.label}`).join(" · ")} (dihitung otomatis dari laporan).</p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <TextField title="Gambaran karakter (berbasis kekuatan)" value={v.overview ?? ""} onChange={(t) => set({ overview: t })} rows={5} />
      <ListField title="Kekuatan karakter" items={v.strengths ?? []} onChange={(a) => set({ strengths: a })} />
      <ListField title="Cara terbaik mendampingi" items={v.best_approach ?? []} onChange={(a) => set({ best_approach: a })} />
    </div>
  );
}
