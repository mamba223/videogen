import { extractText } from "unpdf";
import mammoth from "mammoth";

export const runtime = "nodejs";
const MAX_BYTES = 15 * 1024 * 1024;

// Extracts plain text from uploaded PDF / DOCX / TXT / MD files so scripts can drive scene splitting.
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File too large (15MB max)" }, { status: 413 });
  const name = file.name.toLowerCase();
  try {
    let text = "";
    if (name.endsWith(".pdf")) {
      const res = await extractText(new Uint8Array(await file.arrayBuffer()), { mergePages: true });
      text = res.text;
    } else if (name.endsWith(".docx")) {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) })).value;
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      text = await file.text();
    } else {
      return Response.json({ error: "Unsupported file type" }, { status: 415 });
    }
    return Response.json({ text: text.slice(0, 500_000) });
  } catch {
    return Response.json({ error: "Could not read that file" }, { status: 422 });
  }
}
