import { useRef, useState } from "react";
import type { Player } from "../types";
import type { BpState } from "../lib/liveBp";
import { BP_RUNNER_REASONS, type BpRunnerMove } from "../lib/liveBpRunnerMove";
import { ChoiceSelect } from "./ChoiceSelect";
import type { BpSheet } from "./LiveBpControls";
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
  function propose(from: number, to: number) {
    if (to <= from || state.runners.includes(to)) return;
    setPending({ from, to });
    setReason("");
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
              const to = BASES.find(
                (b) => b.base > base && !state.runners.includes(b.base),
              );
              if (to) propose(base, to.base);
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
          "Move runner",
          () => setPending(null),
          <fieldset className={styles.setup} disabled={disabled}>
            <ChoiceSelect
              label="Destination"
              value={String(pending.to)}
              options={BASES.filter(
                (b) => b.base > pending.from && !state.runners.includes(b.base),
              ).map((b) => ({
                value: String(b.base),
                label: b.base === 4 ? "Home" : `${b.base}B`,
              }))}
              onChange={(value) =>
                setPending({ ...pending, to: Number(value) })
              }
            />
            <ChoiceSelect
              label="Movement reason"
              value={reason}
              options={[
                { value: "", label: "Select reason" },
                ...BP_RUNNER_REASONS.map((value) => ({ value, label: value })),
              ]}
              onChange={setReason}
            />
            <button
              className="primary-button"
              type="button"
              disabled={!reason}
              onClick={() => {
                onMove({
                  ...pending,
                  reason: reason as BpRunnerMove["reason"],
                });
                setPending(null);
              }}
            >
              Confirm advance
            </button>
          </fieldset>,
        )}
    </div>
  );
}
