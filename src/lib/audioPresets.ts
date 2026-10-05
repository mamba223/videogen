export interface AudioPreset {
  id: string;
  title: string;
  mood: string;
  url: string;
  emoji: string;
}

export const AUDIO_PRESETS: AudioPreset[] = [
  {
    id: "ambient-mystery",
    title: "Ethereal Mystery",
    mood: "Suspense, fantasy, discovery",
    emoji: "🌌",
    url: "https://actions.google.com/sounds/v1/ambiences/humming_room_tone.ogg",
  },
  {
    id: "cyber-pulse",
    title: "Cyberpunk Pulse",
    mood: "Sci-fi, neo-noir, action",
    emoji: "⚡",
    url: "https://actions.google.com/sounds/v1/science_fiction/forcefield_loop.ogg",
  },
  {
    id: "cinematic-drama",
    title: "Cinematic Atmosphere",
    mood: "Drama, tension, cinema",
    emoji: "🎻",
    url: "https://actions.google.com/sounds/v1/weather/wind_in_trees.ogg",
  },
  {
    id: "calm-ocean",
    title: "Ocean Reverie",
    mood: "Calm, reflective, coastal",
    emoji: "🌊",
    url: "https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg",
  },
  {
    id: "lofi-story",
    title: "Warm Campfire",
    mood: "Intimate, storytelling, warmth",
    emoji: "🔥",
    url: "https://actions.google.com/sounds/v1/ambiences/campfire.ogg",
  },
];
