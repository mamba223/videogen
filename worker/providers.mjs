// GPU backends. Each provider turns a scene into mp4 bytes.
//   mock    – waits a few seconds and returns a sample clip (tests the whole pipeline without a GPU)
//   http    – POST {GPU_ENDPOINT_URL}/generate (see gpu-server/server.py), returns video/mp4
//   runpod  – RunPod serverless endpoint (see gpu-server/runpod_handler.py), async run + poll

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SAMPLES = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://www.w3schools.com/html/mov_bbb.mp4",
];

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

const mock = {
  name: "mock",
  async generate() {
    await sleep(3000 + Math.random() * 4000);
    if (process.env.MOCK_FAIL_RATE && Math.random() < Number(process.env.MOCK_FAIL_RATE)) {
      throw new Error("mock failure (MOCK_FAIL_RATE)");
    }
    return download(SAMPLES[Math.floor(Math.random() * SAMPLES.length)]);
  },
};

const http = {
  name: "http",
  async generate({ prompt, durationSec, references, seed, model, dialogue, voice }) {
    const base = requireEnv("GPU_ENDPOINT_URL").replace(/\/$/, "");
    const res = await fetch(`${base}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.GPU_API_KEY ? { Authorization: `Bearer ${process.env.GPU_API_KEY}` } : {}),
      },
      body: JSON.stringify({ prompt, duration_sec: durationSec, references, seed, model, dialogue, voice }),
      signal: AbortSignal.timeout(Number(process.env.GPU_TIMEOUT_MS ?? 480000)),
    });
    if (!res.ok) throw new Error(`GPU server ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return Buffer.from(await res.arrayBuffer());
  },
};

const runpod = {
  name: "runpod",
  async generate({ prompt, durationSec, references, seed, model, dialogue, voice }) {
    let rawId = requireEnv("RUNPOD_ENDPOINT_ID").trim();
    const urlMatch = rawId.match(/runpod\.ai\/v2\/([a-zA-Z0-9_-]+)/);
    const id = urlMatch ? urlMatch[1] : rawId.replace(/^https?:\/\/[^\/]+\//, "").split("/")[0].trim();
    const apiKey = requireEnv("RUNPOD_API_KEY").trim();
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
    const base = `https://api.runpod.ai/v2/${id}`;
    const run = await fetch(`${base}/run`, {
      method: "POST", headers,
      body: JSON.stringify({ input: { prompt, duration_sec: durationSec, references, seed, model, dialogue, voice } }),
    });
    if (!run.ok) throw new Error(`RunPod run ${run.status}: ${await run.text()}`);
    const { id: jobId } = await run.json();
    const deadline = Date.now() + Number(process.env.GPU_TIMEOUT_MS ?? 480000);
    while (Date.now() < deadline) {
      await sleep(2000);
      const st = await (await fetch(`${base}/status/${jobId}`, { headers })).json();
      if (st.status === "COMPLETED") {
        if (st.output?.video_base64) return Buffer.from(st.output.video_base64, "base64");
        if (st.output?.video_url) return download(st.output.video_url);
        const o = st.output;
        const shape = o && typeof o === "object"
          ? JSON.stringify(o, (k, v) => (typeof v === "string" && v.length > 120 ? v.slice(0, 120) + "…" : v)).slice(0, 300)
          : JSON.stringify(o);
        throw new Error(`RunPod finished without a video. Handler output was: ${shape}`);
      }
      if (st.status === "FAILED" || st.status === "CANCELLED" || st.status === "TIMED_OUT") {
        throw new Error(`RunPod job ${st.status}: ${JSON.stringify(st.error ?? "").slice(0, 200)}`);
      }
    }
    await fetch(`${base}/cancel/${jobId}`, { method: "POST", headers }).catch(() => {});
    throw new Error("RunPod job timed out");
  },
};

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env var ${name}`);
  return v.trim();
}

export function getProvider() {
  const name = process.env.GPU_PROVIDER ?? "mock";
  const p = { mock, http, runpod }[name];
  if (!p) throw new Error(`Unknown GPU_PROVIDER "${name}" (use mock, http or runpod)`);
  return p;
}
