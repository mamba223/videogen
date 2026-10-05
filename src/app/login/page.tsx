"use client";
import { useEffect, useState } from "react";
import { getUser, isCloud, isDemo, signIn, signOut, signUp, type User } from "@/lib/data";
import Link from "next/link";

export default function Login() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getUser().then(setCurrentUser);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setMsg("");
    try {
      const err = await (mode === "in" ? signIn(email.trim(), password) : signUp(email.trim(), password));
      if (err) {
        setMsg(err);
      } else {
        if (mode === "up" && isCloud) {
          setMsg("Account created! Check your email to confirm, then log in.");
        } else {
          window.dispatchEvent(new Event("credits-changed"));
          location.href = "/";
        }
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Authentication failed");
    }
    setLoading(false);
  }

  async function handleQuickLogin(username: string) {
    setLoading(true);
    await signIn(username, "password");
    window.dispatchEvent(new Event("credits-changed"));
    location.href = "/";
  }

  async function handleSignOut() {
    await signOut();
    setCurrentUser(null);
    window.dispatchEvent(new Event("credits-changed"));
    setMsg("You have signed out.");
  }

  return (
    <div className="page" style={{ maxWidth: 480 }}>
      {currentUser ? (
        <div className="panel" style={{ textAlign: "center", padding: "40px 24px" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "var(--grad)",
              display: "grid",
              placeItems: "center",
              fontSize: "2rem",
              fontWeight: 800,
              color: "white",
              margin: "0 auto 16px",
            }}
          >
            {currentUser.username[0].toUpperCase()}
          </div>
          <h2>Signed in as @{currentUser.username}</h2>
          <p style={{ color: "var(--muted)", margin: "8px 0 24px" }}>{currentUser.email}</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link href={`/user/${currentUser.username}`} className="btn">
              View Your Profile
            </Link>
            <button className="chip" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
          {isDemo && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: ".85rem", color: "var(--muted)", marginBottom: 10 }}>
                <strong>Demo Mode:</strong> Switch to another creator:
              </p>
              <div className="row" style={{ justifyContent: "center", marginTop: 0 }}>
                {["mara_writer", "neo_cinema", "writer_alex"]
                  .filter((u) => u !== currentUser.username)
                  .map((u) => (
                    <button key={u} type="button" className="chip" onClick={() => handleQuickLogin(u)}>
                      👤 @{u}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <h1>{mode === "in" ? "Welcome back" : "Join ReelForge"}</h1>
          <p className="sub">Sign in to generate videos, follow creators, and share your stories.</p>

          <form className="panel" onSubmit={submit}>
            <label className="field-label" htmlFor="email">
              {isDemo ? "Username or Email" : "Email"}
            </label>
            <input
              id="email"
              type={isDemo ? "text" : "email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isDemo ? "e.g. mara_writer or your_name" : "you@example.com"}
              autoComplete="email"
              required
            />

            <label className="field-label" htmlFor="password">
              Password {isDemo && <small>(optional in demo mode)</small>}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              style={{
                width: "100%",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: 14,
                padding: 16,
                font: "inherit",
              }}
            />

            <div className="row" style={{ marginTop: 20 }}>
              <button id="auth-submit" className="btn" type="submit" disabled={loading}>
                {loading ? "…" : mode === "in" ? "Log in" : "Sign up"}
              </button>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setMode(mode === "in" ? "up" : "in");
                  setMsg("");
                }}
              >
                {mode === "in" ? "Need an account? Sign up" : "Already have an account? Log in"}
              </button>
            </div>

            {msg && <p style={{ marginTop: 14, color: "var(--accent-2)" }}>{msg}</p>}

            {isDemo && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
                <p style={{ fontSize: ".85rem", color: "var(--muted)", marginBottom: 12 }}>
                  <strong>Demo Mode Quick Switch:</strong> Test multiple creator perspectives:
                </p>
                <div className="row" style={{ marginTop: 0 }}>
                  <button type="button" className="chip" onClick={() => handleQuickLogin("mara_writer")}>
                    👤 @mara_writer
                  </button>
                  <button type="button" className="chip" onClick={() => handleQuickLogin("neo_cinema")}>
                    👤 @neo_cinema
                  </button>
                  <button type="button" className="chip" onClick={() => handleQuickLogin("writer_alex")}>
                    👤 @writer_alex
                  </button>
                </div>
              </div>
            )}
          </form>
        </>
      )}
    </div>
  );
}
