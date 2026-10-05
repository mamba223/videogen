export interface VideoEngineOption {
  id: "wan-2.1" | "ltx-video";
  name: string;
  badge: string;
  modeLabel: string;
  speed: string;
  fps: number;
  developer: string;
  tagline: string;
  description: string;
  bestFor: string;
}

export const VIDEO_ENGINES: VideoEngineOption[] = [
  {
    id: "wan-2.1",
    name: "Wan 2.1",
    badge: "🌟 Cinematic Quality",
    modeLabel: "Cinematic Flagship",
    speed: "~25–35s",
    fps: 16,
    developer: "Alibaba Cloud",
    tagline: "Unmatched photorealism, lifelike human dynamics, and character consistency",
    description: "Best for final releases, rich storytelling, series episodes, and character reference sheets.",
    bestFor: "Final Episodes & Serious Series",
  },
  {
    id: "ltx-video",
    name: "LTX-Video",
    badge: "⚡ Turbo Speed",
    modeLabel: "Turbo Draft",
    speed: "~10–15s",
    fps: 24,
    developer: "Lightricks",
    tagline: "Ultra-fast generation under 15 seconds for instant idea testing",
    description: "Best for rapid experimentation, prompt tuning, and fast storyboard drafts.",
    bestFor: "Rapid Testing & Quick Drafts",
  },
];

export const DEFAULT_ENGINE = "wan-2.1";

// Kept for backward compatibility
export const WAN_2_1 = VIDEO_ENGINES[0];
export const VIDEO_MODELS = VIDEO_ENGINES;
