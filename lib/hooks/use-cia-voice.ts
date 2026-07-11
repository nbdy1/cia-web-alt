/**
 * lib/hooks/use-cia-voice.ts
 *
 * Text-to-speech hook used during the AI interview (assessment/page.tsx) to
 * read AI responses aloud. Supports two backends:
 *
 *   1. ElevenLabs (high-quality, paid) — toggled on by setting USE_ELEVENLABS
 *      to true and providing ELEVENLABS_API_KEY in .env.local. Calls the
 *      generateSpeech server action which returns base64 MP3 audio.
 *
 *   2. Browser SpeechSynthesis (native, free, default) — uses the built-in
 *      Web Speech API with lang="id-ID". No API key required.
 *
 * Usage:
 *   const { speak, stop, unlock, isSpeaking } = useCIAVoice();
 *   // Call unlock() inside a user gesture (button tap) once, early:
 *   <button onClick={() => { unlock(); ...record... }} />
 *   speak("Terima kasih, bisa ceritakan lebih lanjut?");
 *
 * WHY unlock() EXISTS (the "no audio after voice recording" bug):
 *   On mobile browsers (especially iOS Safari) an HTMLAudioElement can only
 *   start playback if it was previously "blessed" by a user gesture. When the
 *   user records with the microphone (SpeechRecognition / getUserMedia) the OS
 *   audio session flips into record mode, and a *freshly created* Audio element
 *   whose first play() happens AFTER an await (the ElevenLabs network call) is
 *   then rejected with NotAllowedError — so nothing is heard. Typing never
 *   touches the mic, so it always worked. The fix is to (a) reuse ONE audio
 *   element that we unlock during a tap, and (b) retry play() once after a
 *   short delay to let the audio session settle after recording.
 *
 * Note: Voice input (microphone / speech recognition) is handled separately
 * in each page via the SpeechRecognition Web API (Chrome only).
 */
"use client";

import { useCallback, useState, useRef } from "react";
import { generateSpeech } from "@/app/actions/speech";

// Master kill switch — when false, speak() is a no-op regardless of backend
// (no ElevenLabs call, no browser SpeechSynthesis fallback). TTS is disabled
// app-wide for now; flip back to true to re-enable.
const TTS_ENABLED = false;

const USE_ELEVENLABS = true; // Toggle this to switch between ElevenLabs and Native Browser TTS

// A tiny (~0.05s) silent WAV used only to "unlock" the shared audio element
// during a user gesture. Built once at module load so we don't ship a magic
// base64 blob and don't rebuild it on every call.
const SILENT_WAV = (() => {
  if (typeof window === "undefined") return "";
  const sampleRate = 8000;
  const numSamples = Math.floor(sampleRate * 0.05);
  const dataSize = numSamples; // 8-bit mono => 1 byte/sample
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) view.setUint8(44 + i, 128); // 8-bit silence
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(binary);
})();

export function useCIAVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  // ONE reusable audio element for the whole session. Reusing (instead of
  // `new Audio()` per call) is what keeps playback allowed after mic use.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  const getAudioEl = useCallback((): HTMLAudioElement | null => {
    if (typeof window === "undefined") return null;
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = "auto";
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  // Must be called from within a user gesture (tapping the mic or send button).
  // Plays a silent clip so the browser marks this audio element as user-approved,
  // which lets a later play() succeed even after the microphone has been used.
  const unlock = useCallback(() => {
    const el = getAudioEl();
    if (!el || unlockedRef.current || !SILENT_WAV) return;
    try {
      el.muted = true;
      el.src = SILENT_WAV;
      const p = el.play();
      if (p && typeof (p as Promise<void>).then === "function") {
        (p as Promise<void>)
          .then(() => {
            el.pause();
            el.currentTime = 0;
            el.muted = false;
            unlockedRef.current = true;
          })
          .catch(() => {
            // Not fatal — speak() still retries play() at call time.
            el.muted = false;
          });
      } else {
        el.muted = false;
        unlockedRef.current = true;
      }
    } catch {
      el.muted = false;
    }
  }, [getAudioEl]);

  const speak = useCallback(
    async (text: string) => {
      if (!text || !TTS_ENABLED) return;

      const el = getAudioEl();

      // Stop any current audio
      if (el) {
        el.pause();
      }
      window.speechSynthesis?.cancel();

      setIsSpeaking(true);

      if (USE_ELEVENLABS && el) {
        try {
          const base64Audio = await generateSpeech(text);
          el.src = `data:audio/mpeg;base64,${base64Audio}`;
          el.muted = false;
          el.onended = () => setIsSpeaking(false);
          el.onerror = () => setIsSpeaking(false);

          try {
            await el.play();
            return;
          } catch (playErr) {
            // Playback was blocked — most commonly because the mic (voice
            // recording) just released the audio session and it hasn't settled
            // yet. Wait a beat and retry once before falling back.
            await new Promise((r) => setTimeout(r, 300));
            try {
              await el.play();
              return;
            } catch (retryErr) {
              console.error(
                "ElevenLabs audio play blocked even after retry (likely audio session busy after mic use):",
                retryErr
              );
            }
          }
        } catch (error) {
          console.error(
            "Failed to generate/play ElevenLabs audio, falling back to native:",
            error
          );
        }
      }

      // Native Browser TTS (fallback)
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "id-ID";
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }
    },
    [getAudioEl]
  );

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, unlock, isSpeaking };
}
