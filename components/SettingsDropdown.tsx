/**
 * components/SettingsDropdown.tsx
 *
 * The gear icon in the top-right of the home page. Opens a compact tabbed
 * popover with:
 *
 *   1. Akun — current org, multi-org switching, and password change.
 *   2. Tampilan — font family picker + font scale slider.
 *   3. Panduan — criteria glossary and help entry point.
 *
 * Font storage keys:  "cia:font-family"  and  "cia:font-scale"
 * Available fonts:    DIN Rounded (default), Nunito, Plus Jakarta Sans, Atkinson
 */
"use client";

import React, { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Languages,
  LockKeyhole,
  MessageSquareHeart,
  RotateCcw,
  Settings,
  Shield,
  Sliders,
  Type,
  UserRound,
} from "lucide-react";
import { CriteriaGlossaryModal } from "./CriteriaGlossaryModal";
import { useAuth } from "@/lib/context/auth-context";
import { supabase } from "@/lib/supabase";
import { languageName } from "@/lib/data/language";
import { useSettings } from "@/lib/context/settings-context";
import { setUserAppMode, type OrganizationAppMode } from "@/app/actions/organization-mode";
import { ConfirmModal } from "./ConfirmModal";

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

const fontHelpers: Record<FontOptionId, { id: string; en: string }> = {
  din: { id: "Ramah dan bulat", en: "Friendly and rounded" },
  nunito: { id: "Lembut seperti aplikasi belajar", en: "Soft, like a learning app" },
  jakarta: { id: "Bersih dan modern", en: "Clean and modern" },
  atkinson: { id: "Paling mudah dibaca", en: "Easiest to read" },
};

const tabs = [
  { id: "account", label: "Akun", icon: UserRound },
  { id: "mode", label: "Mode", icon: MessageSquareHeart },
  { id: "appearance", label: "Tampilan", icon: Sliders },
  // { id: "guide", label: "Panduan", icon: BookOpen },
] as const;

type FontOptionId = (typeof fontOptions)[number]["id"];
type SettingsTab = (typeof tabs)[number]["id"];

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
    const raw = window.localStorage?.getItem(FONT_SCALE_STORAGE_KEY);
    if (raw === null || raw === undefined) return 1;
    const storedScale = Number(raw);
    return Number.isFinite(storedScale)
      ? Math.min(Math.max(storedScale, 0.9), 1.18)
      : 1;
  } catch {
    return 1;
  }
}

