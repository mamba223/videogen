export const runtime = "nodejs";

import { VOICE_PRESETS } from "@/lib/voicePresets";

export async function POST(req: Request) {
  try {
    const { text, voiceId = "aria-ambient", voice } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return Response.json({ error: "Text is required" }, { status: 400 });
    }

    const cleanText = text.trim().slice(0, 1000);
    const targetPreset = VOICE_PRESETS.find((v) => v.id === voiceId || v.id === voice);
    const openAiVoice = targetPreset?.openAiVoice || (voice as "nova") || "nova";
    const elevenLabsVoice = targetPreset?.elevenLabsVoiceId || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

    // 1. ElevenLabs Provider
    if (process.env.ELEVENLABS_API_KEY) {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoice}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: "eleven_monolingual_v1",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (res.ok) {
        const audioBuffer = await res.arrayBuffer();
        return new Response(audioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    // 2. OpenAI TTS Provider
    if (process.env.OPENAI_API_KEY) {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "tts-1",
          input: cleanText,
          voice: openAiVoice,
        }),
      });

      if (res.ok) {
        const audioBuffer = await res.arrayBuffer();
        return new Response(audioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    // 3. Fallback: Return metadata for client-side SpeechSynthesis (Web Speech API)
    return Response.json({
      fallback: true,
      text: cleanText,
      voicePreset: targetPreset || null,
      message: "No cloud TTS key configured. Client speech synthesis will be used.",
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "TTS generation failed" },
      { status: 500 }
    );
  }
}
