import type { ReactNode } from "react";
import type { BpDraft, BpSettings } from "../lib/liveBp";
import type { ZonePoint } from "../types";
import { TENDEX_PITCH_TYPES } from "../lib/tendexGameAnalysis";
import { VelocityPickerField } from "./TeamTrainingViews";
import styles from "./LiveBpConsole.module.css";

export function LiveBpPitchDetails({
  settings,
  draft,
  onChange,
  location,
}: {
  settings: BpSettings;
  draft: BpDraft;
  onChange: (draft: BpDraft) => void;
  location: (
    point: ZonePoint | undefined,
    select: (p: ZonePoint) => void,
    hitter: string,
  ) => ReactNode;
}) {
  return (
    <section className="practice-hitting-sheet__step">
      {settings.pitchMode !== "OFF" && (
        <div className="practice-hitting-inline-pitch" aria-label="Pitch type">
          {TENDEX_PITCH_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              className={
                (draft.pitchType ?? settings.pitchType) === value
                  ? "active"
                  : ""
              }
              aria-pressed={(draft.pitchType ?? settings.pitchType) === value}
              onClick={() => onChange({ ...draft, pitchType: value })}
            >
              {value}
            </button>
          ))}
        </div>
      )}
      {settings.velocity && (
        <VelocityPickerField
          label="Pitch Velo"
          value={draft.velocity?.toString() ?? ""}
          onChange={(v) =>
            onChange({ ...draft, velocity: v ? Number(v) : undefined })
          }
          defaultValue={80}
          ariaLabel="Pitch velocity in miles per hour"
        />
      )}
      {settings.location && (
        <section className={styles.location}>
          <header>
            <h3>Pitch Location</h3>
            <button
              type="button"
              className="text-button"
              onClick={() => onChange({ ...draft, location: undefined })}
            >
              Clear
            </button>
          </header>
          {location(
            draft.location,
            (point) => onChange({ ...draft, location: point }),
            settings.hitterId,
          )}
        </section>
      )}
    </section>
  );
}
