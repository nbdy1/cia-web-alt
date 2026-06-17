/**
 * app/actions/whisper.ts
 *
 * Server action that proxies audio to OpenRouter's Whisper transcription API.
 * The API key is kept server-side.
 *
 * Model: openai/whisper-large-v3-turbo via OpenRouter
 * Endpoint: https://openrouter.ai/api/v1/audio/transcriptions
 *
 * Called by the assessment page when the user has opted into Whisper mode.
 * The client records audio with MediaRecorder, base64-encodes the blob, and
 * sends it here. We re-hydrate the buffer, attach it as a file, and forward
 * to the API.
 *
 * Whisper accepts: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
 * Chrome produces: audio/webm (Opus) → extension "webm"
 * Safari produces: audio/mp4 (AAC)  → extension "mp4"
 */
"use server";

const MIME_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/webm;codecs=opus": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/flac": "flac",
};

export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing");

  // Normalise MIME (strip codec params for extension lookup, keep full for blob)
  const baseMime = mimeType.split(";")[0].trim();
  const ext = MIME_TO_EXT[baseMime] ?? MIME_TO_EXT[mimeType] ?? "webm";

  const buffer = Buffer.from(audioBase64, "base64");

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append("file", blob, `recording.${ext}`);
  formData.append("model", "openai/whisper-large-v3-turbo");
  formData.append("language", "id");

  const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return (result.text as string).trim();
}
