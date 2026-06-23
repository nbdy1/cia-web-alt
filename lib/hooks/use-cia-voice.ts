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
 *   const { speak, stop, isSpeaking } = useCIAVoice();
 *   speak("Terima kasih, bisa ceritakan lebih lanjut?");
 *
 * Note: Voice input (microphone / speech recognition) is handled separately
 * in each page via the SpeechRecognition Web API (Chrome only).
 */
"use client";

import { useCallback, useState, useRef } from "react";
import { generateSpeech } from "@/app/actions/speech";

const USE_ELEVENLABS = false; // Toggle this to switch between ElevenLabs and Native Browser TTS

export function useCIAVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string) => {
    if (!text) return;

    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();

    setIsSpeaking(true);

    if (USE_ELEVENLABS) {
      try {
        const base64Audio = await generateSpeech(text);
        const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
        
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        
        await audio.play();
        return;
      } catch (error) {
        console.error("Failed to play ElevenLabs audio, falling back to native:", error);
      }
    }

    // Native Browser TTS
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}

