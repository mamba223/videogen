"use client";
import { useEffect, useState } from "react";
import { addComment, deleteComment, getUser, listComments, type Comment, type User } from "@/lib/data";
import Link from "next/link";

interface Props {
  videoId: string;
  videoTitle?: string;
  onClose: () => void;
  onCommentCountChange?: (count: number) => void;
}

export default function CommentsDrawer({ videoId, videoTitle, onClose, onCommentCountChange }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    getUser().then(setUser);
    listComments(videoId)
      .then((list) => {
        setComments(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [videoId]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || posting) return;
    setPosting(true);
    setErr("");
    try {
      const created = await addComment(videoId, text.trim());
      const updated = [...comments, created];
      setComments(updated);
      setText("");
      onCommentCountChange?.(updated.length);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to post comment");
    }
    setPosting(false);
  }

  async function remove(id: string) {
    try {
      await deleteComment(id);
      const updated = comments.filter((c) => c.id !== id);
      setComments(updated);
      onCommentCountChange?.(updated.length);
    } catch {}
  }

  const formatTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3>Comments</h3>
            {videoTitle && <small style={{ color: "var(--muted)" }}>{videoTitle}</small>}
          </div>
          <button className="link-btn" style={{ fontSize: "1.3rem", padding: "4px 8px" }} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="drawer-body">
          {loading ? (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: "32px 0" }}>Loading comments…</p>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px 16px" }}>
              <p style={{ fontSize: "1.8rem", marginBottom: 8 }}>💬</p>
              <p>No comments yet. Be the first to share your thoughts!</p>
            </div>
          ) : (
            <div className="comment-list">
              {comments.map((c) => (
                <div key={c.id} className="comment-item">
                  <div className="comment-header">
                    <Link href={`/user/${c.username}`} className="comment-author" onClick={onClose}>
                      @{c.username}
                    </Link>
                    <span className="comment-time">{formatTime(c.createdAt)}</span>
                    {user && (user.id === c.userId || user.username === c.username) && (
                      <button className="link-btn" style={{ marginLeft: "auto" }} onClick={() => remove(c.id)}>
                        delete
                      </button>
                    )}
                  </div>
                  <p className="comment-text">{c.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <form className="drawer-footer" onSubmit={post}>
          {err && <p style={{ color: "var(--accent-2)", fontSize: ".85rem", width: "100%", marginBottom: 6 }}>{err}</p>}
          <input
            id="comment-input"
            type="text"
            placeholder={user ? "Add a thoughtful comment…" : "Sign in to join the conversation…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!user || posting}
            maxLength={500}
            style={{ flex: 1, padding: "12px 16px" }}
          />
          <button id="comment-submit" className="btn" style={{ padding: "12px 20px" }} type="submit" disabled={!user || !text.trim() || posting}>
            {posting ? "…" : "Post"}
          </button>
        </form>
      </div>
    </div>
  );
}
