"use client";
import { useState } from "react";
import { Download, Save, Trash2 } from "lucide-react";
import type { BpSettings } from "../lib/liveBp";
import {
  applyDefensePreset,
  captureDefensePreset,
} from "../lib/liveBpDefensePresets";
import type { BpSheet } from "./LiveBpControls";
import styles from "./LiveBpConsole.module.css";

export function LiveBpDefensePresets({
  settings,
  playerIds,
  busy,
  error,
  onSave,
  onLoad,
  onClose,
  sheet,
}: {
  settings: BpSettings;
  playerIds: string[];
  busy: boolean;
  error: string;
  onSave: (settings: BpSettings) => void;
  onLoad: (settings: BpSettings) => void;
  onClose: () => void;
  sheet: BpSheet;
}) {
  const [name, setName] = useState("");
  const presets = settings.defensePresets ?? [];
  return sheet(
    "Defense Presets",
    onClose,
    <>
      <fieldset className={styles.setup} disabled={busy}>
        <label>
          Preset name
          <input
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            placeholder="Team 1"
          />
        </label>
        <button
          type="button"
          className="primary-button"
          disabled={
            !name.trim() ||
            presets.length >= 12 ||
            presets.some(
              (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
            )
          }
          onClick={() =>
            onSave({
              ...settings,
              defensePresets: [
                ...presets,
                captureDefensePreset(settings, crypto.randomUUID(), name),
              ],
            })
          }
        >
          <Save size={16} />
          Save Current Defense
        </button>
        {presets.map((preset) => (
          <div className={styles.presetRow} key={preset.id}>
            <strong>{preset.name}</strong>
            <button
              type="button"
              className="icon-button"
              aria-label={`Load ${preset.name}`}
              title={`Load ${preset.name}`}
              onClick={() =>
                onLoad(applyDefensePreset(settings, preset, playerIds))
              }
            >
              <Download size={18} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Update ${preset.name}`}
              title={`Replace ${preset.name} with current defense`}
              onClick={() => {
                if (
                  window.confirm(
                    `Replace ${preset.name} with the current defense?`,
                  )
                )
                  onSave({
                    ...settings,
                    defensePresets: presets.map((p) =>
                      p.id === preset.id
                        ? captureDefensePreset(settings, p.id, p.name)
                        : p,
                    ),
                  });
              }}
            >
              <Save size={18} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Delete ${preset.name}`}
              title={`Delete ${preset.name}`}
              onClick={() => {
                if (window.confirm(`Delete ${preset.name}?`))
                  onSave({
                    ...settings,
                    defensePresets: presets.filter((p) => p.id !== preset.id),
                  });
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {error && <p role="alert">{error}</p>}
      </fieldset>
      <div className="modal-actions">
        <button className="secondary-button" disabled={busy} onClick={onClose}>
          Done
        </button>
      </div>
    </>,
  );
}
