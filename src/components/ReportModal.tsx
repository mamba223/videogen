"use client";
import { useState } from "react";
import { reportVideo } from "@/lib/data";

interface ReportModalProps {
  videoId: string;
  videoTitle?: string;
  onClose: () => void;
}

const REPORT_REASONS = [
  { id: "nsfw", label: "🔞 Explicit / NSFW Content" },
  { id: "violence", label: "💥 Graphic Violence or Harm" },
  { id: "hate", label: "🚫 Harassment or Hate Speech" },
  { id: "copyright", label: "©️ Copyright or Impersonation" },
  { id: "spam", label: "📢 Spam, Scam or Misleading" },
  { id: "other", label: "⚠️ Other Issue" },
];

export default function ReportModal({ videoId, videoTitle, onClose }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0].id);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const reasonLabel = REPORT_REASONS.find((r) => r.id === selectedReason)?.label ?? selectedReason;
      const fullReason = notes.trim() ? `${reasonLabel} — Notes: ${notes.trim()}` : reasonLabel;
      await reportVideo(videoId, fullReason);
      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card panel" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🛡️</div>
            <h3 style={{ fontSize: "1.3rem", marginBottom: 8 }}>Report Received</h3>
            <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
              Thank you for keeping ReelForge safe. Our content moderation system and team will review this video.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.2rem", margin: 0 }}>🚩 Report Video</h3>
              <button type="button" className="link-btn" onClick={onClose} style={{ fontSize: "1.2rem", padding: "4px 8px" }}>
                ✕
              </button>
            </div>

            {videoTitle && (
              <p style={{ fontSize: ".85rem", color: "var(--muted)", marginBottom: 16 }}>
                Reporting: &ldquo;{videoTitle.slice(0, 60)}&rdquo;
              </p>
            )}

            <label className="field-label" style={{ marginTop: 0 }}>
              Why are you reporting this clip?
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: selectedReason === r.id ? "var(--surface-2)" : "var(--bg)",
                    border: `1px solid ${selectedReason === r.id ? "var(--accent)" : "var(--border)"}`,
                    cursor: "pointer",
                    fontSize: ".9rem",
                    transition: "all .2s",
                  }}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.id}
                    checked={selectedReason === r.id}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>

            <label className="field-label" htmlFor="report-notes">
              Additional context <small>(optional)</small>
            </label>
            <textarea
              id="report-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide any additional details to help our reviewers..."
              style={{ marginBottom: 16 }}
            />

            {error && <p style={{ color: "var(--accent-2)", fontSize: ".85rem", marginBottom: 12 }}>{error}</p>}

            <div className="row" style={{ justifyContent: "flex-end", marginTop: 0 }}>
              <button type="button" className="chip" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn"
                style={{ padding: "10px 20px", fontSize: ".9rem" }}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
