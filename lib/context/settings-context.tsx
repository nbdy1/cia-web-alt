"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { MODEL_OPTIONS } from "@/lib/data/models";
import { normalizeAppLanguage, type AppLanguage } from "@/lib/data/language";

interface SettingsContextType {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  temperature: number;
  setTemperature: (temperature: number) => void;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

const MODEL_STORAGE_KEY = "cia:selected-model";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const TEMPERATURE_STORAGE_KEY = "cia:temperature";
const DEFAULT_TEMPERATURE = 0.7;
const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;
const LANGUAGE_STORAGE_KEY = "cia:language";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [temperature, setTemperatureState] = useState<number>(DEFAULT_TEMPERATURE);
  const [language, setLanguageState] = useState<AppLanguage>("id");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
      if (stored && MODEL_OPTIONS.some((m) => m.id === stored)) {
        setSelectedModel(stored);
      }
    } catch (e) {
      // ignore
    }

    try {
      const storedTemp = window.localStorage.getItem(TEMPERATURE_STORAGE_KEY);
      const parsed = storedTemp !== null ? Number(storedTemp) : NaN;
      if (Number.isFinite(parsed) && parsed >= MIN_TEMPERATURE && parsed <= MAX_TEMPERATURE) {
        setTemperatureState(parsed);
      }
    } catch (e) {
      // ignore
    }

    try {
      setLanguageState(normalizeAppLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)));
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    // Keep legacy localStorage-only preferences in sync for server-rendered
    // screens on their next navigation.
    document.cookie = `cia-language=${language}; path=/; max-age=31536000; samesite=lax`;
  }, [language]);

  const handleSetModel = (model: string) => {
    setSelectedModel(model);
    try {
      window.localStorage.setItem(MODEL_STORAGE_KEY, model);
    } catch (e) {
      // ignore
    }
  };

  const handleSetTemperature = (value: number) => {
    const clamped = Math.min(MAX_TEMPERATURE, Math.max(MIN_TEMPERATURE, value));
    setTemperatureState(clamped);
    try {
      window.localStorage.setItem(TEMPERATURE_STORAGE_KEY, String(clamped));
    } catch (e) {
      // ignore
    }
  };

  const handleSetLanguage = (value: AppLanguage) => {
    setLanguageState(value);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
      // Server-rendered pages (reports, recap, and rapor) need the same
      // preference on their first render, before React has hydrated.
      document.cookie = `cia-language=${value}; path=/; max-age=31536000; samesite=lax`;
    } catch (e) {
      // ignore
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        selectedModel,
        setSelectedModel: handleSetModel,
        temperature,
        setTemperature: handleSetTemperature,
        language,
        setLanguage: handleSetLanguage,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
