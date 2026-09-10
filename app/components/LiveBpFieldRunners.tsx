import { useRef, useState } from "react";
import type { Player } from "../types";
import type { BpState } from "../lib/liveBp";
import { BP_RUNNER_REASONS, type BpRunnerMove } from "../lib/liveBpRunnerMove";
import { ChoiceSelect } from "./ChoiceSelect";
import { BpSegments, type BpSheet } from "./LiveBpControls";
import styles from "./LiveBpConsole.module.css";

const BASES = [
  { base: 1, x: 71, y: 68 },
  { base: 2, x: 50, y: 49 },
  { base: 3, x: 29, y: 68 },
  { base: 4, x: 50, y: 89 },
];
export function LiveBpFieldRunners({
  state,
  players,
  disabled,
  onMove,
  sheet,
}: {
  state: BpState;
  players: Player[];
  disabled: boolean;
  onMove: (move: BpRunnerMove) => void;
  sheet: BpSheet;
}) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ base: number; x: number; y: number } | null>(null);
  const moved = useRef(false);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [pending, setPending] = useState<{ from: number; to: number } | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState("safe");
  const [action, setAction] = useState("move");
  const [replacement, setReplacement] = useState("");
  function propose(from: number, to: number) {
    if (to < from || (to !== from && state.runners.includes(to))) return;
    setPending({ from, to });
    setReason("");
    setOutcome("safe");
    setAction("move");
    setReplacement("");
  }
  return (
    <div ref={root} className={styles.fieldRunners}>
      {BASES.map(({ base, x, y }) => {
        const occupied = state.runners.includes(base);
        const player = players.find((p) => p.id === state.runnerIds?.[base]);
        const label = base === 4 ? "Home" : `${base}B`;
        return (
          <button
            key={base}
            type="button"
            style={{ left: `${x}%`, top: `${y}%` }}
            className={styles.runnerBase}
            data-occupied={occupied}
            disabled={disabled || !occupied}
            aria-label={`${label} runner: ${occupied ? (player?.name ?? "Unnamed runner") : "Empty"}`}
            onPointerDown={(event) => {
              if (!occupied) return;
              moved.current = false;
              drag.current = { base, x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              if (
                Math.hypot(
                  event.clientX - drag.current.x,
                  event.clientY - drag.current.y,
                ) > 8
              )
                moved.current = true;
              const rect = root.current?.getBoundingClientRect();
              if (rect && moved.current)
                setDragPoint({
                  x: event.clientX - rect.left,
                  y: event.clientY - rect.top,
                });
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDragPoint(null);
            }}
            onPointerUp={(event) => {
              const from = drag.current?.base;
              const rect = root.current?.getBoundingClientRect();
              if (from && rect && moved.current) {
                const target = BASES.find(
                  (b) =>
                    Math.hypot(
                      event.clientX - rect.left - (rect.width * b.x) / 100,
                      event.clientY - rect.top - (rect.height * b.y) / 100,
                    ) < 38,
                );
                if (target) propose(from, target.base);
              }
              drag.current = null;
              setDragPoint(null);
            }}
            onClick={() => {
              if (moved.current) {
                moved.current = false;
                return;
              }
              propose(base, base);
            }}
          >
            <span>{label}</span>
            <strong>
              {occupied
                ? player
                  ? `${player.jerseyNumber > 0 ? `#${player.jerseyNumber} ` : ""}${player.name.split(" ").slice(1).join(" ") || player.name}`
                  : "Runner"
                : ""}
            </strong>
          </button>
        );
      })}
      {dragPoint && (
        <span
          className={styles.runnerDrag}
          style={{ left: dragPoint.x, top: dragPoint.y }}
        >
          Runner
        </span>
      )}
      {pending &&
        sheet(
          "Runner actions",
          () => setPending(null),
          <fieldset className={styles.setup} disabled={disabled}>
            <BpSegments
              label="Action"
              value={action}
              options={[
                { value: "move", label: "Move / safe / out" },
                { value: "substitute", label: "Pinch runner" },
              ]}
              onChange={setAction}
            />
            {action === "substitute" ? (
              <ChoiceSelect
                label="Pinch runner"
                value={replacement}
                options={[
                  { value: "", label: "Select player" },
                  ...players
                    .filter(
                      (p) =>
                        !p.archived &&
                        !Object.values(state.runnerIds ?? {}).includes(p.id),
                    )
                    .map((p) => ({ value: p.id, label: p.name })),
                ]}
                onChange={setReplacement}
              />
            ) : (
              <>
                <BpSegments
                  label="Destination"
                  value={String(pending.to)}
                  options={BASES.filter(
                    (b) =>
                      b.base === pending.from ||
                      (b.base > pending.from &&
                        !state.runners.includes(b.base)),
                  ).map((b) => ({
                    value: String(b.base),
                    label: b.base === 4 ? "Home" : `${b.base}B`,
                  }))}
                  onChange={(value) =>
                    setPending({ ...pending, to: Number(value) })
                  }
                />
                <BpSegments
                  label="Runner result"
                  value={outcome}
                  options={[
                    { value: "safe", label: "Safe" },
                    { value: "out", label: "Out" },
                  ]}
                  onChange={(value) => {
                    setOutcome(value);
                    setReason("");
                  }}
                />
                <BpSegments
                  label="Movement reason"
                  value={reason}
                  options={[
                    ...BP_RUNNER_REASONS.filter(
                      (value) =>
                        value !== "Pinch runner" &&
                        (outcome === "out" ||
                          !["Picked off", "Caught stealing"].includes(value)),
                    ).map((value) => ({ value, label: value })),
                  ]}
                  onChange={setReason}
                />
              </>
            )}
            <button
              className="primary-button"
              type="button"
              disabled={action === "substitute" ? !replacement : !reason}
              onClick={() => {
                onMove(
                  action === "substitute"
                    ? {
                        from: pending.from,
                        to: pending.from,
                        reason: "Pinch runner",
                        replacementRunnerId: replacement,
                        outcome: "safe",
                      }
                    : {
                        ...pending,
                        reason: reason as BpRunnerMove["reason"],
                        outcome: outcome as "safe" | "out",
                      },
                );
                setPending(null);
              }}
            >
              Confirm runner action
            </button>
          </fieldset>,
        )}
    </div>
  );
}
