"use client";
import { useEffect, useState } from "react";
import { AuthenticationForm } from "../../../components/AuthenticationForm";
import { BusyIndicator } from "../../../components/AppLoading";
import { createClient } from "../../../lib/supabase/client";
import { BRAND_ASSETS } from "../../../lib/branding";

export default function PlayerInvitationClient({ token }: { token: string }) {
  const [account, setAccount] = useState<string | null>(null),
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
            {busy && <BusyIndicator />} Accept Player Invitation
          </button>
          <button
            className="ghost-button"
            disabled={busy}
            onClick={() => void createClient().auth.signOut().then(({ error }) => { if (error) setMessage("Unable to sign out. Please try again."); })}
          >
            Use a Different Account
          </button>
        </>
      ) : (
        <AuthenticationForm next={`/join/player/${token}`} onSignedIn={async () => {
          const { data, error } = await createClient().auth.getUser();
          if (error) throw error;
          setAccount(data.user?.email ?? null);
        }} />
      )}
      {message && <p role="status">{message}</p>}
    </main>
  );
}
