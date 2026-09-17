"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { AuthenticationForm } from "./components/AuthenticationForm";
import { AppLoading } from "./components/AppLoading";
import { BRAND_ASSETS } from "./lib/branding";
import { createClient } from "./lib/supabase/client";

// Signing in must not download games, analytics, training, voice and chat first.
const ClubhouseWorkspace = dynamic(() => import("./ClubhouseWorkspace"), {
  loading: () => <AppLoading label="Opening your Clubhouse" />,
});
const subscribeToLocation = (notify: () => void) => {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
};
const getLocation = () => window.location.href;
const getServerLocation = () => "";

export default function ClubhouseEntry() {
  const [state, setState] = useState<"checking" | "anonymous" | "workspace">("checking");
  const [error, setError] = useState("");
  const location = useSyncExternalStore(subscribeToLocation, getLocation, getServerLocation);
  const url = location ? new URL(location) : null;
  const confirmationFailed = url?.searchParams.has("authError");
  const localPreview = url && ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase()) && url.searchParams.get("devBypass") === "1";
  const checkSequence = useRef(0);

  async function checkSession() {
    const sequence = ++checkSequence.current;
    try {
      const { data, error } = await Promise.resolve().then(() => createClient().auth.getSession());
      if (sequence !== checkSequence.current) return;
      if (error) throw error;
      setError("");
      // Bundle-loading hint only, never authorization. The workspace still
      // verifies getUser, server-side access and RLS before reading team data.
      setState(data.session ? "workspace" : "anonymous");
    } catch {
      if (sequence !== checkSequence.current) return;
      setError("We couldn’t check your session. Check your connection and try again.");
      setState("anonymous");
    }
  }

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname.toLowerCase());
    if (isLocal && params.get("devBypass") === "1") {
      return;
    }
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = createClient().auth.onAuthStateChange(event => {
        if (event === "PASSWORD_RECOVERY") {
          checkSequence.current++;
          window.location.replace("/auth/reset-password");
        }
        if (event === "SIGNED_OUT") {
          checkSequence.current++;
          setState("anonymous"); setError("");
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch { /* checkSession provides the recovery UI. */ }
    // Session callbacks and configuration failures both resolve asynchronously.
    void Promise.resolve().then(() => { if (active) return checkSession(); });
    // This ref is a cancellation generation, not a DOM node. Invalidate the
    // latest request, including retries started after this effect mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { active = false; checkSequence.current++; unsubscribe?.(); };
  }, []);

  if (localPreview || state === "workspace") return <ClubhouseWorkspace />;
  if (state === "checking") return <AppLoading label="Checking your session" onRetry={() => void checkSession()} />;

  return <main className="account-screen">
    <Image className="account-screen__brand brand-wordmark--product" src={BRAND_ASSETS.wordmark} alt="Clubhouse 9" width={190} height={64} unoptimized />
    {confirmationFailed && <p className="account-auth__error" role="alert">This email link could not be confirmed. It may have expired or been opened in another browser. Sign in below, or request a new code if your email still needs confirmation.</p>}
    {error && <div className="account-auth__error" role="alert">{error}<button className="auth-link-button" type="button" onClick={() => void checkSession()}>Try again</button></div>}
    <AuthenticationForm onSignedIn={() => { checkSequence.current++; setState("workspace"); }} />
  </main>;
}
