import { getGenerator } from "@/lib/generator";

// Streams generation progress as server-sent events.
export async function POST(req: Request) {
  const { prompt, durationSec = 5, quality = "fast", references = [] } = await req.json();
  if (typeof prompt !== "string" || prompt.trim().length < 3 || prompt.length > 1000) {
    return new Response("Invalid prompt", { status: 400 });
  }
  const gen = getGenerator();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of gen.generate({ prompt, durationSec, quality, references })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        }
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error" })}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
