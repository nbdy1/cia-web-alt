"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Footprints,
  GraduationCap,
  MessageCircleHeart,
  Sparkles,
  Target,
} from "lucide-react";
import { MarkdownText } from "@/components/MarkdownText";

type SectionKind =
  | "concern"
  | "strength"
  | "goal"
  | "teacher-action"
  | "student-action"
  | "family"
  | "follow-up";

const sectionStyles = {
  concern: { Icon: AlertTriangle, surface: "border-rose-200 bg-rose-50", icon: "bg-rose-500", bullet: "text-rose-500", eyebrow: "text-rose-700", shadow: "#fecdd3" },
  strength: { Icon: Sparkles, surface: "border-emerald-200 bg-emerald-50", icon: "bg-emerald-500", bullet: "text-emerald-500", eyebrow: "text-emerald-700", shadow: "#a7f3d0" },
  goal: { Icon: Target, surface: "border-violet-200 bg-violet-50", icon: "bg-violet-500", bullet: "text-violet-500", eyebrow: "text-violet-700", shadow: "#ddd6fe" },
  "teacher-action": { Icon: GraduationCap, surface: "border-sky-200 bg-sky-50", icon: "bg-sky-500", bullet: "text-sky-500", eyebrow: "text-sky-700", shadow: "#bae6fd" },
  "student-action": { Icon: Footprints, surface: "border-amber-200 bg-amber-50", icon: "bg-amber-500", bullet: "text-amber-500", eyebrow: "text-amber-700", shadow: "#fde68a" },
  family: { Icon: MessageCircleHeart, surface: "border-orange-200 bg-orange-50", icon: "bg-orange-500", bullet: "text-orange-500", eyebrow: "text-orange-700", shadow: "#fed7aa" },
  "follow-up": { Icon: CalendarClock, surface: "border-indigo-200 bg-indigo-50", icon: "bg-indigo-500", bullet: "text-indigo-500", eyebrow: "text-indigo-700", shadow: "#c7d2fe" },
} satisfies Record<SectionKind, { Icon: typeof Target; surface: string; icon: string; bullet: string; eyebrow: string; shadow: string }>;

function BkSectionFrame({ kind, label, title, children }: { kind: SectionKind; label: string; title: string; children: ReactNode }) {
  const style = sectionStyles[kind];
  const { Icon } = style;
  return (
    <section className={`rounded-2xl border-2 p-5 ${style.surface}`} style={{ boxShadow: `0 3px 0 ${style.shadow}` }}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${style.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className={`text-[10px] font-black uppercase tracking-widest ${style.eyebrow}`}>{label}</p>
          <h2 className="mt-0.5 text-base font-black leading-tight text-slate-800">{title}</h2>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function BkReportList({ kind, label, title, items }: { kind: SectionKind; label: string; title: string; items?: string[] }) {
  if (!items?.length) return null;
  const style = sectionStyles[kind];
  return (
    <BkSectionFrame kind={kind} label={label} title={title}>
      <ul className="space-y-2.5">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2.5 text-sm font-bold leading-relaxed text-slate-700">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${style.bullet}`} />
            <MarkdownText>{item}</MarkdownText>
          </li>
        ))}
      </ul>
    </BkSectionFrame>
  );
}

export function BkReportNote({ kind, label, title, children }: { kind: SectionKind; label: string; title: string; children?: string | null }) {
  if (!children) return null;
  return (
    <BkSectionFrame kind={kind} label={label} title={title}>
      <MarkdownText className="text-sm font-bold leading-relaxed text-slate-700">{children}</MarkdownText>
    </BkSectionFrame>
  );
}
