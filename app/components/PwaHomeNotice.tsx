"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Share, X } from "lucide-react";
import { INSTALL_DISMISSED_KEY, isAppleSafari, isNewBuild, isStandalone } from "../lib/pwa";
import styles from "./PwaHomeNotice.module.css";

// Mounted on global Home only: never overlays a tracking console or intercepts navigation.
export function PwaHomeNotice({ canRefresh }: { canRefresh: boolean }) {
  const [install, setInstall] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    let controller: AbortController | undefined;
    const standalone = () => isStandalone(media.matches, (navigator as Navigator & { standalone?: boolean }).standalone);
    const updateMode = () => {
      let dismissed = true;
      try { dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === "1"; } catch { /* Do not nag when storage is unavailable. */ }
      document.documentElement.dataset.displayMode = standalone() ? "standalone" : "browser";
      setInstall(!standalone() && !dismissed && isAppleSafari(navigator.userAgent, navigator.maxTouchPoints));
    };
    const check = async () => {
      if (!standalone() || document.hidden || !navigator.onLine) return;
      controller?.abort();
      controller = new AbortController();
      const request = controller;
      const timeout = window.setTimeout(() => request.abort(), 8000);
      try {
        const response = await fetch("/api/app-version", { cache: "no-store", credentials: "omit", signal: request.signal });
        if (response.ok) {
          const payload = await response.json();
          if (!request.signal.aborted) setUpdated(isNewBuild(process.env.NEXT_PUBLIC_CLUBHOUSE_BUILD, payload.version));
        }
      } catch { /* Offline or deployment failure must never interrupt the app. */ }
      finally { window.clearTimeout(timeout); }
    };
    const frame = requestAnimationFrame(() => { updateMode(); void check(); });
    const visible = () => { updateMode(); void check(); };
    media.addEventListener("change", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(() => void check(), 300000);
    return () => {
      cancelAnimationFrame(frame);
      controller?.abort();
      window.clearInterval(timer);
      media.removeEventListener("change", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  function dismissInstall() {
    setInstall(false);
    try { localStorage.setItem(INSTALL_DISMISSED_KEY, "1"); } catch { /* Remains hidden this visit. */ }
  }

  if (updated && !dismissedUpdate) return <aside className={styles.notice} aria-label="Clubhouse update">
    <div><strong>Clubhouse 9 updated</strong><p>No reinstall needed. Refresh after saving your work.</p>
      {confirmRefresh ? <div className={styles.confirm}><p>Reload Clubhouse now? Only continue once your work is saved.</p>
        <button type="button" disabled={!canRefresh} onClick={() => {
          if (canRefresh && !document.querySelector('[role="dialog"], dialog[open]')) window.location.reload();
        }}>Refresh now</button><button type="button" onClick={() => setConfirmRefresh(false)}>Not now</button></div>
        : <button className={styles.refresh} type="button" disabled={!canRefresh} onClick={() => setConfirmRefresh(true)}><RefreshCw size={18} />Refresh</button>}
    </div>
    <button type="button" onClick={() => setDismissedUpdate(true)} aria-label="Dismiss update notice" title="Dismiss"><X size={20} /></button>
  </aside>;
  if (!install) return null;
  return <aside className={styles.notice} aria-label="Install Clubhouse 9">
    <div><strong>Install Clubhouse 9</strong><p>Add Clubhouse to your Home Screen for faster access.</p>
      <p className={styles.steps}><Share size={18} aria-hidden="true" /><span>Share &rarr; Add to Home Screen</span></p>
      <p>Keep Open as Web App enabled if shown.</p>
    </div>
    <button type="button" onClick={dismissInstall} aria-label="Dismiss install instructions" title="Dismiss"><X size={20} /></button>
  </aside>;
}
