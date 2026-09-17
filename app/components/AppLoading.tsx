"use client";
import { useEffect, useState } from "react";
import { BRAND_ASSETS } from "../lib/branding";

export function BusyIndicator() { return <span className="auth-spinner" aria-hidden="true" />; }

export function AppLoading({ label = "Opening Clubhouse", onRetry }: { label?: string; onRetry?: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(timer); }, []);
  return <main className="clubhouse-loading" aria-busy="true">
    <div className="clubhouse-loading__content">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND_ASSETS.mark} alt="Clubhouse 9" width={64} height={64} />
      <div className="clubhouse-loading__track" aria-hidden="true"><span /></div>
      <p role="status"><BusyIndicator />{label}…</p>
      {slow && <div className="clubhouse-loading__slow"><p>This is taking longer than usual. Check your connection.</p>{onRetry && <button type="button" className="auth-link-button" onClick={onRetry}>Try again</button>}</div>}
    </div>
  </main>;
}
