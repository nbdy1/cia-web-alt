"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Settings, BookOpen, Sliders, HelpCircle, Shield } from 'lucide-react';
import { CriteriaGlossaryModal } from './CriteriaGlossaryModal';

export function SettingsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2.5 rounded-full transition-all flex items-center justify-center ${
          isOpen ? 'bg-emerald-100 text-emerald-800 shadow-inner' : 'hover:bg-slate-100 text-slate-500'
        }`}
        title="Pengaturan & Panduan"
      >
        <Settings className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 py-3 z-40 animate-fade-in origin-top-right">
          <div className="px-5 py-3 border-b border-slate-100 mb-2">
            <h4 className="font-serif font-bold text-slate-800 text-base">Pengaturan & Panduan</h4>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Menu preferensi dan standar kurikulum CIA</p>
          </div>

          <div className="px-2 space-y-1">
            {/* Glossary Modal Button */}
            <button
              onClick={() => {
                setIsOpen(false);
                setIsGlossaryOpen(true);
              }}
              className="w-full flex items-start gap-3.5 p-3 rounded-2xl hover:bg-emerald-50 text-left transition-colors group cursor-pointer"
            >
              <div className="p-2.5 bg-emerald-100/70 text-emerald-700 rounded-xl group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="block font-bold text-slate-800 text-sm group-hover:text-emerald-800 transition-colors">
                  Panduan Kriteria Asesmen
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Daftar lengkap kriteria Karakter, Mental, dan Soft Skill
                </span>
              </div>
            </button>

            {/* App Preferences */}
            <button
              onClick={() => {
                alert("Pengaturan Preferensi Aplikasi sedang dalam pengembangan.");
                setIsOpen(false);
              }}
              className="w-full flex items-start gap-3.5 p-3 rounded-2xl hover:bg-slate-50 text-left transition-colors group cursor-pointer"
            >
              <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl group-hover:scale-105 transition-transform">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <span className="block font-bold text-slate-800 text-sm group-hover:text-slate-950">
                  Preferensi Tampilan
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Atur tema, notifikasi, dan bahasa antarmuka
                </span>
              </div>
            </button>

            {/* Help / Guide */}
            <button
              onClick={() => {
                alert("Pusat Bantuan Ustadz CIA siap melayani. Panduan teknis dapat diunduh di portal santri.");
                setIsOpen(false);
              }}
              className="w-full flex items-start gap-3.5 p-3 rounded-2xl hover:bg-slate-50 text-left transition-colors group cursor-pointer"
            >
              <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl group-hover:scale-105 transition-transform">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="block font-bold text-slate-800 text-sm group-hover:text-slate-950">
                  Pusat Bantuan & Bimbingan
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Dokumentasi dan petunjuk teknis pengisian laporan
                </span>
              </div>
            </button>
          </div>

          <div className="mt-2 pt-3 border-t border-slate-100 px-5 flex items-center justify-between text-[10px] text-slate-400 font-bold">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-600" />
              CIA V0.1
            </span>
            <span>Edisi Bahasa Indonesia</span>
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
