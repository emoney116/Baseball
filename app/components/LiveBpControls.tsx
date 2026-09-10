import type { ReactNode } from "react";
import {
  BaseDiamond,
  BASE_DIAMOND_BASES,
  GameStateLights,
} from "./BaseballSituation";
import styles from "./LiveBpConsole.module.css";

export type BpSheet = (
  title: string,
  close: () => void,
  children: ReactNode,
  options?: { onBack?: () => void; panelClassName?: string },
) => ReactNode;
export function BpSegments({
  label,
  value,
  options,
  onChange,
  inline = false,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
  inline?: boolean;
}) {
  return (
    <div
      className={`${styles.segmentGroup} ${inline ? styles.inlineSegments : ""}`}
    >
      <span>{label}</span>
      <div className={styles.segments} role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
export function BpCount({
  balls,
  strikes,
  onChange,
}: {
  balls: number;
  strikes: number;
  onChange: (balls: number, strikes: number) => void;
}) {
  return (
    <div className={styles.count} aria-label={`Count ${balls}-${strikes}`}>
      <GameStateLights
        label="Balls"
        active={balls}
        total={3}
        tone="ball"
        onChange={(v) => onChange(v, strikes)}
      />
      <GameStateLights
        label="Strikes"
        active={strikes}
        total={2}
        tone="strike"
        onChange={(v) => onChange(balls, v)}
      />
    </div>
  );
}
export function BpBases({
  runners,
  onChange,
}: {
  runners: number[];
  onChange?: (runners: number[]) => void;
}) {
  return (
    <BaseDiamond className={onChange ? styles.bases : styles.miniBases}>
      {BASE_DIAMOND_BASES.map(({ base, label, number }) => (
        <button
          key={base}
          type="button"
          data-base={base}
          className={runners.includes(number) ? "occupied" : ""}
          aria-label={`${label} ${runners.includes(number) ? "occupied" : "empty"}`}
          aria-pressed={runners.includes(number)}
          disabled={!onChange}
          onClick={() =>
            onChange?.(
              runners.includes(number)
                ? runners.filter((b) => b !== number)
                : [...runners, number],
            )
          }
        >
          <span>{label}</span>
          <strong>{runners.includes(number) ? "On" : ""}</strong>
        </button>
      ))}
      <span className={styles.homePlate} aria-hidden="true" />
    </BaseDiamond>
  );
}
