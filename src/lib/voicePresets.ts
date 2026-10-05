export interface VoicePreset {
  id: string;
  name: string;
  avatar: string;
  persona: string;
  badge: string;
  description: string;
  sampleText: string;
  openAiVoice: "onyx" | "fable" | "echo" | "alloy" | "nova" | "shimmer";
  elevenLabsVoiceId?: string;
  synthConfig: {
    pitch: number;
    rate: number;
    lang: string;
  };
}

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: "james-cinematic",
    name: "James",
    avatar: "🎙️",
    persona: "Deep Cinematic Narrator",
    badge: "Epic Trailer",
    description: "Deep, resonant, authoritative voice ideal for high-stakes drama, thrillers, and epics.",
    sampleText: "In the electric shadows of Neo-Shinjuku, silence is the only armor that endures.",
    openAiVoice: "onyx",
    elevenLabsVoiceId: "ErXwobaYiN019PkySvjV", // Antoni / Deep
    synthConfig: { pitch: 0.82, rate: 0.92, lang: "en-US" },
  },
  {
    id: "eleanor-fantasy",
    name: "Eleanor",
    avatar: "🏰",
    persona: "British Fantasy Storyteller",
    badge: "Atmospheric",
    description: "Refined, melodic British cadence perfect for lore, mythic legends, and historical fiction.",
    sampleText: "At the spiral's center, the ocean was singing in a language older than fire.",
    openAiVoice: "fable",
    elevenLabsVoiceId: "jsCqWAovK2LkecY7zXl4", // Freya
    synthConfig: { pitch: 1.05, rate: 0.95, lang: "en-GB" },
  },
  {
    id: "echo-scifi",
    name: "Echo-7",
    avatar: "🤖",
    persona: "Sci-Fi AI Terminal",
    badge: "Cybernetic",
    description: "Crisp, analytical, and slightly synthetic tone suited for cyberpunk and space odysseys.",
    sampleText: "System diagnostic complete. Temporal anomaly detected on the lower perimeter.",
    openAiVoice: "echo",
    elevenLabsVoiceId: "pNInz6obpgDQGcFmaJgB", // Adam
    synthConfig: { pitch: 1.15, rate: 1.08, lang: "en-US" },
  },
  {
    id: "marcus-action",
    name: "Marcus",
    avatar: "⚡",
    persona: "Dynamic Action Narrator",
    badge: "High Energy",
    description: "Bold, punchy, and commanding cadence crafted for action sequences and trailers.",
    sampleText: "Three seconds on the clock, engines roaring, nowhere left to run.",
    openAiVoice: "alloy",
    elevenLabsVoiceId: "VR6AewLTigWG4xSOukaG", // Arnold
    synthConfig: { pitch: 0.9, rate: 1.05, lang: "en-US" },
  },
  {
    id: "aria-ambient",
    name: "Aria",
    avatar: "🌙",
    persona: "Warm Intimate Voice",
    badge: "ASMR & Documentary",
    description: "Soft, heartfelt, and breathy delivery for introspective documentaries and poetry.",
    sampleText: "I had walked these cliffs a thousand times, but that dawn, the stone opened.",
    openAiVoice: "nova",
    elevenLabsVoiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
    synthConfig: { pitch: 1.1, rate: 0.88, lang: "en-US" },
  },
  {
    id: "clara-classic",
    name: "Clara",
    avatar: "🌟",
    persona: "Clear Documentary",
    badge: "Balanced & Crisp",
    description: "Versatile, clear, and engaging voice suited for any story format.",
    sampleText: "Every door we open leads to another corridor waiting to be written.",
    openAiVoice: "shimmer",
    elevenLabsVoiceId: "EXAVITQu4vr4xnSDxMaL", // Bella
    synthConfig: { pitch: 1.0, rate: 1.0, lang: "en-US" },
  },
];

/**
 * Auditions a voice directly in the browser using Web Speech API with tailored persona acoustic tuning.
 */
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function stopVoiceAudition() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

export function auditionVoice(preset: VoicePreset, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  stopVoiceAudition();

  const u = new SpeechSynthesisUtterance(preset.sampleText);
  u.pitch = preset.synthConfig.pitch;
  u.rate = preset.synthConfig.rate;
  u.lang = preset.synthConfig.lang;

  // Best matching browser voice
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find(
    (v) => v.lang.startsWith(preset.synthConfig.lang.slice(0, 2)) && (
      (preset.id.includes("eleanor") && v.lang.includes("GB")) ||
      (preset.id.includes("james") && (v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("david"))) ||
      (preset.id.includes("aria") && (v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira")))
    )
  ) || voices.find((v) => v.lang.startsWith("en"));

  if (match) u.voice = match;

  u.onend = () => {
    currentUtterance = null;
    onEnd?.();
  };
  u.onerror = () => {
    currentUtterance = null;
    onEnd?.();
  };

  currentUtterance = u;
  window.speechSynthesis.speak(u);
}
