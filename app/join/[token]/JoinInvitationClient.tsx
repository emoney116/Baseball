"use client";

import { AuthenticationForm } from "../../components/AuthenticationForm";
import { BusyIndicator } from "../../components/AppLoading";
import { Check, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authRepository, type AuthState } from "../../data/supabaseRepository";
import { APP_NAME, BRAND_ASSETS } from "../../lib/branding";

type InvitationLookup = {
  id: string;
  organizationName: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  staffRole: string;
  accessRole: "ADMIN" | "COACH";
  expiresAt: string;
  teamNames: string[];
};

export default function JoinInvitationClient({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<InvitationLookup | null>(null);
  const [authState, setAuthState] = useState<AuthState>({ status: "anonymous" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    void loadInvitation().catch(() => setMessage("Unable to load this invitation. Check your connection and reload."));
    void authRepository.getState().then(setAuthState).catch(() => setMessage("Unable to check your account. Please try again."));
    // The invite token is immutable for this route instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInvitation() {
    setMessage("");
    const response = await fetch("/api/staff/invitations/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = (await response.json().catch(() => ({}))) as { invitation?: InvitationLookup; message?: string };
    if (!response.ok || !payload.invitation) {
      setMessage(payload.message ?? "This invitation link is invalid.");
      return;
    }
    setInvitation(payload.invitation);
  }

  async function acceptInvite() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/staff/invitations/accept", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Unable to accept invitation.");
      setAccepted(true);
      await loadInvitation();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to accept invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try { await authRepository.signOut(); setAuthState({ status: "anonymous" }); }
    catch { setMessage("Unable to sign out. Please try again."); }
    finally { setBusy(false); }
  }

  const expiredOrClosed = invitation && invitation.status !== "PENDING";

  return (
    <main className="loading-screen auth-screen join-screen">
      <img className="brand-wordmark brand-wordmark--product" src={BRAND_ASSETS.wordmark} alt="" />
      <strong>Staff invitation</strong>
      <span>{APP_NAME}</span>

      {!invitation && !message && <p role="status"><BusyIndicator /> Loading your invitation…</p>}
      {message && <p className="auth-message" role="status">{message}</p>}

      {invitation && (
        <section className="auth-form no-team-card join-card">
          <span>{invitation.organizationName}</span>
          <h1>{accepted ? "You're in." : "You've been invited."}</h1>
          <div className="join-card__summary">
            <p><strong>Email</strong><span>{invitation.email}</span></p>
            <p><strong>Role</strong><span>{invitation.staffRole}</span></p>
            <p><strong>Access</strong><span>{invitation.accessRole}</span></p>
            <p><strong>Teams</strong><span>{invitation.teamNames.join(", ") || "Assigned team"}</span></p>
          </div>

          {expiredOrClosed && !accepted && (
            <p className="auth-message">
              {invitation.status === "EXPIRED"
                ? "This invitation has expired. Contact a team administrator for a new invitation."
                : "This invitation is no longer available."}
            </p>
          )}

          {!expiredOrClosed && authState.status !== "authenticated" && (
            <AuthenticationForm initialEmail={invitation.email} lockedEmail next={`/join/${token}`} onSignedIn={async () => setAuthState(await authRepository.getState())} />
          )}

          {!expiredOrClosed && authState.status === "authenticated" && !accepted && (
            <div className="join-actions">
              <button className="primary-button stretch-button" type="button" onClick={() => void acceptInvite()} disabled={busy}>
                <Check size={16} aria-hidden="true" />
                Accept Invitation
              </button>
              <button className="secondary-button stretch-button" type="button" onClick={() => void signOut()} disabled={busy}>
                <LogOut size={16} aria-hidden="true" />
                Sign Out
              </button>
            </div>
          )}

          {accepted && (
            <Link className="primary-button stretch-button join-open-app" href="/">
              Open {APP_NAME}
            </Link>
          )}
        </section>
      )}
    </main>
  );
}
