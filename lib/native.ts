/**
 * lib/native.ts
 *
 * Detects whether the site is running inside the Android app (a Capacitor WebView
 * that loads the live site, see native/) and what that environment can't do.
 *
 * The app tags its user agent with "CDSApp/<version>" (native/capacitor.config.json
 * -> android.appendUserAgent), which is the primary signal; Capacitor's own bridge
 * is checked as a backup. Everything here is safe to call during SSR (returns false).
 */
export const NATIVE_APP_UA_MARKER = "CDSApp/";

type CapacitorLike = { isNativePlatform?: () => boolean } | undefined;

/** Pure form, so it can be unit tested. */
export function detectNativeApp(userAgent: string | undefined, capacitor?: CapacitorLike): boolean {
  if (userAgent && userAgent.includes(NATIVE_APP_UA_MARKER)) return true;
  try {
    return capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

export function isNativeApp(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  return detectNativeApp(navigator.userAgent, (window as unknown as { Capacitor?: CapacitorLike }).Capacitor);
}

export function hasSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Voice input mode. Android WebView has no Web Speech API recognition, so inside the
 * app (and in any browser without it) we record audio and transcribe it with Whisper
 * instead of showing "your browser does not support voice input".
 */
export function shouldUseWhisperVoice(): boolean {
  return isNativeApp() || !hasSpeechRecognition();
}
