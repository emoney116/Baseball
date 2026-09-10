import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { BpState } from "../lib/liveBp";
import { BpBases, BpSegments, type BpSheet } from "./LiveBpControls";
import styles from "./LiveBpConsole.module.css";

export function LiveBpCorrections({
  state,
  trackedCount,
  game,
  disabled,
  onSave,
  sheet,
}: {
  state: BpState;
  trackedCount: boolean;
  game: boolean;
  disabled: boolean;
  onSave: (state: BpState) => void;
  sheet: BpSheet;
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<BpState | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  function save(next: BpState) {
    onSave(next);
    setOpen(false);
    setEdit(null);
    trigger.current?.focus();
  }
  function editor() {
    setEdit({ ...state, runners: [...state.runners] });
    setOpen(false);
  }
  return (
    <div
      ref={root}
      className={styles.corrections}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label="Adjust count and bases"
        title="Adjust count and bases"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal size={18} />
      </button>
      {open && (
        <div
          className={styles.correctionMenu}
          role="group"
          aria-label="Session corrections"
        >
          <button
            type="button"
            disabled
            title="Undo requires reversing all linked pitch stats"
          >
            Undo last pitch (unavailable)
          </button>
          {trackedCount && (
            <button
              type="button"
              disabled={disabled || (!state.balls && !state.strikes)}
              onClick={() => save({ ...state, balls: 0, strikes: 0 })}
            >
              Reset count
            </button>
          )}
          {game && (
            <>
              <button
                type="button"
                disabled={disabled || !state.outs}
                onClick={() => save({ ...state, outs: 0 })}
              >
                Reset outs
              </button>
              <button
                type="button"
                disabled={disabled || !state.runners.length}
                onClick={() => save({ ...state, runners: [] })}
              >
                Clear bases
              </button>
              <button type="button" disabled={disabled} onClick={editor}>
                Add or remove runners
              </button>
            </>
          )}
          {(trackedCount || game) && (
            <button type="button" disabled={disabled} onClick={editor}>
              {trackedCount && game
                ? "Set count / outs"
                : trackedCount
                  ? "Set count"
                  : "Set outs"}
            </button>
          )}
        </div>
      )}
      {edit &&
        sheet(
          "Edit situation",
          () => setEdit(null),
          <fieldset className={styles.setup} disabled={disabled}>
            {[
              ...(trackedCount ? (["balls", "strikes"] as const) : []),
              ...(game ? (["outs"] as const) : []),
            ].map((key) => (
              <BpSegments
                key={key}
                label={key[0].toUpperCase() + key.slice(1)}
                value={String(edit[key])}
                options={Array.from(
                  { length: key === "balls" ? 4 : 3 },
                  (_, n) => ({ value: String(n), label: String(n) }),
                )}
                onChange={(value) => setEdit({ ...edit, [key]: Number(value) })}
              />
            ))}
            {game && (
              <BpBases
                runners={edit.runners}
                onChange={(runners) => setEdit({ ...edit, runners })}
              />
            )}
            <button
              type="button"
              className="primary-button"
              onClick={() => save(edit)}
            >
              Save situation
            </button>
          </fieldset>,
        )}
    </div>
  );
}
