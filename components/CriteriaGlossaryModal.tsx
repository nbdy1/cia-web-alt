"use client";

import React, { useState, useMemo } from 'react';
import { X, Search, Heart, Brain, Zap, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { karakterData } from '@/lib/data/karakter';
import { mentalData } from '@/lib/data/mental';
import { softSkillData } from '@/lib/data/soft-skill';

interface CriteriaGlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'karakter' | 'mental' | 'softskill';

export function CriteriaGlossaryModal({ isOpen, onClose }: CriteriaGlossaryModalProps) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="bg-emerald-900 text-white px-8 py-6 rounded-t-[2.5rem] flex items-center justify-between relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-800/30 rounded-full blur-2xl" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
              <BookOpen className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight font-serif">Panduan Kriteria Asesmen CIA</h2>
              <p className="text-emerald-200/80 text-xs mt-0.5">Standar indikator penilaian santri berdasarkan kurikulum Asesmen Karakter Terintegrasi</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="relative z-10 p-2 text-emerald-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation & Search Bar */}
        <div className="px-8 py-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* Tabs */}
          <div className="flex bg-slate-200/70 p-1 rounded-2xl gap-1 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => { setActiveTab('karakter'); setSearchQuery(''); }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm whitespace-nowrap ${
                activeTab === 'karakter' 
                  ? 'bg-white text-emerald-700 shadow' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Heart className="w-4 h-4 text-rose-500" />
              <span>Karakter</span>
            </button>
            <button
              onClick={() => { setActiveTab('mental'); setSearchQuery(''); }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm whitespace-nowrap ${
                activeTab === 'mental' 
                  ? 'bg-white text-emerald-700 shadow' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Brain className="w-4 h-4 text-blue-500" />
              <span>Mental</span>
            </button>
            <button
              onClick={() => { setActiveTab('softskill'); setSearchQuery(''); }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm whitespace-nowrap ${
                activeTab === 'softskill' 
                  ? 'bg-white text-emerald-700 shadow' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
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
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all shadow-sm"
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
        <div className="bg-emerald-50/50 px-8 py-3 border-b border-emerald-100 flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2.5 py-1 rounded-lg">Definisi Pilar</span>
          <p className="text-xs font-semibold text-emerald-950 font-serif italic">{currentData.definition}</p>
          <span className="ml-auto text-xs font-bold text-slate-500">
            {filteredThemes.length} Kriteria Ditemukan
          </span>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          {filteredThemes.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 font-serif">Tidak ada kriteria yang sesuai</h3>
              <p className="text-slate-500 text-xs mt-1">Cobalah menggunakan kata kunci lain untuk pencarian Anda.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
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
                                <span className="w-fit text-[9px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {theme.badge}
                                </span>
                              )}
                              <span className="font-bold text-slate-900 text-sm font-serif leading-snug group-hover:text-emerald-700 transition-colors">
                                {theme.title}
                              </span>
                            </div>
                          </td>
                          <td className="py-5 px-6 align-top text-slate-600 leading-relaxed">
                            <p className="font-medium text-slate-700">{theme.explanation}</p>
                            
                            {/* Summary Preview of indicators */}
                            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                              {theme.indicators.map((ind, iIdx) => (
                                <span key={iIdx} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-semibold border border-slate-200/60">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  {ind.title} ({ind.sub_indicators.length})
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-5 px-6 text-center align-middle">
                            <button className="p-2 rounded-xl bg-slate-100 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600 transition-colors">
                              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Indicators Section */}
                        {expanded && (
                          <tr className="bg-emerald-50/30">
                            <td colSpan={4} className="py-6 px-8 border-t border-b border-emerald-100/60">
                              <div className="space-y-4 max-w-4xl mx-auto">
                                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                  Rincian Sub-Indikator Penilaian
                                </h4>
                                <div className="grid gap-4 md:grid-cols-2">
                                  {theme.indicators.map((ind, idx) => (
                                    <div key={idx} className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
                                      <h5 className="font-bold text-slate-900 text-sm mb-3 pb-2 border-b border-slate-100 font-serif">
                                        {ind.title}
                                      </h5>
                                      <ul className="space-y-2">
                                        {ind.sub_indicators.map((sub, sIdx) => (
                                          <li key={sIdx} className="flex items-start gap-2.5 text-slate-600 text-xs leading-normal">
                                            <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-[9px] font-bold mt-0.5 shrink-0 border border-emerald-200">
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
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 font-medium">
            * Kriteria ini digunakan sebagai panduan observasi dan penilaian pada laporan santri.
          </p>
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition-colors shadow-md shadow-slate-200"
          >
            Tutup Panduan
          </button>
        </div>

      </div>
    </div>
  );
}
