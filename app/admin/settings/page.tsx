"use client";

import React, { useState, useRef } from "react";
import { Cpu, ImageUp, Palette, Check, Loader2 } from "lucide-react";
import { useSettings } from "@/lib/context/settings-context";
import { MODEL_OPTIONS } from "@/lib/data/models";
import { useAuth } from "@/lib/context/auth-context";
import { supabase } from "@/lib/supabase";
import { COLOR_PRESETS, generateBrandScale, isValidHexColor, applyBrandScale } from "@/lib/theme/colors";

export default function AdminSettingsPage() {
  const { selectedModel, setSelectedModel } = useSettings();
  const { activeOrganization } = useAuth();

  return (
    <div className="p-6 space-y-6">
      <div className="mb-2">
        <h2 className="text-xl font-black text-slate-800">Pengaturan Sistem</h2>
        <p className="text-sm font-semibold text-slate-500 mt-1">
          Konfigurasi global untuk aplikasi CIA
        </p>
      </div>

      {activeOrganization && <BrandingCard organization={activeOrganization} />}

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
              className="w-full text-sm font-black text-slate-700 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 outline-none focus:border-brand-400 transition-colors cursor-pointer appearance-none"
              style={{ boxShadow: "0 2px 0 0 var(--brand-200)" }}
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

interface OrgForBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
}

function BrandingCard({ organization }: { organization: OrgForBranding }) {
  const [logoUrl, setLogoUrl] = useState(organization.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(organization.primaryColor);
  const [customHex, setCustomHex] = useState(organization.primaryColor);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePreset = COLOR_PRESETS.find(
    (p) => p.scale[500].toLowerCase() === primaryColor.toLowerCase()
  );

  const persistColor = async (hex: string) => {
    setPrimaryColor(hex);
    setSaving(true);
    setError(null);
    setSaved(false);
    // Live-preview immediately so the admin sees the effect before the save resolves.
    applyBrandScale(generateBrandScale(hex));
    const { error: updateErr } = await supabase
      .from("organizations")
      .update({ primary_color: hex })
      .eq("id", organization.id);
    setSaving(false);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleCustomHexSubmit = () => {
    const hex = customHex.trim();
    if (!isValidHexColor(hex)) {
      setError("Format warna tidak valid. Gunakan format #RRGGBB.");
      return;
    }
    persistColor(hex);
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${organization.id}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("org-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(path);
      // Bust cache so the new logo shows immediately instead of a stale cached image.
      const bustedUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const { error: updateErr } = await supabase
        .from("organizations")
        .update({ logo_url: bustedUrl })
        .eq("id", organization.id);
      if (updateErr) throw updateErr;

      setLogoUrl(bustedUrl);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err: any) {
      setError(err.message || "Gagal mengunggah logo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border-2 border-slate-100" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 bg-white text-brand-600 rounded-xl border-2 border-brand-200 flex items-center justify-center flex-shrink-0"
          style={{ boxShadow: "0 2px 0 0 var(--brand-200)" }}
        >
          <Palette className="w-5 h-5" />
        </div>
        <div>
          <span className="block font-black text-slate-800 text-base">Branding Organisasi</span>
          <span className="block text-xs text-slate-400 font-bold">
            Logo dan skema warna untuk {organization.name}
          </span>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Logo upload */}
        <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-100">
          <span className="block font-black text-slate-700 text-sm mb-3">Logo</span>
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ boxShadow: "0 2px 0 0 #cbd5e1" }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={organization.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-brand-600 font-black text-xl">
                  {organization.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoChange}
                className="hidden"
                id="org-logo-input"
              />
              <label
                htmlFor="org-logo-input"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black text-slate-600 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 active:translate-y-px transition-all cursor-pointer"
                style={{ boxShadow: "0 2px 0 0 #cbd5e1" }}
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImageUp className="w-3.5 h-3.5" />
                )}
                {uploading ? "Mengunggah..." : "Ganti logo"}
              </label>
              <p className="text-[10px] font-semibold text-slate-400 mt-2">PNG, JPG, SVG, atau WebP</p>
            </div>
          </div>
        </div>

        {/* Color scheme */}
        <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-100">
          <span className="block font-black text-slate-700 text-sm mb-3">Skema Warna</span>
          <div className="flex flex-wrap gap-2 mb-3">
            {COLOR_PRESETS.map((preset) => {
              const isActive = activePreset?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => persistColor(preset.scale[500])}
                  title={preset.label}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                  style={{
                    backgroundColor: preset.scale[500],
                    boxShadow: isActive ? `0 0 0 2px white, 0 0 0 4px ${preset.scale[600]}` : "0 2px 0 0 rgba(0,0,0,0.15)",
                  }}
                >
                  {isActive && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={isValidHexColor(customHex) ? customHex : "var(--brand-500)"}
              onChange={(e) => {
                setCustomHex(e.target.value);
                persistColor(e.target.value);
              }}
              className="w-9 h-9 rounded-lg border-2 border-slate-200 cursor-pointer bg-white p-0.5"
              title="Pilih warna kustom"
            />
            <input
              type="text"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              onBlur={handleCustomHexSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleCustomHexSubmit()}
              placeholder="var(--brand-500)"
              className="flex-1 text-xs font-bold text-slate-700 bg-white border-2 border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-brand-400 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 h-4 text-xs font-bold">
        {saving && <span className="text-slate-400">Menyimpan...</span>}
        {saved && !saving && <span className="text-brand-600">Tersimpan ✓</span>}
        {error && <span className="text-rose-500">{error}</span>}
      </div>
    </div>
  );
}
