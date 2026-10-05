"use client";
import { useCallback, useEffect, useState } from "react";
import { getUser, listFeed, listSeries, toggleFollow, toggleLike, type Series, type User, type Video } from "@/lib/data";
import SequencePlayer from "@/components/SequencePlayer";
import CommentsDrawer from "@/components/CommentsDrawer";
import ReportModal from "@/components/ReportModal";
import Link from "next/link";

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [activeCommentsVideo, setActiveCommentsVideo] = useState<Video | null>(null);
  const [reportingVideo, setReportingVideo] = useState<Video | null>(null);

  const refresh = useCallback(async () => {
    setVideos(await listFeed());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
    listSeries().then(setSeries);
    getUser().then(setCurrentUser);
  }, [refresh]);

  async function like(v: Video) {
    try {
      await toggleLike(v);
      setVideos((prev) =>
        prev.map((item) =>
          item.id === v.id
            ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) }
            : item
        )
      );
    } catch {
      setError("Log in to like videos");
      setTimeout(() => setError(""), 2500);
    }
  }

  async function follow(v: Video) {
    if (!v.userId) return;
    if (!currentUser) {
      setError("Log in to follow creators");
      setTimeout(() => setError(""), 2500);
      return;
    }
    try {
      const isNowFollowing = await toggleFollow(v.userId);
      setVideos((prev) =>
        prev.map((item) =>
          item.userId === v.userId ? { ...item, isFollowingAuthor: isNowFollowing } : item
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not follow");
      setTimeout(() => setError(""), 2500);
    }
  }

  function handleCommentCountChange(count: number) {
    if (!activeCommentsVideo) return;
    setVideos((prev) =>
      prev.map((v) => (v.id === activeCommentsVideo.id ? { ...v, commentsCount: count } : v))
    );
  }

  if (loaded && !videos.length)
    return (
      <div className="empty">
        <h1>Nothing here yet</h1>
        <p style={{ marginTop: 8 }}>Be the first to post a public video — hit Create.</p>
      </div>
    );

  return (
    <div className="feed" id="feed">
      <h1 className="sr-only">ReelForge feed</h1>
      {error && <div className="toast">{error}</div>}

      {videos.map((v) => {
        const isMyVideo = currentUser?.username === v.author || (v.userId && currentUser?.id === v.userId);
        return (
          <section className="reel" key={v.id}>
            <div className="reel-card">
              <SequencePlayer
                clips={v.clips}
                narrations={v.narrations}
                audioTrackUrl={v.audioTrackUrl}
                title={v.title || v.prompt.slice(0, 40)}
                showExport
                voiceId={v.voiceId}
              />
              {v.title && <div className="reel-title">{v.title}</div>}

              <div className="reel-actions">
                <button
                  id={`like-${v.id}`}
                  className={`action-btn ${v.liked ? "on" : ""}`}
                  onClick={() => like(v)}
                >
                  <span className="ico">♥</span>
                  {v.likes}
                </button>
                <button
                  id={`comment-${v.id}`}
                  className="action-btn"
                  onClick={() => setActiveCommentsVideo(v)}
                >
                  <span className="ico">💬</span>
                  {v.commentsCount ?? 0}
                </button>
                <button
                  id={`report-${v.id}`}
                  className="action-btn"
                  onClick={() => setReportingVideo(v)}
                  title="Report inappropriate content"
                >
                  <span className="ico" style={{ fontSize: "1.1rem" }}>🚩</span>
                  <span style={{ fontSize: ".7rem", color: "var(--muted)" }}>Report</span>
                </button>
              </div>

              <div className="reel-overlay">
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  {v.author ? (
                    <Link href={`/user/${v.author}`} className="reel-author" style={{ textDecoration: "none" }}>
                      @{v.author}
                    </Link>
                  ) : (
                    <span className="reel-author">@you</span>
                  )}

                  {!isMyVideo && v.userId && (
                    <button
                      className={`follow-tag ${v.isFollowingAuthor ? "following" : ""}`}
                      onClick={() => follow(v)}
                    >
                      {v.isFollowingAuthor ? "✓ Following" : "+ Follow"}
                    </button>
                  )}

                  <span
                    className="model-pill"
                    title={v.model === "ltx-video" ? "Generated with LTX-Video Turbo (~12s)" : "Generated with Wan 2.1 Cinematic Flagship"}
                  >
                    {v.model === "ltx-video" ? "⚡ LTX Turbo" : "🌟 Wan 2.1"}
                  </span>
                </div>

                {v.seriesId && (
                  <Link href={`/series/${v.seriesId}`} className="series-badge" title="Watch full series" style={{ cursor: "pointer" }}>
                    📖 {series.find((s) => s.id === v.seriesId)?.title ?? "Series"} · Ep. {v.episode} ›
                  </Link>
                )}
                <p className="reel-prompt">{v.prompt}</p>
              </div>
            </div>
          </section>
        );
      })}

      {activeCommentsVideo && (
        <CommentsDrawer
          videoId={activeCommentsVideo.id}
          videoTitle={activeCommentsVideo.title || activeCommentsVideo.prompt.slice(0, 50)}
          onClose={() => setActiveCommentsVideo(null)}
          onCommentCountChange={handleCommentCountChange}
        />
      )}

      {reportingVideo && (
        <ReportModal
          videoId={reportingVideo.id}
          videoTitle={reportingVideo.title || reportingVideo.prompt.slice(0, 50)}
          onClose={() => setReportingVideo(null)}
        />
      )}
    </div>
  );
}
