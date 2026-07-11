"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { MODEL_OPTIONS } from "@/lib/data/models";

interface SettingsContextType {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  temperature: number;
  setTemperature: (temperature: number) => void;
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

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [temperature, setTemperatureState] = useState<number>(DEFAULT_TEMPERATURE);

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
  }, []);

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

  return (
    <SettingsContext.Provider
      value={{
        selectedModel,
        setSelectedModel: handleSetModel,
        temperature,
        setTemperature: handleSetTemperature,
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
