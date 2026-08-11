"use client";

import { Check, LockKeyhole, Shield, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { authRepository, type AuthState, type BootstrapStatus } from "../data/supabaseRepository";
import { APP_NAME, BRAND_ASSETS } from "../lib/branding";

type SetupMode = "sign-in" | "sign-up";

export default function SetupPage() {
  const [authState, setAuthState] = useState<AuthState>({ status: "anonymous" });
  const [status, setStatus] = useState<BootstrapStatus | null>(null);
  const [mode, setMode] = useState<SetupMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  const setupReady = useMemo(
    () => Boolean(status?.foundationReady && !status.bootstrapClosed && status.authorized && authState.status === "authenticated"),
    [authState.status, status],
  );

  async function refresh() {
    setMessage(null);
    const nextAuth = await authRepository.getState();
    setAuthState(nextAuth);
    const nextStatus = await authRepository.getBootstrapStatus();
    setStatus(nextStatus);
  }

  async function handleAuth() {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "sign-in") {
        await authRepository.signIn(email, password);
        setMessage("Signed in. Checking setup access...");
      } else {
        await authRepository.signUp(email, password);
        setMessage("Account created. If Supabase email confirmation is enabled, confirm your email and return to this setup page.");
      }
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  async function initialize() {
    setBusy(true);
    setMessage(null);
    try {
      await authRepository.initializeOrganization({ displayName, setupCode });
      setMessage(`${APP_NAME} is initialized. Opening the app...`);
      window.location.href = "/";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Unable to initialize ${APP_NAME}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="setup-screen">
      <section className="setup-card">
        <div className="setup-brand">
          <img src={BRAND_ASSETS.mark} alt="" />
          <span>
            <strong>{APP_NAME}</strong>
            <small>First-run setup</small>
          </span>
        </div>

        <div className="setup-steps" aria-label="Setup progress">
          <span className={status?.foundationReady ? "complete" : ""}><Check size={14} aria-hidden="true" />Database</span>
          <span className={authState.status === "authenticated" ? "complete" : ""}><Shield size={14} aria-hidden="true" />Coach account</span>
          <span className={status?.bootstrapClosed ? "complete" : setupReady ? "ready" : ""}><LockKeyhole size={14} aria-hidden="true" />Admin bootstrap</span>
        </div>

        {message && <p className="auth-message">{message}</p>}
        {authState.status === "not-configured" && <p className="auth-message">{authState.message}</p>}
        {status?.message && <p className="auth-message">{status.message}</p>}

        {status?.bootstrapClosed && (
          <div className="setup-panel">
            <h1>Setup is closed</h1>
            <p>The Metrolina organization already has an admin. Future coaches should be invited from inside the app.</p>
            <Link className="primary-button stretch-button" href="/">Open {APP_NAME}</Link>
          </div>
        )}

        {!status?.bootstrapClosed && authState.status !== "authenticated" && (
          <form
            className="setup-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAuth();
            }}
          >
            <h1>{mode === "sign-in" ? "Sign in to initialize" : "Create the first coach account"}</h1>
            <p>Use an email that has been added to the server-side setup allowlist.</p>
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={6} />
            </label>
            <button className="primary-button stretch-button" type="submit" disabled={busy || !email || !password}>
              {busy ? "Working..." : mode === "sign-in" ? "Sign In" : "Create Account"}
            </button>
            <button className="text-button" type="button" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
              {mode === "sign-in" ? "Create the first coach account" : "I already have an account"}
            </button>
          </form>
        )}

        {!status?.bootstrapClosed && authState.status === "authenticated" && !status?.authorized && (
          <div className="setup-panel">
            <h1>Setup access needed</h1>
            <p>{status?.authorizationMessage ?? "This signed-in email is not authorized for first-run setup."}</p>
            <button className="secondary-button stretch-button" type="button" onClick={() => void authRepository.signOut().then(refresh)}>
              Sign Out
            </button>
          </div>
        )}

        {setupReady && (
          <form
            className="setup-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void initialize();
            }}
          >
            <h1>Initialize {APP_NAME}</h1>
            <p>This is a one-time operation. It creates your coach profile and admin membership atomically, then closes bootstrap permanently.</p>
            <label>
              <span>Display name</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={status?.email ?? "Coach"} autoComplete="name" />
            </label>
            {status?.requiresSetupCode && (
              <label>
                <span>Setup code</span>
                <input type="password" value={setupCode} onChange={(event) => setSetupCode(event.target.value)} autoComplete="one-time-code" />
              </label>
            )}
            <button className="primary-button stretch-button" type="submit" disabled={busy || Boolean(status?.requiresSetupCode && !setupCode)}>
              <UserPlus size={16} aria-hidden="true" />
              {busy ? "Initializing..." : "Initialize Organization"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
