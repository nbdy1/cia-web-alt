/**
 * components/SettingsDropdown.tsx
 *
 * The gear icon in the top-right of the home page. Opens a popover with:
 *
 *   1. Panduan Kriteria — opens CriteriaGlossaryModal (the full framework ref)
 *   2. Tampilan (Appearance) — font family picker (4 options) + font scale
 *      slider (90–118%). Both are persisted to localStorage and applied
 *      immediately by mutating CSS custom properties on <html>. The
 *      `appearanceScript` in app/layout.tsx re-applies these settings before
 *      first paint to prevent a flash of default styles.
 *   3. Pusat Bantuan — placeholder alert (no external link yet).
 *
 * Font storage keys:  "cia:font-family"  and  "cia:font-scale"
 * Available fonts:    DIN Rounded (default), Nunito, Plus Jakarta Sans, Atkinson
 */
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Settings, BookOpen, Sliders, HelpCircle, Shield, Type, RotateCcw } from 'lucide-react';
import { CriteriaGlossaryModal } from './CriteriaGlossaryModal';

const FONT_STORAGE_KEY = "cia:font-family";
const FONT_SCALE_STORAGE_KEY = "cia:font-scale";

const fontOptions = [
  {
    id: "din",
    label: "DIN Rounded",
    helper: "Ramah dan bulat",
    preview: "var(--font-din-rounded)",
  },
  {
    id: "nunito",
    label: "Nunito",
    helper: "Lembut seperti aplikasi belajar",
    preview: "var(--font-nunito)",
  },
  {
    id: "jakarta",
    label: "Plus Jakarta",
    helper: "Bersih dan modern",
    preview: "var(--font-plus-jakarta)",
  },
  {
    id: "atkinson",
    label: "Atkinson",
    helper: "Paling mudah dibaca",
    preview: "var(--font-atkinson)",
  },
] as const;

type FontOptionId = (typeof fontOptions)[number]["id"];

const fontFamilyValues: Record<FontOptionId, string> = {
  din: "var(--font-din-rounded), var(--font-nunito), sans-serif",
  nunito: "var(--font-nunito), var(--font-din-rounded), sans-serif",
  jakarta: "var(--font-plus-jakarta), var(--font-din-rounded), sans-serif",
  atkinson: "var(--font-atkinson), var(--font-din-rounded), sans-serif",
};

function isFontOptionId(value: string | null): value is FontOptionId {
  return fontOptions.some((option) => option.id === value);
}

function applyAppearance(fontFamily: FontOptionId, fontScale: number) {
  const root = document.documentElement;
  const selectedFamily = fontFamilyValues[fontFamily];

  root.dataset.fontFamily = fontFamily;
  root.style.setProperty("--app-font-family", selectedFamily);
  root.style.setProperty("--font-sans", selectedFamily);
  root.style.setProperty("--font-serif", selectedFamily);
  root.style.setProperty("--app-font-scale", String(fontScale));
  document.body.style.fontFamily = "var(--app-font-family)";
  document.body.style.zoom = String(fontScale);

  try {
    window.localStorage?.setItem(FONT_STORAGE_KEY, fontFamily);
    window.localStorage?.setItem(FONT_SCALE_STORAGE_KEY, String(fontScale));
  } catch {}
}

function getInitialFontFamily(): FontOptionId {
  if (typeof window === "undefined") return "din";

  try {
    const storedFont = window.localStorage?.getItem(FONT_STORAGE_KEY) ?? null;
    return isFontOptionId(storedFont) ? storedFont : "din";
  } catch {
    return "din";
  }
}

function getInitialFontScale() {
  if (typeof window === "undefined") return 1;

  try {
    const storedScale = Number(window.localStorage?.getItem(FONT_SCALE_STORAGE_KEY));
    return Number.isFinite(storedScale) ? Math.min(Math.max(storedScale, 0.9), 1.18) : 1;
  } catch {
    return 1;
  }
}

