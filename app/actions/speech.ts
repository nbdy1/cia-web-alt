/**
 * app/actions/speech.ts
 *
 * Server action that proxies text to the ElevenLabs TTS API and returns the
 * resulting audio as a base64-encoded MP3 string. The API key is kept
 * server-side to avoid exposing it to the browser.
 *
 * Voice: "Liam" (ID: TX3LPaxmHKxFdv7VOQHJ), model: eleven_multilingual_v2.
 *
 * This action is called by the `useCDSVoice` hook in lib/hooks/use-cia-voice.ts
 * when USE_ELEVENLABS is set to true. By default the app uses browser-native
 * SpeechSynthesis instead (no API key required, lower quality).
 *
 * To enable ElevenLabs:
 *   1. Add ELEVENLABS_API_KEY to .env.local
 *   2. Set USE_ELEVENLABS = true in lib/hooks/use-cia-voice.ts
 */
"use server";

import { logSingleUsage } from "@/lib/usage/usage-tracker";
import { checkQuota } from "@/lib/usage/quota";

export async function generateSpeech(text: string) {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  // const VOICE_ID = "TX3LPaxmHKxFdv7VOQHJ"; // Liam
  const VOICE_ID = "d888tBvGmQT2u05J1xTv"; // Ahmad
  // const VOICE_ID = "q8qwd1jY2jS3AWOBeq25"; // Pratama (lebih ekspresif, cocok untuk Bahasa Indonesia)

  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is missing");
  }

  // Voice is gated by plan (feature flag + monthly character quota). When blocked
  // we throw; the voice hook catches this and falls back to browser speech.
  const quota = await checkQuota("voice");
  if (!quota.ok) {
    throw new Error(quota.message);
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_flash_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1.1,
          },
          language_code: "id", // Indonesian
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs Error: ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Meter voice usage (characters) — non-fatal.
    await logSingleUsage({
      purpose: "tts",
      provider: "elevenlabs",
      model: "flash-v2.5",
      charCount: text.length,
    });

    // Return as base64 string to the client
    return buffer.toString('base64');
  } catch (error: any) {
    console.error("Speech Generation Error:", error);
    throw error;
  }
}
