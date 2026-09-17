"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppLoading, BusyIndicator } from "../../components/AppLoading";
import { AuthenticationForm } from "../../components/AuthenticationForm";
import { createClient } from "../../lib/supabase/client";
import { emailAuth } from "../../lib/emailAuthClient";
import { authErrorMessage } from "../../lib/emailAuth";
import { BRAND_ASSETS } from "../../lib/branding";

export default function ResetPassword() {
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "done">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => { cancelled = true; setState("invalid"); }, 20000);
    void Promise.resolve().then(async () => {
      if (new URLSearchParams(window.location.search).has("authError")) { setState("invalid"); return; }
      const { data, error } = await createClient().auth.getUser();
      if (!cancelled) setState(!error && data.user ? "ready" : "invalid");
    }).catch(() => { if (!cancelled) setState("invalid"); }).finally(() => clearTimeout(timer));
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  async function update() {
    if (inFlight.current) return;
    if (password !== confirm) { setError("Passwords do not match."); return; }
    inFlight.current = true; setBusy(true); setError("");
    try { await emailAuth.updatePassword(password); setPassword(""); setConfirm(""); setState("done"); }
    catch (error) { setError(authErrorMessage(error)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  if (state === "loading") return <AppLoading label="Checking your reset link" />;
  return <main className="account-screen">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="account-screen__brand brand-wordmark--product" src={BRAND_ASSETS.wordmark} alt="Clubhouse 9" />
    {state === "invalid" ? <><p className="account-auth__error" role="alert">This reset link is unavailable or expired. Request a new link below.</p><AuthenticationForm initialStep="forgot" onSignedIn={() => window.location.assign("/")} /></> : <section className="account-auth">
      <header className="account-auth__heading"><h1>{state === "done" ? "Password updated" : "Choose a new password"}</h1><p>{state === "done" ? "Your new password is ready to use." : "Use at least 8 characters."}</p></header>
      {error && <p className="account-auth__error" role="alert">{error}</p>}
      {state === "done" ? <Link href="/" className="primary-button account-auth__submit">Continue to Clubhouse</Link> : <form onSubmit={event => { event.preventDefault(); void update(); }} aria-busy={busy}>
        <fieldset disabled={busy}>
          <label>New password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
          <label>Confirm new password<input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></label>
          <button type="submit" className="primary-button account-auth__submit">{busy ? <><BusyIndicator />Updating password…</> : "Update password"}</button>
        </fieldset>
      </form>}
    </section>}
  </main>;
}
