/**
 * Provider-agnostic video generation interface.
 * Swap MockGenerator for a RunPod/LTX-Video/Wan worker without touching the UI.
 */
export type GenerationEvent =
  | { type: "progress"; progress: number; stage: string }
  | { type: "preview"; url: string }
  | { type: "done"; videoUrl: string; thumbnailUrl: string };

export interface GenerationRequest {
  prompt: string;
  durationSec: number;
  quality: "fast" | "hq";
  /** Reference image URLs (characters, places) the model should stay consistent with. */
  references?: string[];
}

export interface VideoGenerator {
  name: string;
  generate(req: GenerationRequest): AsyncGenerator<GenerationEvent>;
}

const SAMPLES = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://www.w3schools.com/html/mov_bbb.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simulates fast generation (~12s) with staged progress, so we can tune UX before real GPUs. */
export class MockGenerator implements VideoGenerator {
  name = "mock";
  async *generate(req: GenerationRequest): AsyncGenerator<GenerationEvent> {
    const stages: [string, number, number][] = [
      ["Understanding your idea", 10, 800],
      ["Sketching the first frame", 30, 1500],
      ["Animating", 75, 6000],
      ["Safety check", 90, 1200],
      ["Finishing touches", 100, 800],
    ];
    for (const [stage, progress, ms] of stages) {
      yield { type: "progress", progress, stage };
      await sleep(ms);
    }
    const url = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
    yield { type: "done", videoUrl: url, thumbnailUrl: "" };
  }
}

export function getGenerator(): VideoGenerator {
  // Later: if (process.env.GPU_WORKER_URL) return new RunPodGenerator(...)
  return new MockGenerator();
}
