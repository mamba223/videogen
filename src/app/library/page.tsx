"use client";
import { useCallback, useEffect, useState } from "react";
import { addAsset, deleteAsset, listAssets, listSeries, type Asset, type AssetKind, type Series } from "@/lib/data";

export function kindFor(file: File): AssetKind | null {
  const n = file.name.toLowerCase();
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (n.endsWith(".pdf") || n.endsWith(".docx")) return "document";
  if (n.endsWith(".txt") || n.endsWith(".md")) return "script";
  return null;
}

async function extract(file: File): Promise<string | undefined> {
  const k = kindFor(file);
  if (k !== "document" && k !== "script") return undefined;
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/extract", { method: "POST", body: fd });
  if (!res.ok) throw new Error((await res.json()).error ?? "Could not read file");
  return (await res.json()).text;
}

const ICON: Record<AssetKind, string> = { script: "📝", document: "📄", image: "🖼️", audio: "🎵" };

export default function Library() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [filter, setFilter] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async () => setAssets(await listAssets(filter || undefined)), [filter]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { listSeries().then(setSeries); }, []);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setBusy(true); setMsg("");
    for (const f of Array.from(files)) {
      const kind = kindFor(f);
      if (!kind) { setMsg(`${f.name}: unsupported type`); continue; }
      try { await addAsset(f, kind, target || undefined, await extract(f)); }
      catch (e) { setMsg(`${f.name}: ${e instanceof Error ? e.message : "upload failed"}`); }
    }
    setBusy(false);
    refresh();
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <h1>Story library</h1>
      <p className="sub">Upload scripts, documents, character art, locations and audio. Use them when creating episodes.</p>
      <div className="panel">
        <div className="row" style={{ marginTop: 0 }}>
          <select id="asset-series" className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">No series (general library)</option>
            {series.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <label className="btn" style={{ cursor: "pointer" }}>
            {busy ? "Uploading…" : "⬆ Upload files"}
            <input id="asset-upload" type="file" multiple hidden disabled={busy}
              accept=".txt,.md,.pdf,.docx,image/png,image/jpeg,image/webp,audio/*"
              onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        <small style={{ color: "var(--muted)", display: "block", marginTop: 10 }}>
          Scripts: TXT, MD, PDF, DOCX · Images: PNG, JPG, WebP · Audio: MP3, WAV, etc.
        </small>
        {msg && <p style={{ marginTop: 10, color: "var(--accent-2)" }}>{msg}</p>}
      </div>

      <div className="row">
        <button className={`chip ${filter === "" ? "active" : ""}`} onClick={() => setFilter("")}>All</button>
        {series.map((s) => (
          <button key={s.id} className={`chip ${filter === s.id ? "active" : ""}`} onClick={() => setFilter(s.id)}>{s.title}</button>
        ))}
      </div>

      {!assets.length && <div className="empty">Nothing uploaded yet.</div>}
      <div className="asset-grid">
        {assets.map((a) => (
          <div className="asset-card" key={a.id}>
            {a.kind === "image" ? <img src={a.url} alt={a.name} /> : <div className="asset-icon">{ICON[a.kind]}</div>}
            <div className="asset-meta">
              <span title={a.name}>{a.name}</span>
              <small>{a.kind}{a.text ? ` · ${a.text.split(/\s+/).length.toLocaleString()} words` : ""}</small>
            </div>
            {a.kind === "audio" && <audio src={a.url} controls style={{ width: "100%" }} />}
            <button className="link-btn" onClick={async () => { await deleteAsset(a.id); refresh(); }}>delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
