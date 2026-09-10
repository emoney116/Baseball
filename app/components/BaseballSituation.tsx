import type { ReactNode } from "react";

// Game Center's read-only lights also support an explicit Practice correction callback.
export function GameStateLights({
  label,
  active,
  total,
  tone,
  onChange,
}: {
  label: string;
  active: number;
  total: number;
  tone: "ball" | "strike" | "out";
  onChange?: (value: number) => void;
}) {
  return (
    <span
      className={`game-state-lights game-state-lights--${tone} ${onChange ? "game-state-lights--editable" : ""}`}
    >
      <strong>{label}</strong>
      {Array.from({ length: total }, (_, index) =>
        onChange ? (
          <button
            key={index}
            type="button"
            aria-label={`Set ${label.toLowerCase()} to ${index < active ? index : index + 1}`}
            aria-pressed={index < active}
            onClick={() => onChange(index < active ? index : index + 1)}
          >
            <i className={index < active ? "active" : ""} />
          </button>
        ) : (
          <i key={index} className={index < active ? "active" : ""} />
        ),
      )}
    </span>
  );
}

export const BASE_DIAMOND_BASES = [
  { base: "second", label: "2B", number: 2 },
  { base: "third", label: "3B", number: 3 },
  { base: "first", label: "1B", number: 1 },
] as const;
export function BaseDiamond({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`game-base-diamond ${className}`}>
      <span className="game-base-diamond__line" aria-hidden="true" />
      {children}
    </div>
  );
}
