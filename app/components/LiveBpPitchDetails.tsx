import type { ReactNode } from "react";
import type { BpDraft, BpSettings } from "../lib/liveBp";
import type { ZonePoint } from "../types";
import { TENDEX_PITCH_TYPES } from "../lib/tendexGameAnalysis";
import { VelocityPickerField } from "./TeamTrainingViews";
import { ChoiceSelect } from "./ChoiceSelect";
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
      {settings.pitchMode === "MULTI" && (
        <ChoiceSelect
          label="Pitch type"
          value={draft.pitchType ?? settings.pitchType ?? "4-Seam"}
          options={TENDEX_PITCH_TYPES.map((value) => ({ value, label: value }))}
          onChange={(value) =>
            onChange({ ...draft, pitchType: value as BpDraft["pitchType"] })
          }
        />
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