export function SettingsDropdown() {
  const { user, organizations, activeOrganizationId, setActiveOrganizationId, setActiveOrganizationMode } =
    useAuth();
  const canSwitchOrg = organizations.length > 1;
  const activeOrg = organizations.find((org) => org.id === activeOrganizationId) ?? null;
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [fontFamily, setFontFamily] =
    useState<FontOptionId>(getInitialFontFamily);
  const [fontScale, setFontScale] = useState(getInitialFontScale);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [pendingMode, setPendingMode] = useState<OrganizationAppMode | null>(null);
  const [modeError, setModeError] = useState<string | null>(null);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { language, setLanguage } = useSettings();
  const isEnglish = language === "en";

  async function confirmModeChange() {
    if (!activeOrg || !pendingMode) return;
    setIsUpdatingMode(true);
    setModeError(null);
    const result = await setUserAppMode(activeOrg.id, pendingMode);
    setIsUpdatingMode(false);
    if (!result.success) {
      setModeError(result.error ?? (isEnglish ? "Could not change mode." : "Mode tidak dapat diubah."));
      setPendingMode(null);
      return;
    }
    setActiveOrganizationMode(pendingMode);
    setPendingMode(null);
    setIsOpen(false);
    router.push("/");
    router.refresh();
  }


  useEffect(() => {
    applyAppearance(fontFamily, fontScale);
  }, [fontFamily, fontScale]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError(isEnglish ? "Password must be at least 8 characters." : "Password minimal 8 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(isEnglish ? "The password confirmation does not match." : "Konfirmasi password belum sama.");
      return;
    }

    setIsUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsUpdatingPassword(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage(isEnglish ? "Password updated successfully." : "Password berhasil diperbarui.");
  }

  return (
    <div className="relative inline-block z-[1000] text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:translate-y-px border-2 ${
          isOpen
            ? "bg-brand-500 text-white border-brand-400"
            : "bg-white text-slate-500 border-slate-200 hover:border-brand-200"
        }`}
        style={
          isOpen
            ? { boxShadow: "0 3px 0 0 var(--brand-700)" }
            : { boxShadow: "0 3px 0 0 #cbd5e1" }
        }
        title={isEnglish ? "Settings" : "Pengaturan"}
      >
        <Settings
          className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="fixed left-1/2 top-[4.5rem] z-50 flex max-h-[calc(100vh-6rem)] w-[24rem] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-col rounded-[1.5rem] border-2 border-slate-100 bg-white animate-fade-in"
          style={{ boxShadow: "0 6px 0 0 #e2e8f0" }}
        >
          <div className="px-5 py-4 border-b-2 border-slate-100">
            <h4 className="font-black text-slate-800 text-base">{isEnglish ? "Settings" : "Pengaturan"}</h4>
            <p className="text-[11px] text-slate-400 font-bold mt-0.5">
              {activeTab === "mode"
                ? (isEnglish ? "Your preferred application mode" : "Mode aplikasi pilihan Anda")
                : (isEnglish ? "Account & appearance" : "Akun & tampilan")}
            </p>
          </div>

          <div className="px-3 pt-3">
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-black transition-colors ${
                      isSelected
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{isEnglish ? (tab.id === "account" ? "Account" : tab.id === "mode" ? "Mode" : "Appearance") : tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {activeTab === "account" && (
              <div className="space-y-3">
                <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 border-2 border-slate-200"
                      style={{ boxShadow: "0 2px 0 0 #cbd5e1" }}
                    >
                      <UserRound className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-800">
                        {user?.user_metadata?.name ??
                          user?.email?.split("@")[0] ??
                          "Pengguna CDS"}
                      </span>
                      <span className="block truncate text-[10px] font-bold text-slate-400">
                        {user?.email ?? "Email tidak tersedia"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-slate-100 bg-white p-3">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-sm font-black text-slate-800">
                        {isEnglish ? "Organisation" : "Institusi Pengguna"}
                      </span>
                      <span className="block text-[10px] font-bold text-slate-400">
                        {isEnglish ? "Choose active organisation" : "Pilih institusi aktif"}
                      </span>
                    </div>
                  </div>

                  {canSwitchOrg ? (
                    <div className="space-y-1">
                      {organizations.map((org) => {
                        const isSelected = org.id === activeOrganizationId;

                        return (
                          <button
                            key={org.id}
                            type="button"
                            onClick={() => setActiveOrganizationId(org.id)}
                            className={`flex w-full items-center justify-between rounded-2xl p-3 text-left transition-colors ${
                              isSelected
                                ? "bg-brand-50"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                  isSelected
                                    ? "bg-brand-500 text-white"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                <Building2 className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p
                                  className={`truncate text-sm font-black ${
                                    isSelected
                                      ? "text-brand-800"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {org.name}
                                </p>
                                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                  {org.role}
                                </p>
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="ml-2 h-4 w-4 shrink-0 text-brand-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-700">
                          {activeOrg?.name ?? (isEnglish ? "No organisation yet" : "Belum ada organisasi")}
                        </p>
                        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                          {activeOrg?.role ?? (isEnglish ? "No role" : "Tidak ada role")}
                        </p>
                      </div>
                      <CheckCircle2 className="ml-2 h-4 w-4 shrink-0 text-brand-500" />
                    </div>
                  )}
                </div>

                <form
                  onSubmit={handlePasswordSubmit}
                  className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-3"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 border-2 border-slate-200">
                      <LockKeyhole className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-sm font-black text-slate-800">
                        {isEnglish ? "Change password" : "Ganti Password"}
                      </span>
                      <span className="block text-[10px] font-bold text-slate-400">
                        {isEnglish ? "At least 8 characters" : "Minimal 8 karakter"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(event) => {
                          setNewPassword(event.target.value);
                          setPasswordError(null);
                          setPasswordMessage(null);
                        }}
                        placeholder={isEnglish ? "New password" : "Password baru"}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 pr-10 text-sm font-bold text-slate-700 outline-none transition-colors placeholder:text-slate-300 focus:border-brand-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title={
                          showNewPassword
                            ? (isEnglish ? "Hide password" : "Sembunyikan password")
                            : (isEnglish ? "Show password" : "Tampilkan password")
                        }
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(event) => {
                          setConfirmPassword(event.target.value);
                          setPasswordError(null);
                          setPasswordMessage(null);
                        }}
                        placeholder={isEnglish ? "Repeat new password" : "Ulangi password baru"}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 pr-10 text-sm font-bold text-slate-700 outline-none transition-colors placeholder:text-slate-300 focus:border-brand-300"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword((value) => !value)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title={
                          showConfirmPassword
                            ? (isEnglish ? "Hide password" : "Sembunyikan password")
                            : (isEnglish ? "Show password" : "Tampilkan password")
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-600">
                      {passwordError}
                    </p>
                  )}
                  {passwordMessage && (
                    <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-[11px] font-bold text-brand-700">
                      {passwordMessage}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      isUpdatingPassword || !newPassword || !confirmPassword
                    }
                    className="mt-3 flex h-10 w-full items-center justify-center rounded-2xl bg-brand-500 text-xs font-black text-white transition-all hover:bg-brand-600 active:translate-y-px disabled:cursor-not-allowed disabled:bg-slate-300"
                    style={{
                      boxShadow:
                        isUpdatingPassword || !newPassword || !confirmPassword
                          ? "0 3px 0 0 #94a3b8"
                          : "0 3px 0 0 var(--brand-700)",
                    }}
                  >
                    {isUpdatingPassword ? (isEnglish ? "Saving..." : "Menyimpan...") : (isEnglish ? "Save password" : "Simpan Password")}
                  </button>
                </form>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="rounded-2xl bg-slate-50 border-2 border-slate-100 p-3">
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="w-9 h-9 bg-white text-slate-600 rounded-xl border-2 border-slate-200 flex items-center justify-center flex-shrink-0"
                    style={{ boxShadow: "0 2px 0 0 #cbd5e1" }}
                  >
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-black text-slate-800 text-sm">
                      {isEnglish ? "Appearance" : "Tampilan"}
                    </span>
                    <span className="block text-[10px] text-slate-400 font-bold">
                      {isEnglish ? "Font & text size" : "Huruf & ukuran teks"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-white border border-slate-100 px-3 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Languages className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        {isEnglish ? "Language" : "Bahasa / Language"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(["id", "en"] as const).map((option) => {
                        const selected = language === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setLanguage(option)}
                            className={`rounded-xl border px-3 py-2 text-left text-sm font-black transition-colors ${
                              selected
                                ? "border-brand-300 bg-brand-50 text-brand-800"
                                : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                            }`}
                          >
                            {languageName(option)}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px] font-bold text-slate-400">
                      {language === "en" ? "New AI conversations and reports will be written in English." : "Percakapan dan laporan AI baru akan ditulis dalam Bahasa Indonesia."}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Type className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        {isEnglish ? "Font family" : "Jenis Huruf"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {fontOptions.map((option) => {
                        const isSelected = fontFamily === option.id;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setFontFamily(option.id)}
                            className={`text-left rounded-2xl border px-3 py-2 transition-all ${
                              isSelected
                                ? "bg-brand-50 border-brand-300 text-brand-900 shadow-sm"
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
                              {isEnglish ? fontHelpers[option.id].en : fontHelpers[option.id].id}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white border border-slate-100 px-3 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      {isEnglish ? "Text size" : "Ukuran Teks"}
                      </span>
                      <span className="text-[11px] font-black text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
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
                      className="w-full accent-brand-600"
                      aria-label={isEnglish ? "Application text size" : "Ukuran teks aplikasi"}
                    />
                    <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>{isEnglish ? "Small" : "Kecil"}</span>
                      <span>{isEnglish ? "Normal" : "Normal"}</span>
                      <span>{isEnglish ? "Large" : "Besar"}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFontFamily("din");
                      setFontScale(1);
                    }}
                    className="w-full flex items-center justify-center gap-2 text-[11px] font-black text-slate-500 hover:text-brand-700 bg-white hover:bg-brand-50 border border-slate-100 hover:border-brand-100 rounded-2xl py-2 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {isEnglish ? "Restore default appearance" : "Kembalikan Tampilan Awal"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "mode" && (
              <div className="space-y-3">
                <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-brand-100 bg-brand-50 text-brand-700">
                      <MessageSquareHeart className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-sm font-black text-slate-800">{isEnglish ? "Application mode" : "Mode aplikasi"}</span>
                      <span className="block text-[10px] font-bold text-slate-400">{isEnglish ? "This choice is saved for your account" : "Pilihan ini disimpan untuk akun Anda"}</span>
                    </div>
                  </div>
                </div>

                {([
                  {
                    id: "cds" as const,
                    title: "CDS",
                    description: isEnglish ? "Full CMS assessment, progress, and support plans." : "Asesmen CMS lengkap, progres, dan rencana penanganan.",
                  },
                  {
                    id: "bp" as const,
                    title: isEnglish ? "Counselling mode" : "Mode BK",
                    description: isEnglish ? "Focused counselling notes, issues, and practical follow-up without CMS scores." : "Catatan bimbingan, masalah, dan tindak lanjut praktis tanpa skor CMS.",
                  },
                ]).map((mode) => {
                  const selected = activeOrg?.appMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      disabled={selected || isUpdatingMode}
                      onClick={() => setPendingMode(mode.id)}
                      className={`w-full rounded-2xl border-2 p-4 text-left transition-all disabled:cursor-default ${selected ? "border-brand-300 bg-brand-50" : "border-slate-100 bg-white hover:border-brand-200"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-sm font-black ${selected ? "text-brand-800" : "text-slate-800"}`}>{mode.title}</p>
                          <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{mode.description}</p>
                        </div>
                        {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" />}
                      </div>
                    </button>
                  );
                })}

                {modeError && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-600">{modeError}</p>}
              </div>
            )}

            {/* {activeTab === "guide" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsGlossaryOpen(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-brand-50 text-left transition-colors group cursor-pointer"
                >
                  <div
                    className="w-9 h-9 bg-brand-100 text-brand-700 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0"
                    style={{ boxShadow: "0 2px 0 0 var(--brand-300)" }}
                  >
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-black text-slate-800 text-sm">
                      Panduan Kriteria
                    </span>
                    <span className="block text-[10px] text-slate-400 font-bold mt-0.5">
                      Character, Mental, Soft Skill
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    alert(
                      "Pusat Bantuan Ustadz CDS siap melayani. Panduan teknis dapat diunduh di portal santri.",
                    );
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 text-left transition-colors group cursor-pointer"
                >
                  <div
                    className="w-9 h-9 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0"
                    style={{ boxShadow: "0 2px 0 0 #cbd5e1" }}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-black text-slate-800 text-sm">
                      Pusat Bantuan
                    </span>
                    <span className="block text-[10px] text-slate-400 font-bold mt-0.5">
                      Panduan teknis pengisian laporan
                    </span>
                  </div>
                </button>
              </div>
            )} */}
          </div>

          <div className="border-t-2 border-slate-100 px-5 py-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-black">
              <div
                className="w-4 h-4 bg-brand-500 rounded-md flex items-center justify-center"
                style={{ boxShadow: "0 1px 0 0 var(--brand-700)" }}
              >
                <Shield className="w-2.5 h-2.5 text-white" />
              </div>
              CDS V0.1
            </span>
            <span className="text-[10px] text-slate-400 font-black">
              {languageName(language)}
            </span>
          </div>
        </div>
      )}

      <CriteriaGlossaryModal
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />
      <ConfirmModal
        isOpen={pendingMode !== null}
        title={pendingMode === "bp" ? (isEnglish ? "Switch to Counselling mode?" : "Beralih ke Mode BK?") : (isEnglish ? "Switch to CDS?" : "Beralih ke CDS?")}
        description={pendingMode === "bp" ? (isEnglish ? "CMS progress remains intact. This changes only your own workspace; colleagues keep their chosen mode." : "Progres CMS tetap aman. Ini hanya mengubah ruang kerja Anda; rekan tetap memakai mode pilihannya.") : (isEnglish ? "Your counselling session history remains intact. This changes only your own workspace." : "Riwayat sesi BK tetap aman. Ini hanya mengubah ruang kerja Anda.")}
        confirmLabel={isEnglish ? "Switch mode" : "Ganti mode"}
        cancelLabel={isEnglish ? "Cancel" : "Batal"}
        confirmVariant="success"
        onConfirm={confirmModeChange}
        onCancel={() => setPendingMode(null)}
      />
    </div>
  );
}
