import { useRef, useState, type PointerEvent } from "react";
import { Eraser, Undo2 } from "lucide-react";
import type { Player } from "../types";
import {
  BP_POSITIONS,
  BP_BATTER_OUT_RESULTS,
  BP_PLAY_RUNNER_REASONS,
  bpPositionTracked,
  type BpSettings,
  type BpState,
  type BpDraft,
  type BpPosition,
} from "../lib/liveBp";
import { CLUBHOUSE_FIELD_POSITION_COORDINATES } from "../lib/baseballFieldLayout";
import { canonicalPointToLegacyGame } from "../lib/sprayChart";
import { ClubhouseBaseballField } from "./ClubhouseBaseballField";
import { BpSegments } from "./LiveBpControls";
import { ChoiceSelect } from "./ChoiceSelect";
import { liveBpFieldLabel } from "../lib/liveBpFieldLabel";
import styles from "./LiveBpConsole.module.css";

export function LiveBpPlayResolution({
  settings,
  state,
  draft,
  players,
  onChange,
}: {
  settings: BpSettings;
  state: BpState;
  draft: BpDraft;
  players: Player[];
  onChange: (draft: BpDraft) => void;
}) {
  const [view, setView] = useState(
    settings.defense !== "OFF" ? "defense" : "runners",
  );
  const [runner, setRunner] = useState(state.runners[0] ?? 0);
  const [target, setTarget] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    key: number | BpPosition;
    x: number;
    y: number;
  } | null>(null);
  const moved = useRef(false);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const sequence =
    draft.fieldingSequence ?? (draft.position ? [draft.position] : []);
  const ball = draft.spray
    ? canonicalPointToLegacyGame(draft.spray)
    : undefined;
  const key = runner === 0 ? "batter" : String(runner);
  const baseCoords: Record<number, readonly [number, number]> = {
    0: [50, 90],
    1: [71, 68],
    2: [50, 49],
    3: [29, 68],
    4: [50, 89],
  };
  const runnerLabel = runner === 0 ? "Batter" : `${runner}B runner`;
  function outcomeFor(base: number) {
    return (
      draft.runnerOutcomes?.[base === 0 ? "batter" : base] ??
      (draft.result === "Home Run"
        ? "score"
        : base
          ? String(base)
          : BP_BATTER_OUT_RESULTS.includes(draft.result ?? "")
            ? "out"
            : draft.result === "Double"
              ? "2"
              : draft.result === "Triple"
                ? "3"
                : "1")
    );
  }
  function selectFielder(position: BpPosition) {
    if (sequence.length >= 20 || sequence.at(-1) === position) return;
    onChange({
      ...draft,
      position:
        draft.position ??
        (bpPositionTracked(settings, position) && settings.alignment[position]
          ? position
          : undefined),
      fieldingSequence: [...sequence, position],
    });
  }
  function gradeFielder(position: BpPosition | undefined) {
    if (position === draft.position) return;
    onChange({
      ...draft,
      position,
      defenseResult: undefined,
      errorType: undefined,
      throwResult: undefined,
    });
  }
  function undoFielder() {
    const next = sequence.slice(0, -1);
    const keepGrade = draft.position && next.includes(draft.position);
    onChange({
      ...draft,
      fieldingSequence: next,
      ...(!keepGrade
        ? {
            position: undefined,
            defenseResult: undefined,
            errorType: undefined,
            throwResult: undefined,
          }
        : {}),
    });
  }
  function start(event: PointerEvent<HTMLButtonElement>) {
    const key =
      (event.currentTarget.dataset.position as BpPosition | undefined) ??
      Number(event.currentTarget.dataset.runner);
    moved.current = false;
    drag.current = { key, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const rect = root.current?.getBoundingClientRect();
    if (!drag.current || !rect) return;
    if (
      Math.hypot(
        event.clientX - drag.current.x,
        event.clientY - drag.current.y,
      ) > 8
    )
      moved.current = true;
    if (moved.current)
      setDragPoint({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
  }
  function finish(event: PointerEvent<HTMLButtonElement>) {
    const rect = root.current?.getBoundingClientRect();
    const source = drag.current?.key;
    if (source !== undefined && rect && moved.current) {
      const x = event.clientX - rect.left,
        y = event.clientY - rect.top;
      if (typeof source === "number") {
        const destination = [1, 2, 3, 4].find(
          (b) =>
            Math.hypot(
              x - (rect.width * baseCoords[b][0]) / 100,
              y - (rect.height * baseCoords[b][1]) / 100,
            ) < 38,
        );
        if (destination) {
          setRunner(source);
          setTarget(destination);
        }
      } else if (
        ball &&
        Math.hypot(x - rect.width * ball.x, y - rect.height * ball.y) < 44
      )
        selectFielder(source);
    }
    drag.current = null;
    setDragPoint(null);
  }
  const currentOutcome =
    draft.runnerOutcomes?.[key] ??
    (draft.result === "Home Run"
      ? "score"
      : runner
        ? String(runner)
        : BP_BATTER_OUT_RESULTS.includes(draft.result ?? "")
          ? "out"
          : draft.result === "Double"
            ? "2"
            : draft.result === "Triple"
              ? "3"
              : "1");
  const destination =
    target ??
    (currentOutcome === "score" ? 4 : Number(currentOutcome) || runner || 1);
  function setOutcome(outcome: string) {
    onChange({
      ...draft,
      runnerOutcomes: { ...draft.runnerOutcomes, [key]: outcome },
      runnerReasons: { ...draft.runnerReasons, [key]: "On last play" },
    });
  }
  return (
    <div className={styles.playResolution}>
      <BpSegments
        label="Play resolution"
        value={view}
        options={[
          { value: "defense", label: "Defense" },
          ...(settings.mode === "GAME"
            ? [{ value: "runners", label: "Runners" }]
            : []),
        ]}
        onChange={setView}
      />
      {view === "runners" && (
        <div className={styles.runnerChoices} aria-label="Select play runner">
          {[0, ...state.runners].map((base) => (
            <button
              key={base}
              type="button"
              aria-pressed={runner === base}
              onClick={() => {
                setRunner(base);
                setTarget(null);
              }}
            >
              {base === 0 ? "Batter" : `${base}B runner`} ·{" "}
              {outcomeFor(base) === "out"
                ? "Out"
                : outcomeFor(base) === "score"
                  ? "Home"
                  : `${outcomeFor(base)}B`}
            </button>
          ))}
        </div>
      )}
      <div ref={root} className={styles.resolutionField}>
        <ClubhouseBaseballField
          coordinateSpace="practice"
          activePoint={draft.spray}
          showLabels={false}
          showEmptyState={false}
          ariaLabel="Resolve ball in play"
        />
        {view === "defense"
          ? BP_POSITIONS.map((position) => {
              const [x, y] = CLUBHOUSE_FIELD_POSITION_COORDINATES[position];
              return (
                <button
                  key={position}
                  type="button"
                  className={`${styles.resolutionPosition} ${styles.resolutionFielder}`}
                  data-tracked={
                    Boolean(settings.alignment[position]) &&
                    bpPositionTracked(settings, position)
                  }
                  style={{ left: `${x}%`, top: `${y}%` }}
                  aria-pressed={sequence.includes(position)}
                  aria-label={`Fielder ${position}`}
                  title={`${position}${settings.alignment[position] ? ` - ${liveBpFieldLabel(settings, players, position)}` : ""}`}
                  data-position={position}
                  onPointerDown={start}
                  onPointerMove={move}
                  onPointerUp={finish}
                  onPointerCancel={() => {
                    drag.current = null;
                    setDragPoint(null);
                  }}
                  onClick={() => {
                    if (!moved.current) selectFielder(position);
                  }}
                >
                  {position}
                  {settings.alignment[position] &&
                  bpPositionTracked(settings, position)
                    ? ` · ${liveBpFieldLabel(settings, players, position)}`
                    : ""}
                </button>
              );
            })
          : [0, ...state.runners].map((base) => {
              const result = outcomeFor(base);
              if (result === "out" || result === "score") return null;
              const occupants = [0, ...state.runners].filter(
                (other) => outcomeFor(other) === result,
              );
              const visibleRunner = occupants.includes(runner)
                ? runner
                : occupants[0];
              if (base !== visibleRunner) return null;
              const [x, y] = baseCoords[Number(result) || base];
              const name = players.find(
                (p) =>
                  p.id ===
                  (base === 0 ? settings.hitterId : state.runnerIds?.[base]),
              )?.name;
              return (
                <button
                  key={base}
                  type="button"
                  className={styles.resolutionPosition}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  aria-pressed={runner === base}
                  data-runner={base}
                  onPointerDown={start}
                  onPointerMove={move}
                  onPointerUp={finish}
                  onPointerCancel={() => {
                    drag.current = null;
                    setDragPoint(null);
                  }}
                  onClick={() => {
                    if (!moved.current) {
                      setRunner(base);
                      setTarget(null);
                    }
                  }}
                  title={name}
                >
                  {occupants.length > 1 ? (
                    `${occupants.length} runners at ${result}B`
                  ) : (
                    <>
                      {base === 0 ? "Batter" : `${base}B`} ·{" "}
                      {name?.split(" ").slice(1).join(" ") || name || "Runner"}
                    </>
                  )}
                </button>
              );
            })}
        {view === "runners" &&
          [1, 2, 3, 4].map((base) => (
            <button
              key={base}
              type="button"
              className={styles.resolutionTarget}
              style={{
                left: `${baseCoords[base][0]}%`,
                top: `${baseCoords[base][1]}%`,
              }}
              aria-label={`Runner destination ${base === 4 ? "Home" : `${base}B`}`}
              onClick={() => setTarget(base)}
            >
              {base === 4 ? "Home" : `${base}B`}
            </button>
          ))}
        {dragPoint && (
          <span
            className={styles.runnerDrag}
            style={{ left: dragPoint.x, top: dragPoint.y }}
          >
            {view === "defense" ? "Fielder" : "Runner"}
          </span>
        )}
      </div>
      {view === "defense" && (
        <>
          <div className={styles.fieldSequence} aria-label="Fielding sequence">
            <div className={styles.sequencePlayers}>
              {sequence.length
                ? sequence.map((position, index) => (
                    <span key={`${position}-${index}`}>
                      {index > 0 && " → "}
                      <button
                        type="button"
                        disabled={
                          !bpPositionTracked(settings, position) ||
                          !settings.alignment[position]
                        }
                        aria-pressed={draft.position === position}
                        aria-label={`Grade ${position} ${liveBpFieldLabel(settings, players, position)}`}
                        title={`Grade ${position} ${liveBpFieldLabel(settings, players, position)}`}
                        onClick={() => gradeFielder(position)}
                      >
                        {position}
                      </button>
                    </span>
                  ))
                : "No defensive rep"}
            </div>
            {draft.position && (
              <button
                type="button"
                className="icon-button"
                aria-label="Clear defensive grade"
                title="Clear defensive grade"
                onClick={() => gradeFielder(undefined)}
              >
                <Eraser size={16} />
              </button>
            )}
            {sequence.length > 0 && (
              <button
                type="button"
                className="icon-button"
                aria-label="Undo last fielder"
                title="Undo last fielder"
                onClick={undoFielder}
              >
                <Undo2 size={16} />
              </button>
            )}
          </div>
          {draft.position && (
            <div className={styles.inputs}>
              <ChoiceSelect
                label={`${draft.position} fielding result`}
                value={draft.defenseResult ?? ""}
                options={[
                  { value: "", label: "Select result" },
                  ...["Clean", "Missed Rep", "Error", "Great Play"].map(
                    (value) => ({ value, label: value }),
                  ),
                ]}
                onChange={(value) =>
                  onChange({ ...draft, defenseResult: value })
                }
              />
              <ChoiceSelect
                label="Throw"
                value={draft.throwResult ?? "No Throw"}
                options={["No Throw", "Accurate", "Inaccurate"].map(
                  (value) => ({ value, label: value }),
                )}
                onChange={(value) => onChange({ ...draft, throwResult: value })}
              />
              {draft.defenseResult === "Error" && (
                <ChoiceSelect
                  label="Error type"
                  value={draft.errorType ?? ""}
                  options={[
                    { value: "", label: "Select error" },
                    ...["Fielding", "Throwing", "Decision"].map((value) => ({
                      value,
                      label: value,
                    })),
                  ]}
                  onChange={(value) => onChange({ ...draft, errorType: value })}
                />
              )}
            </div>
          )}
        </>
      )}
      {view === "runners" && (
        <div className={styles.runnerDecision}>
          <strong>
            {runnerLabel} · {destination === 4 ? "Home" : `${destination}B`}
          </strong>
          <div className={styles.runnerChoices} aria-label="Runner decision">
            <button
              type="button"
              aria-pressed={
                currentOutcome ===
                (destination === 4 ? "score" : String(destination))
              }
              onClick={() =>
                setOutcome(destination === 4 ? "score" : String(destination))
              }
            >
              Safe
            </button>
            <button
              type="button"
              aria-pressed={currentOutcome === "out"}
              onClick={() => setOutcome("out")}
            >
              Out
            </button>
            {runner > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTarget(runner);
                  setOutcome(String(runner));
                }}
              >
                Back to {runner}B
              </button>
            )}
          </div>
          <div className={styles.runnerChoices} aria-label="Runner play reason">
            {BP_PLAY_RUNNER_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                aria-pressed={
                  (draft.runnerReasons?.[key] ?? "On last play") === reason
                }
                onClick={() =>
                  onChange({
                    ...draft,
                    runnerReasons: { ...draft.runnerReasons, [key]: reason },
                  })
                }
              >
                {reason}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
