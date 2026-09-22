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
  const [invite, setInvite] = useState<{ teamName: string; playerName: string; jersey: number | null }>();
  const [unavailable, setUnavailable] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/player-invitations/preview", { method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message);
        if (!controller.signal.aborted) setInvite(payload);
      }).catch(error => { if (!controller.signal.aborted) setUnavailable(error instanceof Error ? error.message : "Invitation unavailable."); });
    return () => controller.abort();
  }, [token]);
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
  async function leaveInvitation() {
    setBusy(true);
    try {
      const response = await fetch("/api/player-invitations/preview", { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to leave invitation. Please try again.");
      window.location.assign("/");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to leave invitation."); setBusy(false); }
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
      <h1>{invite?.teamName ?? "Your Player Invitation"}</h1>
      {invite && <><p>You&apos;ve been invited to join Clubhouse 9.</p><p>Joining as <strong>{invite.playerName}</strong>{invite.jersey != null ? ` #${invite.jersey}` : ""}</p></>}
      {unavailable ? <><p role="status">{unavailable}</p><button disabled={busy} className="secondary-button" onClick={() => void leaveInvitation()}>Open Clubhouse / Log In</button></> : !invite ? <BusyIndicator /> : account ? (
        <>
          <p>Signed in as {account}</p>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void accept()}
          >
            {busy && <BusyIndicator />} Join Clubhouse
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
        <AuthenticationForm invitedName={invite.playerName} initialStep="signup" next={`/join/player/${token}`} onSignedIn={async () => {
          const { data, error } = await createClient().auth.getUser();
          if (error) throw error;
          setAccount(data.user?.email ?? null);
        }} />
      )}
      {invite && !unavailable && <button disabled={busy} className="ghost-button" onClick={() => void leaveInvitation()}>This isn&apos;t me</button>}
      {message && <p role="status">{message}</p>}
    </main>
  );
}
