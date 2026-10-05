export const runtime = "nodejs";

interface EnhanceRequest {
  prompt: string;
  style?: string;
  model?: string;
  camera?: string;
}

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

/** Rule-based cinematic prompt enhancer tailored to AI video generation models */
function ruleBasedEnhance(prompt: string, style?: string, model: string = "ltx-video", camera?: string): string {
  const p = prompt.trim().replace(/\.\s*$/, "");

  // Model-specific seasoning
  let modelKeywords = "";
  if (model.includes("wan")) {
    modelKeywords = "photorealistic skin texture, natural cloth physics, 16fps high-dynamic range, cinematic motion";
  } else if (model.includes("hunyuan")) {
    modelKeywords = "13B 3D DiT volumetric lighting, rich shadows, anamorphic lens flare, masterwork composition";
  } else if (model.includes("cogvideo")) {
    modelKeywords = "3D spatial coherence, fluid causal transitions, ultra-fine detailing, film grain";
  } else {
    modelKeywords = "smooth 24fps motion, crisp subject silhouette, vivid contrast, stable temporal consistency";
  }

  // Cinematic aesthetic tokens
  const aesthetic = [
    "cinematic lighting",
    "35mm anamorphic lens",
    "shallow depth of field",
    "subtle environmental dust motes",
    "atmospheric color grading",
  ];

  // If user prompt lacks lighting tokens, inject appropriate lighting
  const lightingKeywords = ["lighting", "dawn", "dusk", "neon", "sun", "shadow", "glow", "dark", "bright"];
  const hasLighting = lightingKeywords.some((k) => p.toLowerCase().includes(k));
  const lightingChoice = hasLighting
    ? "volumetric raytraced rim lighting"
    : "dramatic cinematic chiaroscuro lighting with soft golden hour edge highlights";

  const styleClause = style ? ` adhering to ${style}` : "";
  const cameraClause = camera && camera !== "none" ? ` [Camera: ${camera}]` : "";

  return `${p}, ${lightingChoice}, ${aesthetic.slice(0, 3).join(", ")}, ${modelKeywords}${styleClause}${cameraClause}`;
}

export async function POST(req: Request) {
  try {
    const { prompt, style, model = "wan-2.1", camera = "none" }: EnhanceRequest = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return Response.json({ error: "Prompt is too short to enhance." }, { status: 400 });
    }

    const llm = getLlmConfig();

    if (llm) {
      try {
        const systemPrompt = `You are a Hollywood visual director and AI video prompting master specializing in open-weights video models (${model}, LTX-Video, Wan 2.1, HunyuanVideo, CogVideoX).
Your task: Take a raw user scene idea and expand it into a single highly vivid, visual, cinematic prompt (1-3 sentences, 40-70 words).
Focus strictly on:
1. Concrete visual details (subject attire, textures, posture, facial expression).
2. Lighting (volumetric rays, rim lights, neon, reflections, shadows).
3. Atmospheric environment (particles, rain mist, dust motes, haze, architecture).
4. Physical movement and fluidity.
Do NOT output boilerplate, quotes, commentary, or markdown formatting. Output ONLY the raw enhanced prompt.`;

        const userMessage = `Original idea: "${prompt.trim()}"
${style ? `Visual style bible: "${style.trim()}"` : ""}
Target AI Model: ${model}
Camera Motion: ${camera}`;

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (llm.apiKey) headers.Authorization = `Bearer ${llm.apiKey}`;

        const res = await fetch(`${llm.baseUrl}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: llm.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            temperature: 0.7,
            max_tokens: 160,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const raw = data.choices?.[0]?.message?.content?.trim();
          if (raw && raw.length > 10) {
            const clean = raw.replace(/^["']|["']$/g, "").replace(/\n+/g, " ");
            return Response.json({
              enhancedPrompt: clean,
              engine: `llm (${llm.model})`,
            });
          }
        }
      } catch (e) {
        console.warn("[Enhance] LLM failed, using fallback:", e);
      }
    }

    // Deterministic fallback
    const enhanced = ruleBasedEnhance(prompt, style, model, camera);
    return Response.json({
      enhancedPrompt: enhanced,
      engine: "cinematic-rules",
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Enhancement failed" },
      { status: 500 }
    );
  }
}
