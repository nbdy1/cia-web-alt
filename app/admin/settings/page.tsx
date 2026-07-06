"use client";

import React from "react";
import { Cpu } from "lucide-react";
import { useSettings } from "@/lib/context/settings-context";
import { MODEL_OPTIONS } from "@/lib/data/models";

export default function AdminSettingsPage() {
  const { selectedModel, setSelectedModel } = useSettings();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-black text-slate-800">Pengaturan Sistem</h2>
        <p className="text-sm font-semibold text-slate-500 mt-1">
          Konfigurasi global untuk aplikasi CIA
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 border-2 border-slate-100" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
        {/* Model AI Setting */}
        <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 bg-white text-slate-600 rounded-xl border-2 border-slate-200 flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: "0 2px 0 0 #cbd5e1" }}
            >
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="block font-black text-slate-800 text-base">
                Model AI
              </span>
              <span className="block text-xs text-slate-400 font-bold">
                Pilih otak asisten untuk analisis laporan
              </span>
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 px-4 py-4 shadow-sm">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full text-sm font-black text-slate-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-400 transition-colors cursor-pointer appearance-none"
              style={{ boxShadow: "0 2px 0 0 #a7f3d0" }}
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
            <div className="mt-3 text-xs font-semibold text-slate-500 leading-relaxed">
              {MODEL_OPTIONS.find((m) => m.id === selectedModel)?.desc}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
