"use client";

import { useId } from "react";

// First-party organization/team metadata. Never accept a provider result here.
export function PublicLocalityFields({ city, state, onChange }: {
  city: string; state: string; onChange: (value: { city: string; state: string }) => void;
}) {
  const noteId = useId();
  return <fieldset className="public-locality-fields team-creator-span" aria-describedby={noteId}>
    <legend>Public city / state</legend>
    <p id={noteId}>Enter from your own records, not the Google listing.</p>
    <div>
      <label className="form-field"><span>City</span><input aria-label="Public city" maxLength={100} value={city} onChange={event => onChange({ city: event.target.value, state })} /></label>
      <label className="form-field"><span>State</span><input aria-label="Public state" maxLength={2} placeholder="NC" value={state} onChange={event => onChange({ city, state: event.target.value.toUpperCase() })} /></label>
    </div>
  </fieldset>;
}
