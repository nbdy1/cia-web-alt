/**
 * lib/hooks/use-whisper-recorder.ts
 *
 * Voice input that works where the Web Speech API does not (the Android app's
 * WebView, Firefox, some iOS setups): record with MediaRecorder, then send the audio
 * to the transcribeAudio server action (OpenRouter Whisper). Used by the BK
 * assessment; the CDS assessment has its own copy of the same flow.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "@/app/actions/whisper";

type Options = {
  studentId?: string | null;
  isEnglish: boolean;
  /** Called with the transcribed text once recording stops. */
  onText: (text: string) => void;
  /** Called with a user-facing message when the mic or transcription fails. */
  onError: (message: string | null) => void;
  /** Lets the host keep its own "recording" UI state in sync. */
  onRecordingChange?: (recording: boolean) => void;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useWhisperRecorder({ studentId, isEnglish, onText, onError, onRecordingChange }: Options) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const setRecording = useCallback(
    (value: boolean) => {
      setIsRecording(value);
      onRecordingChange?.(value);
    },
    [onRecordingChange],
  );

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    onError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        releaseMic();
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size === 0) return;
        setIsTranscribing(true);
        try {
          const text = await transcribeAudio(await blobToBase64(blob), mimeType, studentId);
          if (text) onText(text);
        } catch {
          onError(isEnglish ? "Transcription failed. Please try again." : "Transkripsi gagal. Coba lagi.");
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch {
      releaseMic();
      onError(
        isEnglish
          ? "Microphone access was denied. Allow it in your settings, then try again."
          : "Akses mikrofon ditolak. Izinkan di pengaturan lalu coba lagi.",
      );
    }
  }, [isEnglish, onError, onText, releaseMic, setRecording, studentId]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    setRecording(false);
  }, [setRecording]);

  const toggle = useCallback(() => {
    if (isRecording) stop();
    else void start();
  }, [isRecording, start, stop]);

  // Never leave the microphone open if the page goes away mid-recording.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { isRecording, isTranscribing, start, stop, toggle };
}
