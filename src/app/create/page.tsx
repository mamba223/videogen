"use client";
import { useEffect, useState } from "react";
import {
  cancelEpisode, createSeries, enqueueEpisode, getEpisode, getUser, listAssets, listSeries, nextEpisode,
  type Asset, type SceneInput, type Series, type Video,
} from "@/lib/data";
import SequencePlayer from "@/components/SequencePlayer";
import CreditsModal from "@/components/CreditsModal";
import { AUDIO_PRESETS } from "@/lib/audioPresets";
import { VIDEO_ENGINES, VIDEO_MODELS, DEFAULT_ENGINE } from "@/lib/videoModels";
import { CAMERA_MOTIONS, applyCameraMotion } from "@/lib/cameraControls";
import { VOICE_PRESETS, auditionVoice, stopVoiceAudition, type VoicePreset } from "@/lib/voicePresets";
import { stitchAndDownloadVideo } from "@/lib/stitcher";
import Link from "next/link";

const MAX_SCENES = 120; // ~10 minutes
const POLL_MS = 2000;

export default function Create() {
  const [mode, setMode] = useState<"quick" | "story">("quick");

  // Quick mode state
  const [quickPrompt, setQuickPrompt] = useState("");
  const [quickCamera, setQuickCamera] = useState("none");

  // Story mode state
  const [title, setTitle] = useState("");
  const [scenes, setScenes] = useState<SceneInput[]>([
    { prompt: "", narration: "", durationSec: 5, cameraMotion: "none" },
  ]);
  const [script, setScript] = useState("");
  const [bible, setBible] = useState("");
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [episodeNums, setEpisodeNums] = useState<Record<string, number>>({});
  const [seriesId, setSeriesId] = useState("");
  const [newSeries, setNewSeries] = useState("");
  const [splitting, setSplitting] = useState(false);
  const [note, setNote] = useState("");

  // Enhancing state
  const [enhancingTarget, setEnhancingTarget] = useState<number | "quick" | null>(null);

  // Shared options state
  const [duration, setDuration] = useState<3 | 5 | 8>(5);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_ENGINE);
  const [selectedVoice, setSelectedVoice] = useState<string>("aria-ambient");
  const [auditioningVoice, setAuditioningVoice] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [refIds, setRefIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<Video | null>(null);
  const [jobId, setJobId] = useState("");
  const [msg, setMsg] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergePct, setMergePct] = useState(0);

  useEffect(() => {
    listSeries().then(async (list) => {
      setSeriesList(list);
      const nums: Record<string, number> = {};
      for (const s of list) nums[s.id] = await nextEpisode(s.id);
      setEpisodeNums(nums);
    });
  }, []);
  useEffect(() => { listAssets().then(setAssets); }, []);

  const scripts = assets.filter((a) => a.text);
  const images = assets.filter((a) => a.kind === "image");

  const isQuick = mode === "quick";
  const valid = isQuick
    ? quickPrompt.trim().length >= 3
    : scenes.every((s) => s.prompt.trim().length >= 3) && (seriesId !== "new" || newSeries.trim().length >= 2);

  const sceneCount = isQuick ? 1 : scenes.length;
  const totalSeconds = isQuick
    ? duration
    : scenes.reduce((acc, s) => acc + (s.durationSec || duration), 0);

  const busy = submitting || job?.status === "queued" || job?.status === "generating";
  const overall = job?.progress ?? 0;

  // Background worker polling
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let misses = 0;
    const tick = async () => {
      try {
        const v = await getEpisode(jobId);
        if (stop) return;
        if (!v) {
          if (++misses > 5) { setMsg("Could not find the video you just queued (check login / database policies)."); return; }
          setTimeout(tick, POLL_MS);
          return;
        }
        misses = 0;
        setJob(v);
        if (v.status === "ready" || v.status === "failed") {
          window.dispatchEvent(new Event("credits-changed"));
          return;
        }
      } catch (e) {
        if (stop) return;
        setMsg(`Could not load render status: ${e instanceof Error ? e.message : "unknown error"}`);
        return;
      }
      setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { stop = true; };
  }, [jobId]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  async function split() {
    setSplitting(true); setNote(""); setMsg("");
    const existing = seriesList.find((s) => s.id === seriesId);
    const res = await fetch("/api/script/split", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script, bible: [existing?.bible, bible].filter(Boolean).join(" "), sceneSeconds: duration }),
    });
    const data = await res.json();
    setSplitting(false);
    if (!res.ok) { setMsg(data.error ?? "Could not split script"); return; }
    setScenes(data.scenes.map((s: { prompt: string; narration: string }) => ({
      ...s,
      durationSec: duration,
      cameraMotion: "none",
    })));
    setNote(`${data.scenes.length} scenes (${data.engine?.startsWith("llm") ? `AI shot list · ${data.engine}` : "basic split — connect an LLM for richer shots"})` +
      (data.truncated ? ` · trimmed to ${MAX_SCENES} scenes (10 min max)` : ""));
  }

  async function enhancePrompt(target: "quick" | number) {
    const rawPrompt = target === "quick" ? quickPrompt : scenes[target]?.prompt;
    if (!rawPrompt || rawPrompt.trim().length < 3) return;

    setEnhancingTarget(target);
    try {
      const styleCombined = [
        seriesList.find((s) => s.id === seriesId)?.bible,
        bible
      ].filter(Boolean).join(" ");

      const cameraVal = target === "quick"
        ? quickCamera
        : scenes[target]?.cameraMotion || "none";

      const res = await fetch("/api/prompt/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: rawPrompt,
          style: styleCombined || undefined,
          model: selectedModel,
          camera: cameraVal,
        }),
      });

      const data = await res.json();
      if (data.enhancedPrompt) {
        if (target === "quick") {
          setQuickPrompt(data.enhancedPrompt);
        } else {
          updateScene(target, { prompt: data.enhancedPrompt });
        }
      }
    } catch (err) {
      console.error("Enhance failed", err);
    } finally {
      setEnhancingTarget(null);
    }
  }

  function moveScene(from: number, to: number) {
    if (to < 0 || to >= scenes.length) return;
    const next = [...scenes];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setScenes(next);
  }

  function duplicateScene(index: number) {
    const target = scenes[index];
    const clone = { ...target };
    const next = [...scenes];
    next.splice(index + 1, 0, clone);
    setScenes(next);
  }

  function removeScene(index: number) {
    if (scenes.length <= 1) return;
    setScenes(scenes.filter((_, i) => i !== index));
  }

  function toggleAudition(preset: VoicePreset) {
    if (auditioningVoice === preset.id) {
      stopVoiceAudition();
      setAuditioningVoice(null);
    } else {
      setSelectedVoice(preset.id);
      setAuditioningVoice(preset.id);
      auditionVoice(preset, () => {
        setAuditioningVoice(null);
      });
    }
  }

  async function generate() {
    setMsg(""); setJob(null); setJobId("");
    if (!(await getUser())) { setMsg("Please log in first."); return; }
    setSubmitting(true);
    try {
      let sid: string | undefined = undefined;
      let episode: number | undefined = undefined;
      let finalStyle: string | undefined = undefined;
      let finalScenes: SceneInput[] = [];
      let finalPrompt = "";

      if (isQuick) {
        const raw = quickPrompt.trim();
        finalPrompt = applyCameraMotion(raw, quickCamera, selectedModel);
        finalScenes = [{ prompt: finalPrompt, narration: "", cameraMotion: quickCamera, durationSec: duration }];
      } else {
        finalScenes = scenes.map((s) => {
          const dialogueAction = s.narration?.trim()
            ? `, character speaking aloud: "${s.narration.trim()}" with natural lip movement and expressive emotion`
            : "";
          const fullPrompt = applyCameraMotion(s.prompt + dialogueAction, s.cameraMotion || "none", selectedModel);
          return {
            ...s,
            prompt: fullPrompt,
            durationSec: s.durationSec || duration,
          };
        });
        finalPrompt = finalScenes[0]?.prompt || "";
        let seriesBible = seriesList.find((s) => s.id === seriesId)?.bible;
        if (seriesId === "new") {
          sid = await createSeries(newSeries.trim(), bible);
          seriesBible = bible;
          setSeriesId(sid);
          episode = 1;
        } else if (seriesId) {
          sid = seriesId;
          episode = await nextEpisode(sid);
        }
        const combined = [seriesBible, seriesId === "new" ? "" : bible].filter(Boolean).join(" ");
        if (combined) finalStyle = combined;
      }

      const id = await enqueueEpisode({
        title: isQuick ? undefined : title.trim() || undefined,
        prompt: finalPrompt,
        seriesId: sid,
        episode,
        visibility,
        scenes: finalScenes,
        style: finalStyle,
        referenceAssetIds: refIds,
        sceneSeconds: duration,
        audioTrackUrl: selectedTrack || undefined,
        audioTrackTitle: AUDIO_PRESETS.find((p) => p.url === selectedTrack)?.title,
        model: selectedModel,
        voiceId: selectedVoice,
      });

      window.dispatchEvent(new Event("credits-changed"));
      setJobId(id);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setMsg(m === "insufficient_credits" ? `Not enough credits: this needs ${sceneCount} credit${sceneCount > 1 ? "s" : ""}.` : m || "Something went wrong");
    }
    setSubmitting(false);
  }

  async function cancel() {
    if (!jobId) return;
    const n = await cancelEpisode(jobId);
    setMsg(`Cancelled ${n} queued scene${n === 1 ? "" : "s"} and refunded the credits. Scenes already rendering will finish.`);
    window.dispatchEvent(new Event("credits-changed"));
  }

  const updateScene = (n: number, patch: Partial<SceneInput>) =>
    setScenes(scenes.map((x, k) => (k === n ? { ...x, ...patch } : x)));

  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <div className="mode-tabs">
        <button
          id="mode-quick"
          className={`mode-tab ${isQuick ? "active" : ""}`}
          onClick={() => { setMode("quick"); setMsg(""); }}
        >
          ⚡ Quick Video
        </button>
        <button
          id="mode-story"
          className={`mode-tab ${!isQuick ? "active" : ""}`}
          onClick={() => { setMode("story"); setMsg(""); }}
        >
          📖 Storyboard &amp; Series Episode
        </button>
      </div>

      <h1>{isQuick ? "Create a video" : "Interactive Storyboard"}</h1>
      <p className="sub">
        {isQuick
          ? "Describe any scene in one sentence, pick a camera movement, and enhance to cinematic 4K."
          : "Craft episodes with precise scene sequencing, per-shot camera movement, and voiceover pacing."}
      </p>

      <div className="panel">
        {isQuick ? (
          /* ================= QUICK MODE ================= */
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label className="field-label" htmlFor="quick-prompt" style={{ margin: 0 }}>
                Describe your video
              </label>
              <button
                type="button"
                className={`enhance-btn ${enhancingTarget === "quick" ? "enhancing" : ""}`}
                disabled={enhancingTarget === "quick" || quickPrompt.trim().length < 3}
                onClick={() => enhancePrompt("quick")}
                title="Use AI to inject cinematic lighting, textures, and depth"
              >
                {enhancingTarget === "quick" ? "✨ Enhancing…" : "✨ AI Enhance"}
              </button>
            </div>
            <textarea
              id="quick-prompt"
              rows={4}
              maxLength={1000}
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              placeholder="A golden retriever wearing aviator goggles flying a biplane through fluffy clouds at sunset..."
            />

            {/* Quick Camera Motion Selector */}
            <div style={{ marginTop: 14 }}>
              <label className="field-label">
                Cinematic Camera Movement <small>(tailored to {VIDEO_ENGINES.find((m) => m.id === selectedModel)?.name})</small>
              </label>
              <div className="row" style={{ marginTop: 6, flexWrap: "wrap", gap: 6 }}>
                {CAMERA_MOTIONS.map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    className={`chip ${quickCamera === cam.id ? "active" : ""}`}
                    onClick={() => setQuickCamera(cam.id)}
                    title={cam.description}
                  >
                    {cam.icon} {cam.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ================= STORY / SERIES MODE ================= */
          <div>
            <label className="field-label" htmlFor="title">Episode title <small>(optional)</small></label>
            <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Spiral Chamber" />

            <label className="field-label">Series</label>
            <div className="row" style={{ marginTop: 0 }}>
              <select id="series" className="select" value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
                <option value="">Standalone video</option>
                <option value="new">＋ New series…</option>
                {seriesList.map((s) => <option key={s.id} value={s.id}>{s.title} (ep. {episodeNums[s.id] ?? 1})</option>)}
              </select>
              {seriesId === "new" && (
                <input id="series-title" type="text" placeholder="Series title" value={newSeries}
                  onChange={(e) => setNewSeries(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
              )}
            </div>

            <label className="field-label">Story bible <small>(characters, style, world lore kept consistent in every scene)</small></label>
            <textarea id="bible" rows={2} value={bible} onChange={(e) => setBible(e.target.value)}
              placeholder="Mara, a red-haired lighthouse keeper in a yellow raincoat. Moody atmospheric cinematic lighting." />

            <label className="field-label" htmlFor="script">Script <small>(paste screenplay or outline to auto-decompose into shot list)</small></label>
            {scripts.length > 0 && (
              <select id="load-script" className="select" style={{ marginBottom: 10 }} value=""
                onChange={(e) => { const a = scripts.find((x) => x.id === e.target.value); if (a?.text) setScript(a.text); }}>
                <option value="">Load from library…</option>
                {scripts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            <textarea id="script" rows={4} value={script} onChange={(e) => setScript(e.target.value)}
              placeholder="Paste your chapter, screenplay or outline here…" />
            <div className="row">
              <button id="split" className="chip active" disabled={splitting || script.trim().length < 20} onClick={split}>
                {splitting ? "Decomposing…" : "✂ Decompose Script into Shot List"}
              </button>
              {note && <small style={{ color: "var(--muted)" }}>{note}</small>}
            </div>

            {/* Storyboard Header Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>🎬 Storyboard Sequence</h3>
                <small style={{ color: "var(--muted)" }}>
                  {scenes.length} shot{scenes.length === 1 ? "" : "s"} · ~{fmt(totalSeconds)} total runtime
                </small>
              </div>
              <div className="shot-tools">
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => setScenes([...scenes, { prompt: "", narration: "", durationSec: duration, cameraMotion: "none" }])}
                  disabled={scenes.length >= MAX_SCENES}
                >
                  ＋ Add Shot
                </button>
              </div>
            </div>

            {/* Storyboard Shot Cards */}
            {scenes.map((s, n) => (
              <div key={n} className="storyboard-card">
                <div className="shot-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="shot-badge">Shot {n + 1}</span>
                    <button
                      type="button"
                      className={`enhance-btn ${enhancingTarget === n ? "enhancing" : ""}`}
                      disabled={enhancingTarget === n || s.prompt.trim().length < 3}
                      onClick={() => enhancePrompt(n)}
                      title="Enhance this shot with cinematic lighting and textures"
                    >
                      {enhancingTarget === n ? "✨ Enhancing…" : "✨ AI Enhance"}
                    </button>
                  </div>

                  <div className="shot-tools">
                    <button
                      type="button"
                      className="tool-btn"
                      disabled={n === 0}
                      onClick={() => moveScene(n, n - 1)}
                      title="Move shot earlier in sequence"
                    >
                      ↑ Up
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      disabled={n === scenes.length - 1}
                      onClick={() => moveScene(n, n + 1)}
                      title="Move shot later in sequence"
                    >
                      ↓ Down
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => duplicateScene(n)}
                      title="Duplicate this shot"
                    >
                      📑 Clone
                    </button>
                    {scenes.length > 1 && (
                      <button
                        type="button"
                        className="tool-btn danger"
                        onClick={() => removeScene(n)}
                        title="Remove shot"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="field-label" style={{ margin: "4px 0 6px" }}>Visual Direction</label>
                  <textarea
                    id={`scene-${n}`}
                    rows={2}
                    maxLength={1000}
                    value={s.prompt}
                    onChange={(e) => updateScene(n, { prompt: e.target.value })}
                    placeholder="Mara steps toward the edge of the lighthouse balcony as waves crash below..."
                  />
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  {/* Camera Motion */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label className="field-label" style={{ margin: "0 0 4px" }}>Camera Movement</label>
                    <select
                      className="select"
                      style={{ width: "100%", padding: "8px 12px", minWidth: 0, fontSize: ".85rem" }}
                      value={s.cameraMotion || "none"}
                      onChange={(e) => updateScene(n, { cameraMotion: e.target.value })}
                    >
                      {CAMERA_MOTIONS.map((cam) => (
                        <option key={cam.id} value={cam.id}>
                          {cam.icon} {cam.name} ({cam.tagline})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Shot Duration */}
                  <div>
                    <label className="field-label" style={{ margin: "0 0 4px" }}>Duration</label>
                    <div className="row" style={{ marginTop: 0, gap: 4 }}>
                      {([3, 5, 8] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`chip ${ (s.durationSec || duration) === d ? "active" : ""}`}
                          style={{ padding: "6px 12px", fontSize: ".8rem" }}
                          onClick={() => updateScene(n, { durationSec: d })}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Character dialogue text */}
                <div>
                  <label className="field-label" style={{ margin: "2px 0 4px" }}>
                    Character Dialogue <small>(what the character speaks in this scene)</small>
                  </label>
                  <input
                    type="text"
                    value={s.narration}
                    onChange={(e) => updateScene(n, { narration: e.target.value })}
                    placeholder='e.g. "We need to get out of here, now!"'
                    style={{ fontSize: ".88rem" }}
                  />
                </div>
              </div>
            ))}

            <div className="row" style={{ marginTop: 14 }}>
              <button
                id="add-scene"
                className="chip active"
                disabled={scenes.length >= MAX_SCENES}
                onClick={() => setScenes([...scenes, { prompt: "", narration: "", durationSec: duration, cameraMotion: "none" }])}
              >
                ＋ Add Scene Shot
              </button>
            </div>
          </div>
        )}

        {/* Reference images (available in both modes if images exist) */}
        {images.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <label className="field-label">Reference images <small>(from your <Link href="/library" style={{ textDecoration: "underline" }}>library</Link>)</small></label>
            <div className="row" style={{ marginTop: 0 }}>
              {images.map((a) => (
                <button key={a.id} className={`ref-thumb ${refIds.includes(a.id) ? "on" : ""}`} title={a.name}
                  onClick={() => setRefIds(refIds.includes(a.id) ? refIds.filter((x) => x !== a.id) : [...refIds, a.id])}>
                  <img src={a.url} alt={a.name} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Voice Selection Studio */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="field-label" style={{ margin: 0 }}>
              AI Narrator &amp; Voiceover Studio
            </label>
            <small style={{ color: "var(--muted)" }}>Click ▶ to audition voice</small>
          </div>

          <div className="voice-grid">
            {VOICE_PRESETS.map((v) => {
              const isSelected = selectedVoice === v.id;
              const isPlaying = auditioningVoice === v.id;
              return (
                <div
                  key={v.id}
                  className={`voice-card ${isSelected ? "active" : ""}`}
                  onClick={() => setSelectedVoice(v.id)}
                >
                  <div className="voice-info">
                    <span className="voice-avatar">{v.avatar}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="voice-title">
                        {v.name}
                        <span style={{ fontSize: ".68rem", color: "var(--accent-3)", fontWeight: 600 }}>
                          [{v.badge}]
                        </span>
                      </div>
                      <div className="voice-persona">{v.persona}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`audition-btn ${isPlaying ? "playing" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAudition(v);
                    }}
                    title={isPlaying ? "Stop audition" : "Audition voice sample"}
                  >
                    {isPlaying ? "⏹" : "▶"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Soundtrack & Ambient Mood */}
        <div style={{ marginTop: 22 }}>
          <label className="field-label">
            Soundtrack &amp; Atmosphere <small>(royalty-free background music)</small>
          </label>
          <div className="row" style={{ marginTop: 8, flexWrap: "wrap", gap: 6 }}>
            <button
              type="button"
              className={`chip ${!selectedTrack ? "active" : ""}`}
              onClick={() => setSelectedTrack("")}
            >
              🚫 None (Voice only)
            </button>
            {AUDIO_PRESETS.map((track) => (
              <button
                key={track.id}
                type="button"
                className={`chip ${selectedTrack === track.url ? "active" : ""}`}
                onClick={() => setSelectedTrack(selectedTrack === track.url ? "" : track.url)}
                title={track.mood}
              >
                {track.emoji} {track.title}
              </button>
            ))}
          </div>
        </div>

        {/* AI Video Generation Engine Mode: Speed vs Quality */}
        <div style={{ marginTop: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label className="field-label" style={{ margin: 0 }}>
              AI Generation Engine Mode
            </label>
            <small style={{ color: "var(--muted)" }}>Toggle between speed &amp; cinematic quality</small>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {VIDEO_ENGINES.map((engine) => {
              const active = selectedModel === engine.id;
              return (
                <div
                  key={engine.id}
                  onClick={() => setSelectedModel(engine.id)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: active ? "hsl(255 60% 18% / .3)" : "var(--surface)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    cursor: "pointer",
                    boxShadow: active ? "0 0 16px hsl(255 70% 50% / .15)" : "none",
                    transition: "all .2s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: ".95rem" }}>
                      <span>{engine.badge.split(" ")[0]}</span>
                      {engine.name}
                      <span style={{ fontSize: ".7rem", padding: "2px 8px", borderRadius: 99, background: active ? "var(--grad)" : "var(--surface-2)", color: "white" }}>
                        {engine.modeLabel}
                      </span>
                    </div>
                    <span style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--accent-3)" }}>
                      {engine.speed}
                    </span>
                  </div>

                  <p style={{ margin: "4px 0", fontSize: ".8rem", color: "var(--muted)", lineHeight: 1.35 }}>
                    {engine.tagline}
                  </p>

                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: ".75rem" }}>
                    <span style={{ color: "var(--muted)" }}>{engine.developer} · {engine.fps} FPS</span>
                    <span style={{ color: active ? "var(--accent-2)" : "var(--muted)", fontWeight: 600 }}>
                      {active ? "✓ Active Mode" : "Click to select"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Duration & Visibility Row */}
        <div className="row" style={{ marginTop: 22 }}>
          {([3, 5, 8] as const).map((d) => (
            <button key={d} className={`chip ${duration === d ? "active" : ""}`} onClick={() => setDuration(d)}>
              Default {d}s {isQuick ? "clip" : "/ shot"}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          {(["public", "private"] as const).map((v) => (
            <button key={v} id={`vis-${v}`} className={`chip ${visibility === v ? "active" : ""}`} onClick={() => setVisibility(v)}>
              {v === "public" ? "🌍 Public" : "🔒 Private"}
            </button>
          ))}
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <small style={{ color: "var(--muted)" }}>
            {isQuick ? `${duration}s video · 1 credit` : `~${fmt(totalSeconds)} episode (${sceneCount} shots) · ${sceneCount} credits`}
          </small>
        </div>

        {/* Action Button */}
        <div className="row" style={{ marginTop: 14 }}>
          <button id="generate" className="btn" disabled={busy || !valid} onClick={generate}>
            {submitting ? "Queuing…" : busy ? `Rendering… ${overall}%` : isQuick ? "✨ Generate clip (1 credit)" : `✨ Generate Episode (${sceneCount} credit${sceneCount === 1 ? "" : "s"})`}
          </button>
          {job && (job.status === "queued" || job.status === "generating") && (
            <button id="cancel" className="chip" onClick={cancel}>Cancel remaining</button>
          )}
        </div>

        {msg && (
          <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
            <p style={{ color: "var(--accent-2)", margin: 0 }}>{msg}</p>
            {msg.includes("credits") && (
              <button
                type="button"
                className="chip active"
                style={{ fontSize: ".8rem", padding: "4px 10px" }}
                onClick={() => setShowCreditsModal(true)}
              >
                ⚡ Get Credits
              </button>
            )}
          </div>
        )}

        {/* Progress Display */}
        {job && (job.status === "queued" || job.status === "generating") && (
          <div style={{ marginTop: 16 }}>
            <div className="progress"><div style={{ width: `${Math.max(overall, 3)}%` }} /></div>
            <small style={{ color: "var(--muted)" }}>
              {job.status === "queued" ? "Waiting for a free GPU…" : `Rendering (${overall}% done)…`}{" "}
              You can safely close this tab: rendering continues on our servers. Track it in your <Link href="/profile" style={{ textDecoration: "underline" }}>profile</Link>.
            </small>
          </div>
        )}

        {/* Failure Message */}
        {job?.status === "failed" && (
          <p style={{ marginTop: 16, color: "var(--accent-2)" }}>
            {job.error ?? "Rendering failed."} Credits for failed scenes were refunded.
          </p>
        )}

        {job?.status === "ready" && job.clips.length === 0 && (
          <p style={{ marginTop: 16, color: "var(--accent-2)" }}>
            Render finished but no clip URLs were saved. Check the worker logs and the Supabase `clips` bucket.
          </p>
        )}

        {/* Ready Result Video Player */}
        {job?.status === "ready" && job.clips.length > 0 && (
          <div className="result">
            <p style={{ marginTop: 16, color: "var(--accent-3)" }}>
              ✓ {job.visibility === "public" ? "Published to the feed" : "Saved privately to your profile"}
            </p>
            <div style={{ position: "relative", maxWidth: 320, marginTop: 12 }}>
              <SequencePlayer
                clips={job.clips}
                narrations={isQuick ? undefined : scenes.map((s) => s.narration).filter(Boolean)}
                audioTrackUrl={selectedTrack || undefined}
                controls
                showExport
              />
            </div>

            {job.clips.length > 1 && (
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ width: "100%", maxWidth: 320, padding: "10px 16px", fontSize: ".9rem" }}
                  disabled={merging}
                  onClick={async () => {
                    setMerging(true);
                    setMergePct(0);
                    try {
                      await stitchAndDownloadVideo(job.clips, job.title || "story-episode", (pct) => setMergePct(pct));
                    } catch (err) {
                      console.error("Merge error:", err);
                      alert("Could not merge clips. You can download individual clips directly.");
                    } finally {
                      setMerging(false);
                      setMergePct(0);
                    }
                  }}
                >
                  {merging ? `⏳ Merging All Scenes (${mergePct}%)…` : `🎬 Merge & Download Full Story (${job.clips.length} Scenes .MP4)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreditsModal && (
        <CreditsModal onClose={() => setShowCreditsModal(false)} />
      )}
    </div>
  );
}
