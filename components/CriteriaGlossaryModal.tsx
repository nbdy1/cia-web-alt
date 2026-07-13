/**
 * components/CriteriaGlossaryModal.tsx
 *
 * Full-screen modal that lets ustadz look up the complete CDS assessment
 * framework while filling out a report. Opened from SettingsDropdown.
 *
 * Features:
 *   - Three tabs: Karakter (40 themes), Mental (34 themes), Soft Skill (14 themes)
 *   - Live search across theme titles, explanations, indicator names, and
 *     sub-indicator strings (case-insensitive substring match)
 *   - Expandable rows showing per-indicator sub-indicator lists
 *   - Badge display for Mental (.group) and Soft Skill (.quality) groupings
 *
 * Data comes entirely from local TypeScript files in lib/data/ — no network
 * requests, so the glossary works offline during assessments.
 *
 * The `expandedRows` state is keyed as "<tab>-<themeId>" so expansion state
 * is preserved independently per tab when switching between Karakter/Mental/
 * Soft Skill.
 */
"use client";

import React, { useState, useMemo } from 'react';
import { X, Search, Heart, Brain, Zap, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { karakterData } from '@/lib/data/karakter';
import { mentalData } from '@/lib/data/mental';
import { softSkillData } from '@/lib/data/soft-skill';
import { useTerminology } from '@/lib/hooks/use-terminology';

interface CriteriaGlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'karakter' | 'mental' | 'softskill';

export function CriteriaGlossaryModal({ isOpen, onClose }: CriteriaGlossaryModalProps) {
  const t = useTerminology();
  const [activeTab, setActiveTab] = useState<TabType>('karakter');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const currentData = useMemo(() => {
    switch (activeTab) {
      case 'karakter':
        return {
          category: karakterData.category,
          definition: karakterData.definition,
          themes: karakterData.themes.map(t => ({
            id: t.id,
            badge: null,
            title: t.title,
            explanation: t.explanation,
            indicators: t.indicators,
          })),
        };
      case 'mental':
        return {
          category: mentalData.category,
          definition: mentalData.definition,
          themes: mentalData.themes.map(t => ({
            id: t.id,
            badge: t.group,
            title: t.title,
            explanation: t.explanation,
            indicators: t.indicators,
          })),
        };
      case 'softskill':
        return {
          category: softSkillData.category,
          definition: softSkillData.definition,
          themes: softSkillData.themes.map(t => ({
            id: t.id,
            badge: t.quality,
            title: t.title,
            explanation: t.explanation,
            indicators: t.indicators,
          })),
        };
    }
  }, [activeTab]);

  const filteredThemes = useMemo(() => {
    if (!searchQuery.trim()) return currentData.themes;
    const query = searchQuery.toLowerCase();
    return currentData.themes.filter(theme => {
      const matchTitle = theme.title.toLowerCase().includes(query);
      const matchExplanation = theme.explanation.toLowerCase().includes(query);
      const matchBadge = theme.badge ? theme.badge.toLowerCase().includes(query) : false;
      const matchIndicators = theme.indicators.some(ind => 
        ind.title.toLowerCase().includes(query) || 
        ind.sub_indicators.some(sub => sub.toLowerCase().includes(query))
      );
      return matchTitle || matchExplanation || matchBadge || matchIndicators;
    });
  }, [currentData, searchQuery]);

  const toggleRow = (id: number) => {
    const key = `${activeTab}-${id}`;
    setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isRowExpanded = (id: number) => {
    return !!expandedRows[`${activeTab}-${id}`];
  };

  const definisiLabel = {
    karakter: 'Definisi Character',
    mental: 'Definisi Mental',
    softskill: 'Definisi Soft Skill',
  }[activeTab];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-5xl sm:rounded-[2.5rem] rounded-t-[2rem] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="bg-brand-900 text-white px-4 sm:px-8 py-4 sm:py-6 sm:rounded-t-[2.5rem] rounded-t-[2rem] flex items-center justify-between relative overflow-hidden shrink-0">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-800/30 rounded-full blur-2xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center border border-white/10 shadow-inner shrink-0">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-brand-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-2xl font-bold tracking-tight font-serif leading-tight">Panduan Kriteria Asesmen CDS</h2>
              <p className="text-brand-200/80 text-[10px] sm:text-xs mt-0.5 hidden sm:block">Standar indikator penilaian {t.santriLower} berdasarkan kurikulum Asesmen Character Terintegrasi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="relative z-10 p-2 text-brand-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10 shrink-0"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation & Search Bar */}
        <div className="px-3 sm:px-8 py-3 sm:py-4 bg-slate-50 border-b border-slate-100 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between shrink-0">
          {/* Tabs */}
          <div className="flex bg-slate-200/70 p-1 rounded-2xl gap-1 w-full overflow-x-auto">
            <button
              onClick={() => { setActiveTab('karakter'); setSearchQuery(''); }}
              className={`flex-1  flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm whitespace-nowrap ${
                activeTab === 'karakter'
                  ? 'bg-white text-brand-700 shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 shrink-0" />
              <span>Character</span>
            </button>
            <button
              onClick={() => { setActiveTab('mental'); setSearchQuery(''); }}
              className={`flex-1  flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm whitespace-nowrap ${
                activeTab === 'mental'
                  ? 'bg-white text-brand-700 shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 shrink-0" />
              <span>Mental</span>
            </button>
            <button
              onClick={() => { setActiveTab('softskill'); setSearchQuery(''); }}
              className={`flex-1  flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm whitespace-nowrap ${
                activeTab === 'softskill'
                  ? 'bg-white text-brand-700 shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500 shrink-0" />
              <span>Soft Skill</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kriteria, tema, indikator..."
              className="lg:block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Definition Bar */}
        <div className="bg-brand-50/50 px-3 sm:px-8 py-2.5 sm:py-3 border-b border-brand-100 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-wider bg-brand-600 text-white px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0">{definisiLabel}</span>
          <p className="text-xs font-semibold text-brand-950 font-serif italic flex-1 min-w-0">{currentData.definition}</p>
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap shrink-0">
            {filteredThemes.length} Kriteria
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-8 py-4 sm:py-6 bg-slate-50/50">
          {filteredThemes.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 font-serif">Tidak ada kriteria yang sesuai</h3>
              <p className="text-slate-500 text-xs mt-1">Cobalah menggunakan kata kunci lain untuk pencarian Anda.</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {filteredThemes.map((theme, index) => {
                  const expanded = isRowExpanded(theme.id);
                  return (
                    <div key={theme.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                      <button
                        onClick={() => toggleRow(theme.id)}
                        className="w-full text-left p-4 flex items-start gap-3"
                      >
                        <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          {theme.badge && (
                            <span className="inline-block text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-brand-100 text-brand-800 border border-brand-200 mb-1.5">
                              {theme.badge}
                            </span>
                          )}
                          <p className="font-bold text-slate-900 text-sm font-serif leading-snug">{theme.title}</p>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{theme.explanation}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {theme.indicators.map((ind, iIdx) => (
                              <span key={iIdx} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg font-semibold border border-slate-200/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />
                                {ind.title} ({ind.sub_indicators.length})
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0 p-1.5 rounded-xl bg-slate-100 text-slate-500 mt-0.5">
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {expanded && (
                        <div className="px-4 pb-4 bg-brand-50/40 border-t border-brand-100/60">
                          <div className="pt-3 space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-brand-800 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-brand-600" />
                              Rincian Sub-Indikator
                            </h4>
                            <div className="space-y-3">
                              {theme.indicators.map((ind, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-xl border border-brand-100 shadow-sm">
                                  <h5 className="font-bold text-slate-900 text-sm mb-2 pb-2 border-b border-slate-100 font-serif">{ind.title}</h5>
                                  <ul className="space-y-1.5">
                                    {ind.sub_indicators.map((sub, sIdx) => (
                                      <li key={sIdx} className="flex items-start gap-2 text-slate-600 text-xs leading-normal">
                                        <span className="w-4 h-4 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-[9px] font-bold mt-0.5 shrink-0 border border-brand-200">
                                          {sIdx + 1}
                                        </span>
                                        <span>{sub}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-600 text-[11px] font-black uppercase tracking-wider border-b border-slate-200">
                      <th className="py-4 px-6 w-16 text-center">No</th>
                      <th className="py-4 px-6 w-1/3">Kriteria / Tema</th>
                      <th className="py-4 px-6">Penjelasan & Indikator Penilaian</th>
                      <th className="py-4 px-6 w-24 text-center">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredThemes.map((theme, index) => {
                      const expanded = isRowExpanded(theme.id);
                      return (
                        <React.Fragment key={theme.id}>
                          <tr
                            onClick={() => toggleRow(theme.id)}
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                          >
                            <td className="py-5 px-6 font-black text-slate-400 text-center">
                              {index + 1}
                            </td>
                            <td className="py-5 px-6 align-top">
                              <div className="flex flex-col gap-1.5">
                                {theme.badge && (
                                  <span className="w-fit text-[9px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-brand-100 text-brand-800 border border-brand-200">
                                    {theme.badge}
                                  </span>
                                )}
                                <span className="font-bold text-slate-900 text-sm font-serif leading-snug group-hover:text-brand-700 transition-colors">
                                  {theme.title}
                                </span>
                              </div>
                            </td>
                            <td className="py-5 px-6 align-top text-slate-600 leading-relaxed">
                              <p className="font-medium text-slate-700">{theme.explanation}</p>
                              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                                {theme.indicators.map((ind, iIdx) => (
                                  <span key={iIdx} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-semibold border border-slate-200/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
                                    {ind.title} ({ind.sub_indicators.length})
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-5 px-6 text-center align-middle">
                              <button className="p-2 rounded-xl bg-slate-100 group-hover:bg-brand-50 text-slate-500 group-hover:text-brand-600 transition-colors">
                                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>

                          {expanded && (
                            <tr className="bg-brand-50/30">
                              <td colSpan={4} className="py-6 px-8 border-t border-b border-brand-100/60">
                                <div className="space-y-4 max-w-4xl mx-auto">
                                  <h4 className="text-xs font-black uppercase tracking-wider text-brand-800 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-brand-600" />
                                    Rincian Sub-Indikator Penilaian
                                  </h4>
                                  <div className="grid gap-4 md:grid-cols-2">
                                    {theme.indicators.map((ind, idx) => (
                                      <div key={idx} className="bg-white p-5 rounded-2xl border border-brand-100 shadow-sm">
                                        <h5 className="font-bold text-slate-900 text-sm mb-3 pb-2 border-b border-slate-100 font-serif">
                                          {ind.title}
                                        </h5>
                                        <ul className="space-y-2">
                                          {ind.sub_indicators.map((sub, sIdx) => (
                                            <li key={sIdx} className="flex items-start gap-2.5 text-slate-600 text-xs leading-normal">
                                              <span className="w-4 h-4 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-[9px] font-bold mt-0.5 shrink-0 border border-brand-200">
                                                {sIdx + 1}
                                              </span>
                                              <span>{sub}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-8 py-3 bg-white border-t border-slate-100 shrink-0">
          <p className="text-[11px] text-slate-500 font-medium">
            * Kriteria ini digunakan sebagai panduan observasi dan penilaian pada laporan santri.
          </p>
        </div>

      </div>
    </div>
  );
}
