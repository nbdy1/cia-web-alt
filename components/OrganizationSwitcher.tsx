"use client";

import React, { useState, useRef, useEffect } from "react";
import { Building2, CheckCircle2, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";

export function OrganizationSwitcher() {
  const { organizations, activeOrganizationId, setActiveOrganizationId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (organizations.length <= 1) {
    return null; // Don't show switcher if user only belongs to 1 (or 0) organizations
  }

  const activeOrg = organizations.find((o) => o.id === activeOrganizationId);

  return (
    <div className="relative inline-block z-[1000] text-left ml-2" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 active:translate-y-px transition-all hover:border-brand-200"
        style={{ boxShadow: isOpen ? "0 3px 0 0 var(--brand-700)" : "0 3px 0 0 #cbd5e1" }}
      >
        <div className="w-6 h-6 bg-brand-100 rounded-lg flex items-center justify-center text-brand-600">
          <Building2 size={12} />
        </div>
        <span className="text-xs font-black text-slate-700 truncate max-w-[120px]">
          {activeOrg?.name ?? "Pilih Organisasi"}
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-12 w-64 bg-white border-2 border-slate-100 rounded-[1.5rem] p-2 animate-fade-in"
          style={{ boxShadow: "0 6px 0 0 #e2e8f0" }}
        >
          <div className="px-3 py-2 mb-1 border-b-2 border-slate-50">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ganti Organisasi</p>
          </div>
          <div className="space-y-1">
            {organizations.map((org) => {
              const isSelected = org.id === activeOrganizationId;
              return (
                <button
                  key={org.id}
                  onClick={() => {
                    setActiveOrganizationId(org.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-colors text-left ${
                    isSelected ? "bg-brand-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      <Building2 size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-black truncate ${isSelected ? "text-brand-800" : "text-slate-700"}`}>
                        {org.name}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {org.role}
                      </p>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 size={16} className="text-brand-500 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
