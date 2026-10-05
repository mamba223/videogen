"use client";
import { useEffect, useRef, useState } from "react";
import { stitchAndDownloadVideo } from "@/lib/stitcher";
import { VOICE_PRESETS } from "@/lib/voicePresets";

interface SequencePlayerProps {
  clips: string[];
  narrations?: string[];
  audioTrackUrl?: string;
  audioTrackTitle?: string;
  title?: string;
  controls?: boolean;
  onEnded?: () => void;
  showExport?: boolean;
  voiceId?: string;
}

/**
 * Plays an episode's clips back to back as one seamless video.
 * Includes synchronized voiceover narration (TTS), background music soundtrack,
 * live closed captions, segment progress bar, and 1-click full episode MP4 export.
 */
export default function SequencePlayer({
  clips,
  narrations = [],
  audioTrackUrl,
  audioTrackTitle,
  title = "reelforge-episode",
  controls = false,
  onEnded,
  showExport = false,
  voiceId,
}: SequencePlayerProps) {
  const [i, setI] = useState(0);
  const [voiceoverOn, setVoiceoverOn] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const single = clips.length === 1;
  const long = clips.length > 16;

  useEffect(() => {
    setI(0);
  }, [clips]);

  // Synchronized voiceover narration using SpeechSynthesis with audio ducking
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (voiceoverOn && narrations[i]) {
      if (audioRef.current) audioRef.current.volume = 0.2;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(narrations[i]);
      const preset = VOICE_PRESETS.find((v) => v.id === voiceId);
      if (preset) {
        utterance.pitch = preset.synthConfig.pitch;
        utterance.rate = preset.synthConfig.rate;
        utterance.lang = preset.synthConfig.lang;
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find(
          (v) => v.lang.startsWith(preset.synthConfig.lang.slice(0, 2)) && (
            (preset.id.includes("eleanor") && v.lang.includes("GB")) ||
            (preset.id.includes("james") && (v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("david"))) ||
            (preset.id.includes("aria") && (v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira")))
          )
        ) || voices.find((v) => v.lang.startsWith("en"));
        if (match) utterance.voice = match;
      } else {
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
      }
      utterance.onend = () => {
        if (audioRef.current) audioRef.current.volume = 0.6;
      };
      utterance.onerror = () => {
        if (audioRef.current) audioRef.current.volume = 0.6;
      };
      window.speechSynthesis.speak(utterance);
    } else {
      if (audioRef.current) audioRef.current.volume = 0.6;
      window.speechSynthesis.cancel();
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) audioRef.current.volume = 0.6;
    };
  }, [i, voiceoverOn, narrations]);

  function handleClipEnd() {
    if (single) return;
    if (i < clips.length - 1) {
      setI((prev) => prev + 1);
    } else {
      onEnded?.();
      setI(0); // loop back
    }
  }

  async function handleExport(e: React.MouseEvent) {
    e.stopPropagation();
    if (exporting || clips.length === 0) return;
    setExporting(true);
    setExportPct(0);
    try {
      await stitchAndDownloadVideo(clips, title, (pct) => setExportPct(pct));
    } catch (err) {
      console.error("Export failed:", err);
      alert("Could not export combined video. You can download individual clips directly.");
    } finally {
      setTimeout(() => {
        setExporting(false);
        setExportPct(0);
      }, 1000);
    }
  }

  const currentNarration = narrations[i];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <video
        ref={ref}
        src={clips[i]}
        muted
        playsInline
        autoPlay
        loop={single}
        controls={controls}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onEnded={handleClipEnd}
        onClick={(e) => {
          const el = e.currentTarget;
          if (el.paused) el.play();
          else el.pause();
        }}
      />

      {audioTrackUrl && (
        <audio
          ref={audioRef}
          src={audioTrackUrl}
          loop
          autoPlay
          muted={!musicOn}
          style={{ display: "none" }}
        />
      )}

      {/* Preload next clip for stutter-free scene transitions */}
      {!single && clips[i + 1] && (
        <video src={clips[i + 1]} preload="auto" muted style={{ display: "none" }} />
      )}

      {/* Progress Bars */}
      {!single && (
        long ? (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              right: 12,
              height: 3,
              borderRadius: 2,
              background: "hsl(0 0% 100% / .3)",
              zIndex: 3,
            }}
          >
            <div
              style={{
                width: `${((i + 1) / clips.length) * 100}%`,
                height: "100%",
                borderRadius: 2,
                background: "white",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              right: 12,
              display: "flex",
              gap: 4,
              zIndex: 3,
            }}
          >
            {clips.map((_, n) => (
              <div
                key={n}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: n <= i ? "white" : "hsl(0 0% 100% / .3)",
                  transition: "background .2s",
                }}
              />
            ))}
          </div>
        )
      )}

      {/* Top Action Overlay (Voiceover, Captions & Export) */}
      <div
        style={{
          position: "absolute",
          top: 24,
          right: 12,
          display: "flex",
          gap: 6,
          zIndex: 4,
        }}
      >
        {narrations.length > 0 && (
          <>
            <button
              type="button"
              className="chip"
              style={{
                padding: "4px 8px",
                fontSize: ".75rem",
                background: voiceoverOn ? "var(--grad)" : "hsl(255 30% 8% / .75)",
                color: voiceoverOn ? "white" : "var(--muted)",
                borderColor: voiceoverOn ? "transparent" : "var(--border)",
                backdropFilter: "blur(8px)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setVoiceoverOn((v) => !v);
              }}
              title={voiceoverOn ? "Mute Voiceover" : "Enable Voiceover"}
            >
              {voiceoverOn ? "🔊 Voice" : "🔇 Voice"}
            </button>

            <button
              type="button"
              className="chip"
              style={{
                padding: "4px 8px",
                fontSize: ".75rem",
                background: captionsOn ? "var(--grad)" : "hsl(255 30% 8% / .75)",
                color: captionsOn ? "white" : "var(--muted)",
                borderColor: captionsOn ? "transparent" : "var(--border)",
                backdropFilter: "blur(8px)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setCaptionsOn((c) => !c);
              }}
              title={captionsOn ? "Hide Captions" : "Show Captions"}
            >
              CC
            </button>
          </>
        )}

        {audioTrackUrl && (
          <button
            type="button"
            className="chip"
            style={{
              padding: "4px 8px",
              fontSize: ".75rem",
              background: musicOn ? "var(--grad)" : "hsl(255 30% 8% / .75)",
              color: musicOn ? "white" : "var(--muted)",
              borderColor: musicOn ? "transparent" : "var(--border)",
              backdropFilter: "blur(8px)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setMusicOn((m) => {
                const next = !m;
                if (audioRef.current) {
                  if (next) audioRef.current.play().catch(() => {});
                  else audioRef.current.pause();
                }
                return next;
              });
            }}
            title={musicOn ? "Mute Background Music" : "Play Background Music"}
          >
            {musicOn ? "🎵 Music" : "🔇 Music"}
          </button>
        )}

        {(showExport || controls) && (
          <button
            type="button"
            className="chip"
            style={{
              padding: "4px 8px",
              fontSize: ".75rem",
              background: exporting ? "var(--grad)" : "hsl(255 30% 8% / .75)",
              color: "white",
              borderColor: "var(--border)",
              backdropFilter: "blur(8px)",
            }}
            onClick={handleExport}
            disabled={exporting}
            title="Download full episode concatenated as a single MP4"
          >
            {exporting ? `⏳ ${exportPct}%` : "⬇ MP4"}
          </button>
        )}
      </div>

      {/* Modern Closed Captions / Subtitles Overlay */}
      {captionsOn && currentNarration && (
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 16,
            right: 16,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 4,
          }}
        >
          <div
            style={{
              background: "hsl(255 40% 4% / .85)",
              backdropFilter: "blur(12px)",
              padding: "8px 14px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              color: "white",
              fontSize: ".85rem",
              fontWeight: 600,
              textAlign: "center",
              lineHeight: 1.35,
              maxWidth: "92%",
              boxShadow: "0 8px 24px -4px hsl(0 0% 0% / .6)",
              animation: "fadeIn .2s ease-out",
            }}
          >
            &ldquo;{currentNarration}&rdquo;
          </div>
        </div>
      )}
    </div>
  );
}
