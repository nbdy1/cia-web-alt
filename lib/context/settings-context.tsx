"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { MODEL_OPTIONS } from "@/lib/data/models";

interface SettingsContextType {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

const MODEL_STORAGE_KEY = "cia:selected-model";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
      if (stored && MODEL_OPTIONS.some((m) => m.id === stored)) {
        setSelectedModel(stored);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const handleSetModel = (model: string) => {
    setSelectedModel(model);
    try {
      window.localStorage.setItem(MODEL_STORAGE_KEY, model);
    } catch (e) {
      // ignore
    }
  };

  return (
    <SettingsContext.Provider
      value={{ selectedModel, setSelectedModel: handleSetModel }}
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
