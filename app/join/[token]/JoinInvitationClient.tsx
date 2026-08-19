"use client";

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
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    void loadInvitation();
    void authRepository.getState().then(setAuthState);
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

  async function signIn() {
    if (!invitation) return;
    setBusy(true);
    setMessage("");
    try {
      await authRepository.signIn(invitation.email, password);
      const auth = await authRepository.getState();
      setAuthState(auth);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount() {
    if (!invitation) return;
    if (!firstName.trim() || !lastName.trim()) {
      setMessage("First and last name are required.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await authRepository.signUp({
        email: invitation.email,
        password,
        firstName,
        lastName,
      });
      const auth = await authRepository.getState();
      setAuthState(auth);
      if (auth.status !== "authenticated") {
        setMessage("Account created. Check your email if confirmation is required, then return to this invite link.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create account.");
    } finally {
      setBusy(false);
    }
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
    await authRepository.signOut();
    setAuthState({ status: "anonymous" });
    setBusy(false);
  }

  const expiredOrClosed = invitation && invitation.status !== "PENDING";

  return (
    <main className="loading-screen auth-screen join-screen">
      <img className="brand-wordmark brand-wordmark--product" src={BRAND_ASSETS.wordmark} alt="" />
      <strong>Staff invitation</strong>
      <span>{APP_NAME}</span>

      {message && <p className="auth-message">{message}</p>}

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
            <>
              <div className="auth-tabs" role="tablist" aria-label="Join mode">
                <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign In</button>
                <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create Account</button>
              </div>
              <form
                className="auth-form join-auth-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void (mode === "login" ? signIn() : createAccount());
                }}
              >
                {mode === "signup" && (
                  <div className="auth-name-grid">
                    <label>
                      <span>First name</span>
                      <input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
                    </label>
                    <label>
                      <span>Last name</span>
                      <input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
                    </label>
                  </div>
                )}
                <label>
                  <span>Email</span>
                  <input type="email" value={invitation.email} disabled autoComplete="email" />
                </label>
                <label>
                  <span>Password</span>
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                </label>
                {mode === "signup" && (
                  <label>
                    <span>Confirm password</span>
                    <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                  </label>
                )}
                <button className="primary-button stretch-button" type="submit" disabled={busy || !password || (mode === "signup" && (!firstName || !lastName || !confirmPassword))}>
                  {busy ? "Working..." : mode === "login" ? "Sign In" : "Create Account"}
                </button>
              </form>
            </>
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
