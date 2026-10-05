"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getSeriesDetail, toggleFollow, getUser, type SeriesDetail, type User, type Video } from "@/lib/data";
import SequencePlayer from "@/components/SequencePlayer";

export default function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentEpIndex, setCurrentEpIndex] = useState(0);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  useEffect(() => {
    getUser().then(setCurrentUser);
    getSeriesDetail(id).then((s) => {
      setSeries(s);
      setLoading(false);
    });
  }, [id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function handleFollow() {
    if (!series?.creatorId) return;
    if (!currentUser) {
      showToast("Log in to follow creators");
      return;
    }
    try {
      const isNowFollowing = await toggleFollow(series.creatorId);
      showToast(isNowFollowing ? "Following creator" : "Unfollowed");
    } catch {
      showToast("Error updating follow");
    }
  }

  function handleShare() {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href);
      showToast("Series link copied to clipboard!");
    }
  }

  if (loading) {
    return (
      <div className="page" style={{ maxWidth: 900, textAlign: "center", padding: "100px 20px" }}>
        <p style={{ color: "var(--muted)" }}>Loading series…</p>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="page" style={{ maxWidth: 900, textAlign: "center", padding: "80px 20px" }}>
        <h1>Series Not Found</h1>
        <p style={{ color: "var(--muted)", margin: "16px 0 24px" }}>
          This series may be private or has been removed.
        </p>
        <Link href="/" className="btn">
          Back to For You
        </Link>
      </div>
    );
  }

  const currentEp: Video | undefined = series.episodes[currentEpIndex];
  const totalSeconds = series.episodes.reduce((acc, ep) => acc + (ep.sceneCount ?? ep.clips.length) * 5, 0);

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      {toast && <div className="toast">{toast}</div>}

      <div style={{ marginBottom: 20 }}>
        <Link href="/" className="link-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          ‹ Back to Feed
        </Link>
      </div>

      {/* Series Hero Header */}
      <div className="panel" style={{ marginBottom: 28, position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span className="series-badge" style={{ marginBottom: 10 }}>
              📖 Episodic Series
            </span>
            <h1 style={{ fontSize: "2.2rem", margin: "4px 0 8px" }}>{series.title}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: ".9rem" }}>
              {series.creatorUsername && (
                <Link
                  href={`/user/${series.creatorUsername}`}
                  style={{ color: "var(--accent)", fontWeight: 700 }}
                >
                  @{series.creatorUsername}
                </Link>
              )}
              {series.creatorId && currentUser?.id !== series.creatorId && (
                <button className="follow-tag" onClick={handleFollow}>
                  + Follow Creator
                </button>
              )}
              <span style={{ color: "var(--muted)" }}>·</span>
              <span style={{ color: "var(--muted)" }}>{series.episodes.length} Episodes</span>
              <span style={{ color: "var(--muted)" }}>·</span>
              <span style={{ color: "var(--muted)" }}>
                {Math.round(totalSeconds / 60 * 10) / 10 >= 1
                  ? `${Math.round(totalSeconds / 6) / 10}m total runtime`
                  : `${totalSeconds}s runtime`}
              </span>
            </div>
          </div>

          <div className="row" style={{ marginTop: 0 }}>
            <button className="chip" onClick={handleShare} title="Copy link to series">
              🔗 Share Series
            </button>
          </div>
        </div>

        {series.bible && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
              color: "hsl(260 20% 88%)",
              fontSize: ".95rem",
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            &ldquo;{series.bible}&rdquo;
          </div>
        )}
      </div>

      {/* Main Binge Player Layout */}
      {currentEp ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 36 }}>
          {/* Active Episode Video Card */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div className="reel-card" style={{ width: "100%", maxWidth: 360, height: "min(70vh, 620px)" }}>
              <SequencePlayer
                clips={currentEp.clips}
                narrations={currentEp.narrations}
                audioTrackUrl={currentEp.audioTrackUrl}
                title={currentEp.title || `${series.title} - Episode ${currentEp.episode ?? currentEpIndex + 1}`}
                controls
                showExport
                voiceId={currentEp.voiceId}
                onEnded={() => {
                  if (autoPlayNext && currentEpIndex < series.episodes.length - 1) {
                    setCurrentEpIndex((prev) => prev + 1);
                    showToast(`Playing Episode ${series.episodes[currentEpIndex + 1]?.episode ?? currentEpIndex + 2}…`);
                  }
                }}
              />
            </div>
          </div>

          {/* Episode Info & Controls */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span className="chip active" style={{ fontSize: ".8rem" }}>
                  Episode {currentEp.episode ?? currentEpIndex + 1} of {series.episodes.length}
                </span>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".85rem", color: "var(--muted)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autoPlayNext}
                    onChange={(e) => setAutoPlayNext(e.target.checked)}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  Auto-play next
                </label>
              </div>

              <h2 style={{ fontSize: "1.4rem", margin: "12px 0 8px" }}>
                {currentEp.title || `Episode ${currentEp.episode ?? currentEpIndex + 1}`}
              </h2>
              <p style={{ color: "hsl(260 20% 85%)", fontSize: ".95rem", lineHeight: 1.5 }}>
                {currentEp.prompt}
              </p>

              {currentEp.narrations && currentEp.narrations.length > 0 && (
                <div style={{ marginTop: 16, background: "var(--bg)", padding: 12, borderRadius: 12, border: "1px solid var(--border)" }}>
                  <small style={{ color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: ".7rem" }}>
                    Episode Dialogue / Voiceover
                  </small>
                  <p style={{ marginTop: 6, fontSize: ".9rem", color: "var(--text)", lineHeight: 1.4 }}>
                    {currentEp.narrations.join(" ")}
                  </p>
                </div>
              )}
            </div>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div className="row" style={{ marginTop: 0, justifyContent: "space-between" }}>
                <button
                  className="chip"
                  disabled={currentEpIndex === 0}
                  onClick={() => setCurrentEpIndex((prev) => Math.max(0, prev - 1))}
                >
                  ‹ Previous
                </button>
                <span style={{ fontSize: ".85rem", color: "var(--muted)" }}>
                  {currentEpIndex + 1} / {series.episodes.length}
                </span>
                <button
                  className="chip"
                  disabled={currentEpIndex >= series.episodes.length - 1}
                  onClick={() => setCurrentEpIndex((prev) => Math.min(series.episodes.length - 1, prev + 1))}
                >
                  Next ›
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty">No published episodes in this series yet.</div>
      )}

      {/* Episode Playlist Drawer / List */}
      <h2 style={{ fontSize: "1.3rem", margin: "0 0 16px" }}>All Episodes ({series.episodes.length})</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {series.episodes.map((ep, idx) => {
          const isSelected = idx === currentEpIndex;
          return (
            <button
              key={ep.id}
              className="tile"
              style={{
                borderColor: isSelected ? "var(--accent)" : "var(--border)",
                boxShadow: isSelected ? "0 0 0 2px var(--accent)" : "none",
              }}
              onClick={() => setCurrentEpIndex(idx)}
            >
              {ep.clips[0] ? (
                <video
                  src={ep.clips[0]}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onMouseEnter={(e) => e.currentTarget.play()}
                  onMouseLeave={(e) => e.currentTarget.pause()}
                />
              ) : (
                <div className="asset-icon" style={{ height: "100%" }}>🎬</div>
              )}
              <span className="chip tile-badge" style={{ top: 8, left: 8 }}>
                Ep. {ep.episode ?? idx + 1}
              </span>
              <span className="chip tile-badge" style={{ bottom: 8, left: 8 }}>
                {(ep.sceneCount ?? ep.clips.length) * 5}s
              </span>
              {isSelected && (
                <span
                  className="chip tile-badge"
                  style={{ top: 8, right: 8, background: "var(--grad)", color: "white" }}
                >
                  ▶ Playing
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
