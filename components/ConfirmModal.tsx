"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "success";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = "Ya",
  cancelLabel = "Batal",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const isSuccess = confirmVariant === "success";
  const ConfirmIcon = isSuccess ? CheckCircle2 : AlertTriangle;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-sm sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center border-2 ${isSuccess ? "bg-brand-50 border-brand-100" : "bg-rose-50 border-rose-100"}`}>
            <ConfirmIcon className={`w-6 h-6 ${isSuccess ? "text-brand-500" : "text-rose-500"}`} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 leading-tight">{title}</h2>
            {description && (
              <p className="text-xs font-bold text-slate-400 mt-1">{description}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl font-black text-sm text-slate-500 bg-slate-100 active:translate-y-px transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3.5 rounded-2xl font-black text-sm text-white active:translate-y-1 transition-transform ${isSuccess ? "bg-brand-500" : "bg-rose-500"}`}
            style={{ boxShadow: isSuccess ? "0 4px 0 0 var(--brand-700)" : "0 4px 0 0 #be123c" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
