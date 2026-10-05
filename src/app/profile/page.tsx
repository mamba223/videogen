"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cancelEpisode, getCredits, getUser, isDemo, listMine, setVisibility, signOut, type User, type Video } from "@/lib/data";
import SequencePlayer from "@/components/SequencePlayer";
import CreditsModal from "@/components/CreditsModal";

const active = (v: Video) => v.status === "queued" || v.status === "generating";

export default function Profile() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [open, setOpen] = useState<Video | null>(null);
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  const refresh = useCallback(async () => setVideos(await listMine()), []);
  useEffect(() => {
    refresh();
    getUser().then(setUser);
    getCredits().then(setCredits);
  }, [refresh]);

  // Keep progress live while anything is rendering on the worker
  const anyActive = videos.some(active);
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(() => { refresh(); window.dispatchEvent(new Event("credits-changed")); }, 3000);
    return () => clearInterval(t);
  }, [anyActive, refresh]);

  async function handleSignOut() {
    await signOut();
    setUser(null);
    setCredits(0);
    window.dispatchEvent(new Event("credits-changed"));
    refresh();
  }

  async function toggleVisibility(v: Video) {
    const next = v.visibility === "public" ? "private" : "public";
    await setVisibility(v.id, next);
    setOpen({ ...v, visibility: next });
    refresh();
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      {user ? (
        <div className="panel" style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--grad)",
                display: "grid",
                placeItems: "center",
                fontSize: "1.6rem",
                fontWeight: 800,
                color: "white",
              }}
            >
              {user.username[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <h1 style={{ fontSize: "1.6rem", margin: 0 }}>@{user.username}</h1>
              <p style={{ color: "var(--muted)", fontSize: ".85rem", margin: "2px 0 0" }}>
                {user.email} · <b style={{ color: "var(--accent-3)" }}>{credits ?? 0}</b> daily credits
              </p>
            </div>
          </div>

          <div className="row" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="chip active"
              style={{ fontSize: ".85rem" }}
              onClick={() => setShowCreditsModal(true)}
            >
              ⚡ Top Up Credits
            </button>
            <Link href={`/user/${user.username}`} className="chip" style={{ fontSize: ".85rem" }}>
              👁 Public Profile
            </Link>
            <button id="profile-signout" className="chip" style={{ fontSize: ".85rem", borderColor: "var(--accent-2)", color: "var(--accent-2)" }} onClick={handleSignOut}>
              🚪 Sign Out
            </button>
            {isDemo && (
              <Link href="/login" className="chip" style={{ fontSize: ".85rem" }}>
                🔄 Switch Account
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: 28, textAlign: "center", padding: "36px 20px" }}>
          <div style={{ fontSize: "2.4rem", marginBottom: 10 }}>👤</div>
          <h2 style={{ marginBottom: 6 }}>You are currently signed out</h2>
          <p style={{ color: "var(--muted)", maxWidth: 440, margin: "0 auto 20px", fontSize: ".95rem" }}>
            Sign in or create an account to view your private videos, track real-time generation progress, and manage your episodes.
          </p>
          <div className="row" style={{ justifyContent: "center", marginTop: 0 }}>
            <Link href="/login" className="btn">
              Log In / Sign Up
            </Link>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h2 style={{ fontSize: "1.2rem", margin: 0 }}>My Video Studio</h2>
        <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>
          {videos.length} videos{anyActive ? " · rendering in the background" : ""}
        </span>
      </div>
      {!videos.length && (
        <div className="empty">
          {user ? "No videos yet. Create your first quick clip or full series episode!" : "Please log in to see your creations."}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 14 }}>
        {videos.map((v) => (
          <button key={v.id} className="tile" disabled={v.status !== "ready"} onClick={() => setOpen(v)}>
            {v.clips[0] && v.status === "ready"
              ? <video src={v.clips[0]} muted loop playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />
              : <div className="asset-icon" style={{ height: "100%", flexDirection: "column", gap: 8, aspectRatio: "auto" }}>
                  {v.status === "failed" ? "⚠" : "⏳"}
                  {active(v) && (
                    <div style={{ width: "70%" }}>
                      <div className="progress" style={{ margin: 0 }}><div style={{ width: `${Math.max(v.progress ?? 0, 4)}%` }} /></div>
                      <small style={{ fontSize: ".75rem", color: "var(--muted)" }}>{v.status === "queued" ? "queued" : `${v.progress ?? 0}%`}</small>
                    </div>
                  )}
                  {v.status === "failed" && <small style={{ fontSize: ".75rem", color: "var(--muted)" }}>failed · refunded</small>}
                </div>}
            <span className="chip tile-badge" style={{ top: 8, left: 8 }}>{v.visibility === "public" ? "🌍" : "🔒"}</span>
            <span className="chip tile-badge" style={{ bottom: 8, left: 8 }}>
              {v.seriesId ? `Ep. ${v.episode} · ` : ""}{Math.round(((v.sceneCount ?? v.clips.length) * 5) / 60 * 10) / 10 >= 1
                ? `${Math.round(((v.sceneCount ?? v.clips.length) * 5) / 6) / 10}m` : `${(v.sceneCount ?? v.clips.length) * 5}s`}
            </span>
          </button>
        ))}
      </div>

      {open && (
        <div className="modal" onClick={() => setOpen(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="reel-card" style={{ height: "min(80vh, 700px)" }}>
              <SequencePlayer
                clips={open.clips}
                narrations={open.narrations}
                audioTrackUrl={open.audioTrackUrl}
                audioTrackTitle={open.audioTrackTitle}
                title={open.title || open.prompt.slice(0, 40)}
                controls
                showExport
                voiceId={open.voiceId}
              />
            </div>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="chip" onClick={() => toggleVisibility(open)}>
                {open.visibility === "public" ? "🌍 Public — make private" : "🔒 Private — publish"}
              </button>
              <button className="chip" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showCreditsModal && (
        <CreditsModal
          onClose={() => setShowCreditsModal(false)}
          onSuccess={() => {
            getCredits().then(setCredits);
          }}
        />
      )}
    </div>
  );
}

export { cancelEpisode };
