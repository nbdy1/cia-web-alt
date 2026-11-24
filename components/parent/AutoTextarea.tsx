"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * A textarea that grows with its content (never an inner scrollbar) and uses
 * 16px text, which is easy to read and stops iOS from zooming in on focus.
 */
export function AutoTextarea({
  value, onChange, minRows = 3, className = "", ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  className?: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full resize-none overflow-hidden bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-base leading-relaxed font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${className}`}
      {...rest}
    />
  );
}