export function SettingsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [fontFamily, setFontFamily] = useState<FontOptionId>(getInitialFontFamily);
  const [fontScale, setFontScale] = useState(getInitialFontScale);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyAppearance(fontFamily, fontScale);
  }, [fontFamily, fontScale]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block z-[1000] text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:translate-y-px border-2 ${
          isOpen
            ? "bg-emerald-500 text-white border-emerald-400"
            : "bg-white text-slate-500 border-slate-200 hover:border-emerald-200"
        }`}
        style={isOpen ? { boxShadow: "0 3px 0 0 #15803d" } : { boxShadow: "0 3px 0 0 #cbd5e1" }}
        title="Pengaturan & Panduan"
      >
        <Settings className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="fixed left-1/2 -translate-x-1/2 top-[4.5rem] w-[22rem] max-w-[calc(100vw-1.5rem)] bg-white rounded-[1.8rem] z-50 animate-fade-in border-2 border-slate-100" style={{ boxShadow: "0 6px 0 0 #e2e8f0" }}>
          <div className="px-5 py-4 border-b-2 border-slate-100 mb-2">
            <h4 className="font-black text-slate-800 text-base">Pengaturan</h4>
            <p className="text-[11px] text-slate-400 font-bold mt-0.5">Preferensi & panduan CIA</p>
          </div>

          <div className="px-2 space-y-1">
            {/* Glossary Modal Button */}
            <button
              onClick={() => {
                setIsOpen(false);
                setIsGlossaryOpen(true);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-emerald-50 text-left transition-colors group cursor-pointer"
            >
              <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0" style={{ boxShadow: "0 2px 0 0 #6ee7b7" }}>
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="block font-black text-slate-800 text-sm">Panduan Kriteria</span>
                <span className="block text-[10px] text-slate-400 font-bold mt-0.5">Karakter, Mental, Soft Skill</span>
              </div>
            </button>

            {/* App Preferences */}
            <div className="p-3 rounded-2xl bg-slate-50 border-2 border-slate-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-white text-slate-600 rounded-xl border-2 border-slate-200 flex items-center justify-center flex-shrink-0" style={{ boxShadow: "0 2px 0 0 #cbd5e1" }}>
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <span className="block font-black text-slate-800 text-sm">Tampilan</span>
                  <span className="block text-[10px] text-slate-400 font-bold">Huruf & ukuran teks</span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Type className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Jenis Huruf
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {fontOptions.map((option) => {
                      const isSelected = fontFamily === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setFontFamily(option.id);
                          }}
                          className={`text-left rounded-2xl border px-3 py-2 transition-all ${
                            isSelected
                              ? "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm"
                              : "bg-white border-slate-100 text-slate-700 hover:border-slate-200"
                          }`}
                        >
                          <span
                            className="block text-sm font-black leading-tight"
                            style={{ fontFamily: option.preview }}
                          >
                            {option.label}
                          </span>
                          <span className="block text-[10px] font-semibold text-slate-400 mt-0.5 leading-tight">
                            {option.helper}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-slate-100 px-3 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Ukuran Teks
                    </span>
                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {Math.round(fontScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.9"
                    max="1.18"
                    step="0.02"
                    value={fontScale}
                    onChange={(event) => {
                      const nextScale = Number(event.target.value);
                      setFontScale(nextScale);
                    }}
                    className="w-full accent-emerald-600"
                    aria-label="Ukuran teks aplikasi"
                  />
                  <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span>Kecil</span>
                    <span>Normal</span>
                    <span>Besar</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFontFamily("din");
                    setFontScale(1);
                  }}
                  className="w-full flex items-center justify-center gap-2 text-[11px] font-black text-slate-500 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-100 hover:border-emerald-100 rounded-2xl py-2 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Kembalikan Tampilan Awal
                </button>
              </div>
            </div>

            {/* Help / Guide */}
            <button
              onClick={() => {
                alert("Pusat Bantuan Ustadz CIA siap melayani. Panduan teknis dapat diunduh di portal santri.");
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 text-left transition-colors group cursor-pointer"
            >
              <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0" style={{ boxShadow: "0 2px 0 0 #cbd5e1" }}>
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="block font-black text-slate-800 text-sm">Pusat Bantuan</span>
                <span className="block text-[10px] text-slate-400 font-bold mt-0.5">Panduan teknis pengisian laporan</span>
              </div>
            </button>
          </div>

          <div className="mt-2 pt-3 border-t-2 border-slate-100 px-5 pb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-black">
              <div className="w-4 h-4 bg-emerald-500 rounded-md flex items-center justify-center" style={{ boxShadow: "0 1px 0 0 #15803d" }}>
                <Shield className="w-2.5 h-2.5 text-white" />
              </div>
              CIA V0.1
            </span>
            <span className="text-[10px] text-slate-400 font-black">Bahasa Indonesia</span>
          </div>
        </div>
      )}

      {/* Criteria Glossary Modal */}
      <CriteriaGlossaryModal 
        isOpen={isGlossaryOpen} 
        onClose={() => setIsGlossaryOpen(false)} 
      />
    </div>
  );
}
