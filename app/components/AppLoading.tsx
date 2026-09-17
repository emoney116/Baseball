"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { BRAND_ASSETS } from "../lib/branding";

export function BusyIndicator() { return <span className="auth-spinner" aria-hidden="true" />; }

export function AppLoading({ label = "Opening Clubhouse", onRetry }: { label?: string; onRetry?: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(timer); }, []);
  return <main className="clubhouse-loading" aria-busy="true">
    <div className="clubhouse-loading__content">
      <div className="clubhouse-loading__diamond">
        <svg viewBox="0 0 240 240" fill="none" aria-hidden="true">
          <path className="clubhouse-loading__baseline" d="M120 220 L220 120 L120 20 L20 120 Z" />
          <path className="clubhouse-loading__runner" pathLength="100" d="M120 220 L220 120 L120 20 L20 120 Z" />
          <g className="clubhouse-loading__bases">
            <path d="M120 213 L127 220 L120 227 L113 220 Z" />
            <path d="M220 113 L227 120 L220 127 L213 120 Z" />
            <path d="M120 13 L127 20 L120 27 L113 20 Z" />
            <path d="M20 113 L27 120 L20 127 L13 120 Z" />
          </g>
        </svg>
        <Image className="clubhouse-loading__mark" src={BRAND_ASSETS.mark} alt="Clubhouse 9" width={80} height={80} unoptimized />
      </div>
      <span className="sr-only" role="status">{label}</span>
      <div className="clubhouse-loading__help">
        {slow && <div className="clubhouse-loading__slow"><p role="status">This is taking longer than usual. Check your connection.</p>{onRetry && <button type="button" className="auth-link-button" onClick={onRetry}>Try again</button>}</div>}
      </div>
    </div>
  </main>;
}
