"use client";

import { MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ClubhouseLocation, LocationScope, LocationSuggestion, ResolvedPlace } from "../lib/locationTypes";
import { locationSubtitle } from "../lib/locationTypes";
import { createPlacesPickerSearch } from "../lib/placesPickerSearch";
import { isLocationPreview, previewLocations } from "../lib/locationPreview";
import styles from "./ClubhouseLocationPicker.module.css";

export function ClubhouseLocationPicker({ value, scope, onChange, label = "Location" }: {
  value?: string; scope: LocationScope; label?: string; onChange: (location: ClubhouseLocation) => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const interaction = useRef<ReturnType<typeof createPlacesPickerSearch> | null>(null);
  const generation = useRef(0);
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<ClubhouseLocation[]>([]);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [confirmation, setConfirmation] = useState<{ place?: ResolvedPlace; title?: string; receipt?: string } | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedTitle = useRef("");
  // Provider addresses stay in this mounted picker only, never in persistent venue data.
  const [addressDisplay, setAddressDisplay] = useState<Record<string, string>>({});
  useEffect(() => () => { generation.current++; interaction.current?.close(); }, []);

  function close() {
    generation.current++; interaction.current?.close(); interaction.current = null;
    dialog.current?.close(); setConfirmation(null); setSuggestions([]); setQuery(""); setBusy(false);
  }
  async function open() {
    const version = ++generation.current;
    setMessage(""); setQuery(""); setSaved([]); setSuggestions([]); setConfirmation(null); setCustomerName(""); setBusy(true);
    dialog.current?.setAttribute("closedby", "any");
    dialog.current?.showModal();
    const params = new URLSearchParams();
    if (scope.teamId) params.set("teamId", scope.teamId);
    if (scope.organizationId) params.set("organizationId", scope.organizationId);
    try {
      if (isLocationPreview()) {
        const locations = previewLocations();
        setSaved(locations);
        interaction.current = createPlacesPickerSearch(scope, locations, result => {
          if (version !== generation.current) return;
          if (result.saved) setSaved(result.saved);
          setMessage(result.message ?? "");
          setBusy(false);
        }, async () => Response.json({ message: "No sample venue matches. Sign in to use Google search." }));
        return;
      }
      const response = await fetch(`/api/locations?${params}`, { cache: "no-store" });
      if (response.status === 401) { setMessage("Sign in to search and save locations."); return; }
      if (!response.ok) throw new Error();
      const payload = await response.json() as { locations: ClubhouseLocation[] };
      if (version !== generation.current) return;
      setSaved(payload.locations);
      interaction.current = createPlacesPickerSearch(scope, payload.locations, result => {
        if (version !== generation.current) return;
        if (result.saved) setSaved(result.saved);
        if (result.suggestions) setSuggestions(result.suggestions);
        setMessage(result.message ?? "");
        if (result.place) {
          const place = result.place;
          setAddressDisplay(previous => ({ ...previous, [place.providerPlaceId]: place.formattedAddress }));
          setConfirmation({ place: result.place, title: selectedTitle.current, receipt: result.receipt });
          setCustomerName("");
        }
        setBusy(false);
      });
    } catch { if (version === generation.current) setMessage("Locations are temporarily unavailable."); }
    finally { if (version === generation.current) setBusy(false); }
  }
  async function select(suggestion: LocationSuggestion) {
    selectedTitle.current = suggestion.title;
    setBusy(true); setMessage("");
    await interaction.current?.select(suggestion);
    setBusy(false);
  }
  async function save() {
    const version = generation.current;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        ...scope, name: customerName.trim(), providerPlaceId: confirmation?.place?.providerPlaceId, receipt: confirmation?.receipt,
      }) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { location: ClubhouseLocation };
      if (version !== generation.current) return;
      onChange(result.location); close();
    } catch { if (version === generation.current) setMessage("Unable to save location. Try again."); }
    finally { if (version === generation.current) setBusy(false); }
  }
  async function selectPrevious(location: ClubhouseLocation) {
    if (isLocationPreview()) { onChange(location); close(); return; }
    const version = generation.current;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/locations", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scope, action: "reuse", locationId: location.id }) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { location: ClubhouseLocation };
      if (version === generation.current) { onChange(result.location); close(); }
    } catch { if (version === generation.current) setMessage("Unable to select location. Try again."); }
    finally { if (version === generation.current) setBusy(false); }
  }
  return <div className={`form-field ${styles.field}`}>
    <span>{label}</span>
    <button type="button" className={`secondary-button ${styles.trigger}`} onClick={() => void open()}><MapPin size={16} /><span>{value || "Choose location"}</span></button>
    <dialog className={styles.dialog} ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}>
      <header><h2 id={titleId}>Choose Location</h2><button type="button" className="icon-button" aria-label="Close location picker" onClick={close}><X size={18} /></button></header>
      <div className={styles.body}>
        {isLocationPreview() && <small role="note">Local preview venues. Google search requires sign-in.</small>}
        {!confirmation ? <>
          <label className={styles.search}><Search size={17} /><input aria-label="Search locations" placeholder="Search school, field, park or address..." maxLength={200} value={query} onChange={event => { setQuery(event.target.value); interaction.current?.search(event.target.value); }} /></label>
          {["Team Default", "Previous Locations"].map(group => {
            const rows = saved.filter(row => (row.group === "Team Default" ? "Team Default" : "Previous Locations") === group);
            return rows.length ? <section key={group} aria-label={group}><h3>{group}</h3>{rows.map(location => {
              const googleAddress = location.providerPlaceId ? addressDisplay[location.providerPlaceId] : undefined;
              const subtitle = googleAddress || location.address || locationSubtitle(location);
              return <button disabled={busy} key={location.id} type="button" className={styles.result} onClick={() => void selectPrevious(location)}><MapPin size={17} /><span><strong>{location.name}</strong>{subtitle && <small>{subtitle}</small>}{googleAddress && <small translate="no">Google Maps</small>}</span></button>;
            })}</section> : null;
          })}
          {!!suggestions.length && <section className={styles.provider} aria-label="Google search results"><h3>Search Results</h3>{suggestions.map(suggestion => <button disabled={busy} key={suggestion.providerPlaceId} type="button" className={styles.result} onClick={() => void select(suggestion)}><MapPin size={17} /><span><strong>{suggestion.title}</strong><small>{suggestion.subtitle}</small></span></button>)}<span className={styles.attribution} translate="no">Google Maps</span></section>}
          {!isLocationPreview() && query.trim().length >= 3 && saved.length > 0 && <button type="button" className="text-button" disabled={busy} onClick={() => interaction.current?.search(query, true)}>Search Google Maps</button>}
        </> : <>
          {confirmation.place && <section className={styles.provider}><strong>{confirmation.title}</strong><p>{confirmation.place.formattedAddress}</p><span className={styles.attribution} translate="no">Google Maps</span>{confirmation.place.attributions.map(item => <a href={item.uri} key={item.uri} target="_blank" rel="noreferrer">{item.name}</a>)}</section>}
          <label className={styles.name}>Your venue label<input aria-label="Your venue label" maxLength={100} value={customerName} onChange={event => setCustomerName(event.target.value)} /></label>
          <button type="button" className="text-button" onClick={() => { setConfirmation(null); setMessage(""); setSuggestions([]); interaction.current?.search(query, true); }}>Back to locations</button>
        </>}
        {busy && <p role="status">Loading...</p>}{message && <p role="alert">{message}</p>}
      </div>
      {confirmation && <footer><button type="button" className="primary-button" disabled={busy || !customerName.trim()} onClick={() => void save()}>Use Location</button></footer>}
    </dialog>
  </div>;
}
