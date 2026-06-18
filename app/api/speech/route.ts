/**
 * app/api/speech/route.ts
 *
 * Next.js Route Handler that proxies text to the ElevenLabs streaming TTS
 * endpoint and pipes the audio bytes directly to the browser as they arrive.
 * The client can start playback before the full clip is downloaded, cutting
 * time-to-first-sound from ~2-4s (full download) to ~300-500ms (first chunk).
 *
 * Model: eleven_flash_v2_5 — ElevenLabs' lowest-latency model (~75ms server
 * latency vs ~300ms for eleven_multilingual_v2), supports Indonesian.
 *
 * Called by: lib/hooks/use-cia-voice.ts
 */

export const runtime = "nodejs";

const VOICE_ID = "TX3LPaxmHKxFdv7VOQHJ"; // Liam
// const VOICE_ID = "q8qwd1jY2jS3AWOBeq25"; // Pratama (lebih ekspresif, cocok untuk Bahasa Indonesia)
const MODEL_ID = "eleven_flash_v2_5";

export async function POST(request: Request) {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    return new Response("Missing ELEVENLABS_API_KEY", { status: 500 });
  }

  let text: string;
  try {
    ({ text } = await request.json());
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!text?.trim()) {
    return new Response("Missing text", { status: 400 });
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed: 1.2,
        },
        lanquage_code: "id", // Indonesian
      }),
    }
  );

  if (!upstream.ok) {
    const err = await upstream.text();
    console.error("[speech/route] ElevenLabs error:", err);
    return new Response(err, { status: upstream.status });
  }

  // Pipe the ElevenLabs stream straight to the browser — no buffering on the
  // server, so the client receives audio bytes as soon as they're generated.
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
