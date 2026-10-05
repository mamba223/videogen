import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { getProvider } from "./providers.mjs";

// Auto-load environment variables if .env exists
for (const envPath of [".env", ".env.local", "../.env.local", "../.env"]) {
  try {
    if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
      process.loadEnvFile(envPath);
    }
  } catch {}
}

const rawUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const url = rawUrl?.trim();
const key = rawKey?.trim();
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see worker/.env.example)");
  process.exit(1);
}

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2);
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 2000);
const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS ?? 3);
const WORKER_ID = process.env.WORKER_ID ?? `worker-${randomUUID().slice(0, 8)}`;

// Service-role client: bypasses RLS. Never expose this key to the browser.
const sb = createClient(url, key, { auth: { persistSession: false } });
const provider = getProvider();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let running = 0;
let stopping = false;

async function referenceUrls(assetIds) {
  if (!assetIds?.length) return [];
  const { data } = await sb.from("story_assets").select("storage_path").in("id", assetIds);
  if (!data?.length) return [];
  const { data: signed } = await sb.storage.from("story-assets").createSignedUrls(data.map((a) => a.storage_path), 3600);
  return (signed ?? []).map((s) => s.signedUrl).filter(Boolean);
}

async function processScene(scene) {
  const t0 = Date.now();
  try {
    const { data: video, error } = await sb.from("videos")
      .select("user_id, style, reference_asset_ids, model").eq("id", scene.video_id).single();
    if (error) throw error;
    const prompt = video.style ? `${video.style}. Scene: ${scene.prompt}` : scene.prompt;
    const mp4 = await provider.generate({
      prompt,
      durationSec: scene.duration_sec,
      references: await referenceUrls(video.reference_asset_ids),
      model: video.model || "wan-2.1",
    });
    const path = `${video.user_id}/${scene.video_id}/${scene.id}.mp4`;
    const up = await sb.storage.from("clips").upload(path, mp4, { contentType: "video/mp4", upsert: true });
    if (up.error) throw up.error;
    const { data } = sb.storage.from("clips").getPublicUrl(path);
    const done = await sb.rpc("complete_scene", { p_scene: scene.id, p_clip: data.publicUrl });
    if (done.error) throw done.error;
    console.log(`✓ scene ${scene.idx} of ${scene.video_id.slice(0, 8)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    console.error(`✗ scene ${scene.idx} of ${scene.video_id.slice(0, 8)} (attempt ${scene.attempts}): ${message}`);
    await sb.rpc("fail_scene", { p_scene: scene.id, p_error: message, p_max_attempts: MAX_ATTEMPTS });
  }
}

async function loop() {
  console.log(`${WORKER_ID} started: provider=${provider.name} concurrency=${CONCURRENCY}`);
  while (!stopping) {
    const free = CONCURRENCY - running;
    let claimed = 0;
    if (free > 0) {
      const { data, error } = await sb.rpc("claim_scenes", { p_worker: WORKER_ID, p_limit: free });
      if (error) console.error("claim failed:", error.message);
      for (const scene of data ?? []) {
        claimed++;
        running++;
        processScene(scene).finally(() => { running--; });
      }
    }
    // Poll fast while there is work, slower when idle
    await sleep(claimed > 0 ? 250 : POLL_MS);
  }
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log(`Shutting down, waiting for ${running} running scene(s)...`);
  const deadline = Date.now() + 60_000;
  while (running > 0 && Date.now() < deadline) await sleep(500);
  // Anything still running will be re-queued automatically after the 10 minute lock timeout.
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

loop();
