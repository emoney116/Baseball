"use client";
import { useEffect, useState } from "react";
import { ClubhouseLocationPicker } from "./ClubhouseLocationPicker";
import type { ClubhouseLocation } from "../lib/locationTypes";

export function LocationDefaultSettings({ teamId, organizationId }: { teamId?: string; organizationId?: string }) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [inherited, setInherited] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    const params = new URLSearchParams(teamId ? { teamId } : { organizationId: organizationId! });
    void fetch(`/api/locations?${params}`, { signal: abort.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!abort.signal.aborted) { setValue(result.locations.find((row: ClubhouseLocation) => row.id === result.defaultId)?.name ?? ""); setInherited(Boolean(result.inherited)); }
    }).catch(() => { if (!abort.signal.aborted) setMessage("Location settings are temporarily unavailable."); });
    return () => abort.abort();
  }, [teamId, organizationId]);
  async function update(location: ClubhouseLocation | null) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/locations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, organizationId, locationId: location?.id ?? null }) });
      if (!response.ok) throw new Error();
      setValue(location?.name ?? "Organization Default"); setInherited(location === null);
    } catch { setMessage("Unable to update default location."); }
    finally { setBusy(false); }
  }
  return <div className="location-default-settings"><ClubhouseLocationPicker label={teamId ? "Default Location" : "Organization Location"} scope={{ teamId, organizationId }} value={value} onChange={location => { void update(location); }} />
    {teamId && <label><input type="checkbox" checked={inherited} disabled={busy || inherited} onChange={() => void update(null)} />Organization Default</label>}
    {message && <p role="alert">{message}</p>}
  </div>;
}
