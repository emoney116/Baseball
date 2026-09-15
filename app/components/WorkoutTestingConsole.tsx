"use client";

import { RefreshCw, RotateCw, Pencil, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { formatTestResult, parseTestResult, testConditionLabel, type WorkoutTestConditions } from "../lib/workoutTesting";
import type { Player } from "../types";
import { ClubhouseSelect } from "./ClubhouseSelect";
import { formatDensePlayerIdentity } from "../lib/densePlayerIdentity";
import { workoutStationSelection } from "../lib/workoutStationSelection";
import styles from "./WorkoutTestingConsole.module.css";

type Station = { id: string; exercise_name: string; test_conditions: WorkoutTestConditions | null };
type Group = { id: string; name: string; current_station_id: string | null };
type Result = { id: string; player_id: string; workout_station_id: string; reps: number | null; value: number | null; test_side: string | null; test_attempt: number; test_revision: number };
type Draft = { text: string; request: string; error?: string; resultId?: string; revision?: number; original?: number };

export function WorkoutTestingConsole({ workoutId, profileId, players, mode = "Groups", completedEdit = false }: { workoutId: string; profileId: string; players: Player[]; mode?: "Groups" | "Individual"; completedEdit?: boolean }) {
  const storageKey = `clubhouse:test-drafts:v1:${profileId}:${workoutId}`;
  const [stations, setStations] = useState<Station[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Array<{ group_id: string; player_id: string }>>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [stationId, setStationId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groupStations, setGroupStations] = useState<Record<string, { stationId: string; revision: number }>>({});
  const [side, setSide] = useState("Left");
  const [attempt, setAttempt] = useState("1");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      const restored: Record<string, Draft> = {};
      for (const [key, draft] of Object.entries(value)) {
        if (draft && typeof draft === "object" && "text" in draft && typeof draft.text === "string" && "request" in draft && typeof draft.request === "string") restored[key] = draft as Draft;
      }
      return restored;
    } catch { return {}; }
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [active, setActive] = useState<boolean | null>(null);
  const [canCorrect, setCanCorrect] = useState(false);
  const [revision, setRevision] = useState(0);
  const loading = useRef(false);
  const saving = useRef(new Set<string>());
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const focusAfterEdit = useRef<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(drafts)); }
    catch { /* In-memory drafts and explicit retries remain available. */ }
    if (focusAfterEdit.current) {
      inputs.current[focusAfterEdit.current]?.focus();
      focusAfterEdit.current = null;
    }
  }, [drafts, storageKey]);

  const refresh = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const db = createClient();
      const workout = await db.from("weight_room_workouts").select("status,ended_at,circuit_revision").eq("id", workoutId).single();
      if (workout.error) throw workout.error;
      const stationRows = await db.from("weight_room_workout_stations").select("id,exercise_name,test_conditions").eq("workout_id", workoutId).is("archived_at", null).order("display_order");
      const groupRows = await db.from("weight_room_workout_groups").select("id,name,current_station_id").eq("workout_id", workoutId).order("display_order");
      const memberRows = await db.from("weight_room_workout_group_members").select("group_id,player_id").eq("workout_id", workoutId).eq("participant_status", "ASSIGNED");
      for (const response of [stationRows, groupRows, memberRows]) if (response.error) throw response.error;
      const all: Result[] = [];
      for (let offset = 0; ; offset += 500) {
        const page = await db.from("workout_sets").select("id,player_id,workout_station_id,reps,value,test_side,test_attempt,test_revision").eq("active_workout_id", workoutId).not("test_conditions", "is", null).order("id").range(offset, offset + 499);
        if (page.error) throw page.error;
        all.push(...page.data as Result[]);
        if (page.data.length < 500) break;
      }
      setStations(stationRows.data ?? []);
      setGroups(groupRows.data ?? []);
      setMembers(memberRows.data ?? []);
      setResults(all);
      setActive(workout.data.status === "ACTIVE" && !workout.data.ended_at);
      setCanCorrect(workout.data.status === "ACTIVE" || (completedEdit && workout.data.status === "COMPLETED"));
      setRevision(workout.data.circuit_revision);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not refresh results. Your unsaved entries are still here.");
    } finally { loading.current = false; }
  }, [workoutId, completedEdit]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 4000);
    window.addEventListener("online", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("online", refresh); };
  }, [refresh]);

  const selectedGroup = mode === "Groups" ? groups.find((item) => item.id === groupId) ?? groups[0] : undefined;
  const selectedStationId = workoutStationSelection(selectedGroup, groupStations, revision, stationId);
  const station = stations.find((item) => item.id === selectedStationId) ?? stations[0];
  const conditions = station?.test_conditions;
  const roster = selectedGroup ? players.filter((player) => members.some((member) => member.group_id === selectedGroup.id && member.player_id === player.id)) : players;
  const keyFor = (playerId: string) => `${station?.id}:${playerId}:${attempt}:${conditions?.bilateral ? side : ""}`;

  function editResult(saved: Result) {
    focusAfterEdit.current = saved.player_id;
    setDrafts(current => ({ ...current, [keyFor(saved.player_id)]: { text: String(saved.value ?? saved.reps ?? ""), request: crypto.randomUUID(), resultId: saved.id, revision: saved.test_revision, original: Number(saved.value ?? saved.reps) } }));
  }

  async function save(playerId: string) {
    if (!station || !conditions) return;
    const key = keyFor(playerId);
    const draft = drafts[key];
    if (!draft || saving.current.has(key)) return;
    if (!draft.text.trim()) return;
    saving.current.add(key);
    setBusy(key);
    try {
      const value = parseTestResult(draft.text, conditions);
      if (value === undefined) throw new Error("Enter a result. Use 0 only for an attempted zero.");
      if (value !== draft.original) {
        const response = draft.resultId
          ? await createClient().rpc("correct_workout_test", { target_result: draft.resultId, expected_revision: draft.revision, request_id: draft.request, result_value: value, completed_edit: completedEdit })
          : await createClient().rpc("record_workout_test", { target_workout: workoutId, target_station: station.id, athlete: playerId, request_id: draft.request, result_value: value, attempt_number: Number(attempt), side: conditions.bilateral ? side : null });
        if (response.error) throw new Error(response.error.message);
      }
      setDrafts((current) => { const next = { ...current }; if(next[key]?.text === draft.text) delete next[key]; return next; });
      await refresh();
    } catch (failure) {
      setDrafts((current) => ({ ...current, [key]: { ...draft, error: failure instanceof Error ? failure.message : "Not saved. Retry when connected." } }));
    } finally { saving.current.delete(key); setBusy([...saving.current][0] ?? ""); }
  }

  async function rotate() {
    if (saving.current.size) return;
    saving.current.add("rotation");
    setBusy("rotation");
    try {
      const response = await createClient().rpc("rotate_workout_circuit", { target_workout: workoutId, expected_revision: revision });
      if (response.error) throw new Error(response.error.message);
      await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Rotation was not saved."); }
    finally { saving.current.delete("rotation"); setBusy(""); }
  }

  return <section className={styles.console} aria-label="Testing circuit">
    <aside className={styles.navigation}>
      <div className={`${styles.pickers} ${mode === "Individual" ? styles.individual : ""}`}>
      {mode === "Groups" ? <ClubhouseSelect label="Group" value={selectedGroup?.id ?? ""} options={groups.map((group) => ({ value: group.id, label: group.name }))} onChange={setGroupId} /> : null}
      <ClubhouseSelect label="Station" value={station?.id ?? ""} options={stations.map((item) => ({ value: item.id, label: item.exercise_name }))} onChange={(id) => {
        if (selectedGroup) setGroupStations(current => ({ ...current, [selectedGroup.id]: { stationId: id, revision } }));
        else setStationId(id);
      }} />
      <label className={styles.attempt}>Attempt<input aria-label="Attempt" type="number" min={1} max={100} value={attempt} onChange={(event) => setAttempt(event.target.value)} /></label>
      </div>
      {conditions?.bilateral && <ClubhouseSelect label="Side" value={side} options={[{ value: "Left", label: "Left" }, { value: "Right", label: "Right" }]} onChange={setSide} />}
      <div className={styles.actions}>
        {mode === "Groups" && <button type="button" aria-label="Next Rotation" title="Next Rotation" disabled={!active || !!busy || !groups.length} onClick={() => void rotate()}><RotateCw size={18} />Next Rotation</button>}
        <button type="button" aria-label="Refresh results" title="Refresh results" onClick={() => void refresh()}><RefreshCw size={18} />Refresh</button>
      </div>
    </aside>
    <div className={styles.entries}>
      <header><h2>{station?.exercise_name ?? "Testing Circuit"}</h2><span>{conditions && testConditionLabel(conditions)}</span></header>
      {error && <p role="alert">{error}</p>}
      {active === null && <p role="status">Loading workout...</p>}
      {active === false && <p role="status">Workout is not active. Saved results are preserved.</p>}
      {conditions && roster.map((player) => {
        const key = keyFor(player.id);
        const saved = results.find((result) => result.player_id === player.id && result.workout_station_id === station.id && result.test_attempt === Number(attempt) && result.test_side === (conditions.bilateral ? side : null));
        const draft = drafts[key];
        return <div key={key} className={styles.row}>
        <strong>{formatDensePlayerIdentity(player)}</strong>
          {saved && !draft ? <button type="button" className={styles.saved} aria-label={`Edit ${player.name} result`} title="Edit result" disabled={!canCorrect} onClick={() => editResult(saved)}>{formatTestResult(saved.value ?? saved.reps, conditions)}<Pencil size={14} /></button> : <form onSubmit={(event) => { event.preventDefault(); inputs.current[player.id]?.blur(); }}>
            <input ref={(element) => { inputs.current[player.id] = element; }} aria-label={`${player.name} result`} inputMode={conditions.mode === "MAX_DURATION" ? "decimal" : "numeric"} placeholder={conditions.mode === "MAX_DURATION" ? "Seconds" : "Reps"} value={draft?.text ?? ""} disabled={!(draft?.resultId ? canCorrect : active) || saving.current.has(key)} onBlur={() => void save(player.id)} onChange={(event) => { const text = event.target.value; setDrafts((current) => ({ ...current, [key]: { ...current[key], text, request: current[key]?.request ?? crypto.randomUUID(), error: undefined } })); }} />
            {draft?.resultId && <button type="button" aria-label={`Cancel editing ${player.name}`} title="Cancel edit" onPointerDown={(event) => event.preventDefault()} onClick={() => setDrafts((current) => {const next={...current};delete next[key];return next;})}><X size={16} /></button>}
          </form>}
          {saving.current.has(key) && <p role="status">Saving...</p>}
          {draft?.error && <p role="alert">{draft.error} <button type="button" onClick={() => void save(player.id)}>Retry</button>{saved && <button type="button" onClick={() => {setDrafts((current)=>{const next={...current};delete next[key];return next;});void refresh();}}>Use latest</button>}</p>}
        </div>;
      })}
    </div>
  </section>;
}
