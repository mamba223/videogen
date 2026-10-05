"use client";
import { useState } from "react";
import { getUser, isDemo, type User } from "@/lib/data";

interface CreditsModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const PACKS = [
  {
    id: "starter",
    name: "Creator Pack",
    credits: 50,
    price: "$9",
    tagline: "Great for quick videos & pilots",
    features: ["50 scene credits", "Fast GPU queue priority", "Full MP4 1080p exports"],
  },
  {
    id: "series",
    name: "Series Director",
    credits: 200,
    price: "$25",
    popular: true,
    tagline: "Full season creator pack",
    features: [
      "200 scene credits (~10 episodes)",
      "Story bible character consistency",
      "AI Shot List Decomposition",
      "Unlimited full exports",
    ],
  },
  {
    id: "studio",
    name: "Studio Unlimited",
    credits: 600,
    price: "$59",
    tagline: "For serious episodic writers",
    features: [
      "600 scene credits",
      "Ultra-low per-scene cost ($0.09/scene)",
      "Highest GPU queue priority",
      "Unlimited series & episodes",
    ],
  },
];

export default function CreditsModal({ onClose, onSuccess }: CreditsModalProps) {
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  async function handleBuy(packId: string, credits: number) {
    setLoadingPack(packId);
    setToast("");

    try {
      const user = await getUser();
      if (!user) {
        setToast("Please log in first to purchase credits.");
        setLoadingPack(null);
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, userId: user.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "Checkout failed");
        setLoadingPack(null);
        return;
      }

      if (data.url) {
        if (data.mock || isDemo) {
          // Dev / demo mode simulation: notify and refresh
          setToast(`🎉 Added ${credits} credits to your account!`);
          window.dispatchEvent(new Event("credits-changed"));
          onSuccess?.();
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          // Redirect to real Stripe Checkout URL
          window.location.href = data.url;
        }
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error initiating checkout");
    } finally {
      setLoadingPack(null);
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modal-card panel"
        style={{ maxWidth: 760, width: "100%", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <span className="series-badge" style={{ marginBottom: 6 }}>
              ⚡ Top-Up ReelForge Credits
            </span>
            <h2 style={{ fontSize: "1.8rem", margin: "4px 0" }}>Power Your Next Series</h2>
            <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
              Every scene generation costs 1 credit. Unfinished or failed scenes are always 100% refunded.
            </p>
          </div>
          <button type="button" className="link-btn" onClick={onClose} style={{ fontSize: "1.3rem" }}>
            ✕
          </button>
        </div>

        {toast && (
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              background: "var(--grad)",
              color: "white",
              fontWeight: 600,
              fontSize: ".9rem",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            {toast}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 12 }}>
          {PACKS.map((pack) => (
            <div
              key={pack.id}
              className="panel"
              style={{
                position: "relative",
                padding: "24px 20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                borderColor: pack.popular ? "var(--accent)" : "var(--border)",
                boxShadow: pack.popular ? "0 0 30px -10px var(--accent-2)" : "none",
                background: pack.popular ? "hsl(255 25% 13%)" : "var(--surface)",
              }}
            >
              {pack.popular && (
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 16,
                    padding: "3px 10px",
                    borderRadius: 99,
                    background: "var(--grad)",
                    color: "white",
                    fontSize: ".7rem",
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Most Popular
                </div>
              )}

              <div>
                <h3 style={{ fontSize: "1.2rem", margin: "0 0 4px" }}>{pack.name}</h3>
                <p style={{ color: "var(--muted)", fontSize: ".8rem", marginBottom: 16 }}>{pack.tagline}</p>

                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 16 }}>
                  <span style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text)" }}>{pack.price}</span>
                  <span style={{ color: "var(--accent-3)", fontWeight: 700, fontSize: ".95rem" }}>
                    / {pack.credits} credits
                  </span>
                </div>

                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: ".85rem", color: "hsl(260 20% 88%)", marginBottom: 24 }}>
                  {pack.features.map((f, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--accent-3)", fontSize: "1rem" }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                className={pack.popular ? "btn" : "chip active"}
                style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }}
                disabled={loadingPack !== null}
                onClick={() => handleBuy(pack.id, pack.credits)}
              >
                {loadingPack === pack.id ? "Processing…" : `Get ${pack.credits} Credits`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
