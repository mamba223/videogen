"use client";
import { use, useEffect, useState } from "react";
import { getCreatorProfile, getUser, toggleFollow, type CreatorProfile, type User, type Video } from "@/lib/data";
import SequencePlayer from "@/components/SequencePlayer";
import Link from "next/link";

export default function CreatorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"videos" | "series">("videos");
  const [openVideo, setOpenVideo] = useState<Video | null>(null);
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getUser().then(setCurrentUser);
    getCreatorProfile(username)
      .then((p) => {
        setProfile(p);
        if (p) {
          setFollowing(p.isFollowing);
          setFollowersCount(p.followersCount);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [username]);

  async function handleFollow() {
    if (!profile) return;
    if (!currentUser) {
      setMsg("Please log in to follow creators");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    setFollowBusy(true);
    try {
      const isNowFollowing = await toggleFollow(profile.id);
      setFollowing(isNowFollowing);
      setFollowersCount((prev) => prev + (isNowFollowing ? 1 : -1));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not follow");
      setTimeout(() => setMsg(""), 3000);
    }
    setFollowBusy(false);
  }

  if (loading) {
    return (
      <div className="page" style={{ textAlign: "center", padding: "80px 20px" }}>
        <p style={{ color: "var(--muted)" }}>Loading creator profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page" style={{ textAlign: "center", padding: "80px 20px" }}>
        <h1>Creator not found</h1>
        <p className="sub">@{username} does not exist or has not created a public profile yet.</p>
        <Link href="/" className="btn" style={{ display: "inline-block", marginTop: 16 }}>
          Back to Feed
        </Link>
      </div>
    );
  }

  const isMe = currentUser?.username === profile.username || currentUser?.id === profile.id;

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      {msg && <div className="toast">{msg}</div>}

      {/* Creator Header Card */}
      <div className="panel" style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "var(--grad)",
            display: "grid",
            placeItems: "center",
            fontSize: "2.4rem",
            fontWeight: 800,
            color: "white",
            flexShrink: 0,
          }}
        >
          {profile.displayName ? profile.displayName[0].toUpperCase() : profile.username[0].toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.8rem", margin: 0 }}>{profile.displayName || `@${profile.username}`}</h1>
            <span style={{ color: "var(--muted)", fontSize: "1.1rem" }}>@{profile.username}</span>
          </div>

          {profile.bio && <p style={{ marginTop: 8, color: "hsl(260 20% 85%)", lineHeight: 1.4 }}>{profile.bio}</p>}

          <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: ".95rem", color: "var(--muted)" }}>
            <span>
              <strong style={{ color: "var(--text)" }}>{followersCount}</strong> Followers
            </span>
            <span>
              <strong style={{ color: "var(--text)" }}>{profile.followingCount}</strong> Following
            </span>
            <span>
              <strong style={{ color: "var(--text)" }}>{profile.videos.length}</strong> Videos
            </span>
          </div>
        </div>

        <div>
          {!isMe && (
            <button
              id="follow-btn"
              className={following ? "chip active" : "btn"}
              style={{ minWidth: 120, justifyContent: "center" }}
              disabled={followBusy}
              onClick={handleFollow}
            >
              {following ? "✓ Following" : "+ Follow"}
            </button>
          )}
        </div>
      </div>

      {/* Profile Tabs */}
      <div className="row" style={{ marginTop: 24 }}>
        <button
          className={`chip ${activeTab === "videos" ? "active" : ""}`}
          onClick={() => setActiveTab("videos")}
        >
          🎥 Videos ({profile.videos.length})
        </button>
        <button
          className={`chip ${activeTab === "series" ? "active" : ""}`}
          onClick={() => setActiveTab("series")}
        >
          📖 Series ({profile.series.length})
        </button>
      </div>

      {/* Videos Tab */}
      {activeTab === "videos" && (
        <div style={{ marginTop: 16 }}>
          {profile.videos.length === 0 ? (
            <div className="empty">No public videos posted yet.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
              {profile.videos.map((v) => (
                <button key={v.id} className="tile" onClick={() => setOpenVideo(v)}>
                  {v.clips[0] ? (
                    <video
                      src={v.clips[0]}
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
                  {v.seriesId && (
                    <span className="chip tile-badge" style={{ bottom: 8, left: 8 }}>
                      Ep. {v.episode}
                    </span>
                  )}
                  <span className="chip tile-badge" style={{ top: 8, right: 8 }}>
                    ♥ {v.likes}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Series Tab */}
      {activeTab === "series" && (
        <div style={{ marginTop: 16 }}>
          {profile.series.length === 0 ? (
            <div className="empty">No series created yet.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
              {profile.series.map((s) => (
                <Link
                  key={s.id}
                  href={`/series/${s.id}`}
                  className="panel"
                  style={{
                    padding: 18,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "transform .2s, border-color .2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-3px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "none"; }}
                >
                  <div>
                    <h3 style={{ fontSize: "1.2rem", marginBottom: 6 }}>📖 {s.title}</h3>
                    {s.bible && (
                      <p style={{ color: "var(--muted)", fontSize: ".85rem", lineHeight: 1.4, marginBottom: 12 }}>
                        {s.bible}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                    <small style={{ color: "var(--accent-3)" }}>
                      By @{profile.username}
                    </small>
                    <span className="link-btn" style={{ fontWeight: 600 }}>Watch Series ›</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Video Modal Player */}
      {openVideo && (
        <div className="modal" onClick={() => setOpenVideo(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="reel-card" style={{ height: "min(80vh, 700px)" }}>
              <SequencePlayer clips={openVideo.clips} controls />
            </div>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="chip" onClick={() => setOpenVideo(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
