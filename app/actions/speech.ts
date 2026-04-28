"use server";

export async function generateSpeech(text: string) {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  const VOICE_ID = "TX3LPaxmHKxFdv7VOQHJ"; // Liam

  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is missing");
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
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs Error: ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Return as base64 string to the client
    return buffer.toString('base64');
  } catch (error: any) {
    console.error("Speech Generation Error:", error);
    throw error;
  }
}
