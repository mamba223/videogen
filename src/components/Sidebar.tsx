"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCredits, getUser, isDemo, signOut, type User } from "@/lib/data";
import CreditsModal from "@/components/CreditsModal";

export default function Sidebar() {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  useEffect(() => {
    const refresh = () => {
      getUser().then(setUser);
      getCredits().then(setCredits);
    };
    refresh();
    window.addEventListener("credits-changed", refresh);
    return () => window.removeEventListener("credits-changed", refresh);
  }, []);

  async function handleSignOut() {
    await signOut();
    setUser(null);
    window.dispatchEvent(new Event("credits-changed"));
    location.href = "/login";
  }

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="logo">ReelForge</div>
      <Link id="nav-feed" className="nav-link" href="/">🔥 For You</Link>
      <Link id="nav-library" className="nav-link" href="/library">📚 Library</Link>
      <Link id="nav-profile" className="nav-link" href={user ? "/profile" : "/login"}>
        {user ? "👤 Profile" : "🔑 Sign In"}
      </Link>
      <Link id="nav-create" className="nav-link cta" href="/create">✨ Create</Link>

      <div className="credits">
        {user ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Daily credits</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <b>{credits ?? "–"}</b>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setShowCreditsModal(true)}
                  title="Top-up credits"
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "var(--grad)",
                    color: "white",
                    fontSize: ".75rem",
                    fontWeight: 800,
                  }}
                >
                  +
                </button>
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: ".85rem" }}>
              <Link href={`/user/${user.username}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
                @{user.username}
              </Link>
              <button className="link-btn" onClick={handleSignOut} title="Sign out of this account">
                Sign out
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: ".85rem", marginBottom: 8 }}>Sign in to create &amp; like</p>
            <Link href="/login" className="btn" style={{ padding: "8px 16px", fontSize: ".85rem", display: "inline-block" }}>
              Log in / Sign up
            </Link>
          </div>
        )}

        {isDemo && (
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: ".7rem", color: "var(--muted)" }}>
            ⚡ Dev demo mode (<Link href="/login" style={{ textDecoration: "underline" }}>switch user</Link>)
          </div>
        )}
      </div>

      {showCreditsModal && (
        <CreditsModal
          onClose={() => setShowCreditsModal(false)}
          onSuccess={() => {
            getCredits().then(setCredits);
          }}
        />
      )}
    </nav>
  );
}
