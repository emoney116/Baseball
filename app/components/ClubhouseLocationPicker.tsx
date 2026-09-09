"use client";

import { MapPin, Plus, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ClubhouseLocation, LocationScope, LocationSuggestion, ResolvedPlace } from "../lib/locationTypes";
import { locationSubtitle } from "../lib/locationTypes";
import { createPlacesPickerSearch } from "../lib/placesPickerSearch";
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
      const response = await fetch(`/api/locations?${params}`, { cache: "no-store" });
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
  return <div className={`form-field ${styles.field}`}>
    <span>{label}</span>
    <button type="button" className={`secondary-button ${styles.trigger}`} onClick={() => void open()}><MapPin size={16} /><span>{value || "Choose location"}</span></button>
    <dialog className={styles.dialog} ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}>
      <header><h2 id={titleId}>Choose Location</h2><button type="button" className="icon-button" aria-label="Close location picker" onClick={close}><X size={18} /></button></header>
      <div className={styles.body}>
        {!confirmation ? <>
          <label className={styles.search}><Search size={17} /><input aria-label="Search locations" placeholder="Search school, field, park or address..." maxLength={200} value={query} onChange={event => { setQuery(event.target.value); interaction.current?.search(event.target.value); }} /></label>
          {!!saved.length && <section aria-label="Saved locations"><h3>Saved Locations</h3>{saved.map(location => <button key={location.id} type="button" className={styles.result} onClick={() => { onChange(location); close(); }}><MapPin size={17} /><span><strong>{location.name}</strong>{locationSubtitle(location) && <small>{locationSubtitle(location)}</small>}</span></button>)}</section>}
          {!!suggestions.length && <section className={styles.provider} aria-label="Google search results"><h3>Search Results</h3>{suggestions.map(suggestion => <button disabled={busy} key={suggestion.providerPlaceId} type="button" className={styles.result} onClick={() => void select(suggestion)}><MapPin size={17} /><span><strong>{suggestion.title}</strong><small>{suggestion.subtitle}</small></span></button>)}<span className={styles.attribution} translate="no">Google Maps</span></section>}
          {query.trim().length >= 3 && saved.length > 0 && <button type="button" className="text-button" disabled={busy} onClick={() => interaction.current?.search(query, true)}>Search Google Maps</button>}
          <button type="button" className="secondary-button" onClick={() => { setConfirmation({}); setCustomerName(""); }}><Plus size={16} />Enter venue name</button>
        </> : <>
          {confirmation.place && <section className={styles.provider}><strong>{confirmation.title}</strong><p>{confirmation.place.formattedAddress}</p><span className={styles.attribution} translate="no">Google Maps</span>{confirmation.place.attributions.map(item => <a href={item.uri} key={item.uri} target="_blank" rel="noreferrer">{item.name}</a>)}</section>}
          <label className={styles.name}>Your venue label<input aria-label="Your venue label" maxLength={100} value={customerName} onChange={event => setCustomerName(event.target.value)} /></label>
          <button type="button" className="text-button" onClick={() => { setConfirmation(null); setMessage(""); setSuggestions([]); interaction.current?.search(query, true); }}>Back to locations</button>
        </>}
        {busy && <p role="status">Loading...</p>}{message && <p role="alert">{message}</p>}
      </div>
      <footer><button type="button" className="secondary-button" onClick={close}>Cancel</button>{confirmation && <button type="button" className="primary-button" disabled={busy || !customerName.trim()} onClick={() => void save()}>Use Location</button>}</footer>
    </dialog>
  </div>;
}
