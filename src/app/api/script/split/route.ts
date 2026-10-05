export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SCENES = 120; // ~10 minutes at 5s per scene

interface SplitScene { prompt: string; narration: string }

interface LlmConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

function getLlmConfig(): LlmConfig | null {
  if (process.env.LLM_BASE_URL) {
    return {
      baseUrl: process.env.LLM_BASE_URL,
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL || "default",
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.LLM_MODEL || "llama-3.3-70b-versatile",
    };
  }
  if (process.env.OPENROUTER_API_KEY) {
    return {
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.LLM_MODEL || "qwen/qwen-2.5-72b-instruct",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      baseUrl: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.LLM_MODEL || "gpt-4o-mini",
    };
  }
  return null;
}

/** Fallback splitter used when no LLM is configured: groups sentences into ~one scene's worth of narration. */
function heuristicSplit(script: string, sceneSeconds: number): SplitScene[] {
  const wordsPerScene = Math.max(8, Math.round(sceneSeconds * 2.5));
  const sentences = script.replace(/\s+/g, " ").match(/[^.!?]+[.!?]*/g) ?? [script];
  const scenes: SplitScene[] = [];
  let cur: string[] = [], count = 0;
  const flush = () => { if (cur.length) { const t = cur.join(" ").trim(); scenes.push({ prompt: t, narration: t }); cur = []; count = 0; } };
  for (const s of sentences) {
    const n = s.trim().split(" ").length;
    if (count + n > wordsPerScene && cur.length) flush();
    cur.push(s.trim()); count += n;
  }
  flush();
  return scenes;
}

function parseJsonArray(content: string): SplitScene[] {
  const clean = content.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  const slice = clean.slice(start, end + 1);
  return (JSON.parse(slice) as SplitScene[]).filter((s) => s && typeof s.prompt === "string" && s.prompt.trim().length > 0);
}

async function llmSplit(chunk: string, bible: string, sceneSeconds: number, config: LlmConfig): Promise<SplitScene[]> {
  const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            `You turn story text into an AI video shot list. Each scene lasts about ${sceneSeconds} seconds. ` +
            `Return ONLY a raw JSON array of objects with keys "prompt" and "narration": [{"prompt": "...", "narration": "..."}]. ` +
            `"prompt" MUST be a detailed visual description of subject, action, lighting, and camera motion for text-to-video models. ` +
            `Ensure character appearances and visual style match the story bible. "narration" is the spoken line (optional). ` +
            `Story bible: ${bible || "None specified"}`
        },
        { role: "user", content: chunk },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM provider error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "[]";
  return parseJsonArray(content);
}

function chunkText(text: string, size = 5000): string[] {
  const paras = text.split(/\n{2,}/);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur.length + p.length > size && cur) { out.push(cur); cur = ""; }
    cur += p + "\n\n";
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export async function POST(req: Request) {
  const { script, bible = "", sceneSeconds = 5 } = await req.json();
  if (typeof script !== "string" || script.trim().length < 20) {
    return Response.json({ error: "Script is too short (min 20 characters)" }, { status: 400 });
  }

  const config = getLlmConfig();
  let scenes: SplitScene[] = [];
  let engine = "heuristic";

  if (config) {
    try {
      const chunks = chunkText(script.slice(0, 200_000));
      for (const c of chunks) {
        const batch = await llmSplit(c, bible, sceneSeconds, config);
        scenes.push(...batch);
      }
      if (scenes.length > 0) {
        engine = `llm (${config.model})`;
      } else {
        scenes = heuristicSplit(script, sceneSeconds);
      }
    } catch (e) {
      console.warn("LLM splitting failed, falling back to heuristic:", e);
      scenes = heuristicSplit(script, sceneSeconds);
    }
  } else {
    scenes = heuristicSplit(script, sceneSeconds);
  }

  const truncated = scenes.length > MAX_SCENES;
  return Response.json({
    scenes: scenes.slice(0, MAX_SCENES),
    truncated,
    engine,
  });
}
