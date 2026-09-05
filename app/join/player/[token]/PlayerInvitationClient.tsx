"use client";
import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { BRAND_ASSETS } from "../../../lib/branding";

export default function PlayerInvitationClient({ token }: { token: string }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState("");
  const [account, setAccount] = useState<string | null>(null),
    [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    // Missing local auth configuration must not crash the invitation screen.
    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        const db = createClient();
        void db.auth
          .getUser()
          .then(({ data }) => {
            if (!cancelled) setAccount(data.user?.email ?? null);
          })
          .catch(() => {
            if (!cancelled) setMessage("Sign-in is temporarily unavailable.");
          });
        const { data } = db.auth.onAuthStateChange((_event, session) =>
          setAccount(session?.user.email ?? null),
        );
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        if (!cancelled)
          setMessage(
            "Sign-in is temporarily unavailable. Please try again later.",
          );
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);
  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const db = createClient();
      const returnUrl = new URL("/auth/callback", window.location.origin);
      returnUrl.searchParams.set("next", window.location.pathname);
      const result = signup
        ? await db.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: returnUrl.toString(),
              data: { display_name: name },
            },
          })
        : await db.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (!result.data.session)
        setMessage(
          "Check your email to confirm your account, then return to this invitation.",
        );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  async function accept() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/player-invitations/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      const target = new URL("/", window.location.origin);
      if (payload.context) {
        target.searchParams.set("player", payload.context.playerId);
        target.searchParams.set("team", payload.context.teamId);
        target.searchParams.set("season", payload.context.seasonId);
      }
      window.location.assign(target.toString());
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to accept invitation.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="player-beta player-beta-invite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="player-beta-wordmark"
        src={BRAND_ASSETS.wordmark}
        alt="Clubhouse 9"
      />
      <h1>Your Player Invitation</h1>
      {account ? (
        <>
          <p>Signed in as {account}</p>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void accept()}
          >
            Accept Player Invitation
          </button>
          <button
            className="ghost-button"
            onClick={() => void createClient().auth.signOut()}
          >
            Use a Different Account
          </button>
        </>
      ) : (
        <form onSubmit={authenticate} className="player-beta-form">
          <div className="segmented">
            <button
              type="button"
              className={!signup ? "active" : ""}
              aria-pressed={!signup}
              onClick={() => setSignup(false)}
            >
              Sign In
            </button>
            <button
              type="button"
              className={signup ? "active" : ""}
              aria-pressed={signup}
              onClick={() => setSignup(true)}
            >
              Create Account
            </button>
          </div>
          {signup && (
            <label>
              Name
              <input
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            Invited Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={8}
              required
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="primary-button" disabled={busy}>
            {busy ? "Please wait..." : signup ? "Create Account" : "Sign In"}
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </main>
  );
}
