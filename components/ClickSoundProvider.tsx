/**
 * components/ClickSoundProvider.tsx
 *
 * Mounts once at the root layout and plays a short synthetic "click" sound on
 * every pointerdown event that lands on an interactive element (button, link,
 * summary/collapsible, checkbox, radio). No audio file required — the sound is
 * synthesised on-the-fly via the Web Audio API (a brief band-pass filtered
 * noise burst with fast exponential decay).
 *
 * AudioContext is created lazily on the first interaction to satisfy browser
 * autoplay policies. A single context is reused for the lifetime of the page.
 *
 * Elements can opt out by adding `data-no-click-sound` to the element or any
 * ancestor. Disabled buttons are also silently skipped.
 */
"use client";

import { useEffect, useRef } from "react";

// Selector for elements that should trigger the click sound.
const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], summary, label[for], input[type="checkbox"], input[type="radio"]';

function playClick(ctx: AudioContext) {
  const now = ctx.currentTime;
  const duration = 0.045;

  // Short white-noise burst through a bandpass filter — sounds like a crisp
  // mechanical button press rather than a beep.
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1400;
  filter.Q.value = 0.6;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.28, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration);
}

export function ClickSoundProvider() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const getCtx = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      }
      // Resume in case the browser suspended it
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Element;

      // Skip if the element or any ancestor opts out
      if (target.closest("[data-no-click-sound]")) return;

      // Must land on or inside an interactive element
      const interactive = target.closest(INTERACTIVE_SELECTOR);
      if (!interactive) return;

      // Skip disabled buttons
      if (
        interactive instanceof HTMLButtonElement && interactive.disabled
      ) return;

      try {
        playClick(getCtx());
      } catch {
        // AudioContext not available (SSR, old browser) — fail silently
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return null;
}
