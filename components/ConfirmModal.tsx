"use client";

import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = "Ya",
  cancelLabel = "Batal",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-sm sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 shrink-0 bg-rose-50 rounded-2xl flex items-center justify-center border-2 border-rose-100">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
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
            className="flex-1 py-3.5 rounded-2xl font-black text-sm text-white bg-rose-500 active:translate-y-1 transition-transform"
            style={{ boxShadow: "0 4px 0 0 #be123c" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
