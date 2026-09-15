"use client";

import { Check, RefreshCw, RotateCw, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { formatTestResult, parseTestResult, testConditionLabel, type WorkoutTestConditions } from "../lib/workoutTesting";
import type { Player } from "../types";
import { ClubhouseSelect } from "./ClubhouseSelect";
import styles from "./WorkoutTestingConsole.module.css";

type Station = { id: string; exercise_name: string; test_conditions: WorkoutTestConditions | null };
type Group = { id: string; name: string; current_station_id: string | null };
type Result = { id: string; player_id: string; workout_station_id: string; reps: number | null; value: number | null; test_side: string | null; test_attempt: number };
type Draft = { text: string; request: string; error?: string };

export function WorkoutTestingConsole({ workoutId, profileId, players }: { workoutId: string; profileId: string; players: Player[] }) {
  const storageKey = `clubhouse:test-drafts:v1:${profileId}:${workoutId}`;
  const [stations, setStations] = useState<Station[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Array<{ group_id: string; player_id: string }>>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [stationId, setStationId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [side, setSide] = useState("Left");
  const [attempt, setAttempt] = useState("1");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      const restored: Record<string, Draft> = {};
      for (const [key, draft] of Object.entries(value)) {
        if (draft && typeof draft === "object" && "text" in draft && typeof draft.text === "string" && "request" in draft && typeof draft.request === "string") restored[key] = { text: draft.text, request: draft.request };
      }
      return restored;
    } catch { return {}; }
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);
  const [revision, setRevision] = useState(0);
  const loading = useRef(false);
  const saving = useRef(false);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(drafts)); }
    catch { /* In-memory drafts and explicit retries remain available. */ }
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
        const page = await db.from("workout_sets").select("id,player_id,workout_station_id,reps,value,test_side,test_attempt").eq("active_workout_id", workoutId).not("test_conditions", "is", null).order("id").range(offset, offset + 499);
        if (page.error) throw page.error;
        all.push(...page.data as Result[]);
        if (page.data.length < 500) break;
      }
      setStations(stationRows.data ?? []);
      setGroups(groupRows.data ?? []);
      setMembers(memberRows.data ?? []);
      setResults(all);
      setActive(workout.data.status === "ACTIVE" && !workout.data.ended_at);
      setRevision(workout.data.circuit_revision);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not refresh results. Your unsaved entries are still here.");
    } finally { loading.current = false; }
  }, [workoutId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 4000);
    window.addEventListener("online", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("online", refresh); };
  }, [refresh]);

  const station = stations.find((item) => item.id === stationId) ?? stations[0];
  const conditions = station?.test_conditions;
  const roster = groupId ? players.filter((player) => members.some((member) => member.group_id === groupId && member.player_id === player.id)) : players;
  const keyFor = (playerId: string) => `${station?.id}:${playerId}:${attempt}:${conditions?.bilateral ? side : ""}`;

  async function save(playerId: string) {
    if (!station || !conditions || saving.current) return;
    const key = keyFor(playerId);
    const draft = drafts[key];
    if (!draft) return;
    saving.current = true;
    setBusy(key);
    try {
      const value = parseTestResult(draft.text, conditions);
      if (value === undefined) throw new Error("Enter a result. Use 0 only for an attempted zero.");
      const response = await createClient().rpc("record_workout_test", { target_workout: workoutId, target_station: station.id, athlete: playerId, request_id: draft.request, result_value: value, attempt_number: Number(attempt), side: conditions.bilateral ? side : null });
      if (response.error) throw new Error(response.error.message);
      setDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
      await refresh();
      const nextPlayer = roster[roster.findIndex((player) => player.id === playerId) + 1];
      if (nextPlayer) inputs.current[nextPlayer.id]?.focus();
    } catch (failure) {
      setDrafts((current) => ({ ...current, [key]: { ...draft, error: failure instanceof Error ? failure.message : "Not saved. Retry when connected." } }));
    } finally { saving.current = false; setBusy(""); }
  }

  async function rotate() {
    if (saving.current) return;
    saving.current = true;
    setBusy("rotation");
    try {
      const response = await createClient().rpc("rotate_workout_circuit", { target_workout: workoutId, expected_revision: revision });
      if (response.error) throw new Error(response.error.message);
      await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Rotation was not saved."); }
    finally { saving.current = false; setBusy(""); }
  }

  return <section className={styles.console} aria-label="Testing circuit">
    <aside className={styles.navigation}>
      <ClubhouseSelect label="Station" value={station?.id ?? ""} options={stations.map((item) => ({ value: item.id, label: item.exercise_name }))} onChange={setStationId} />
      <ClubhouseSelect label="Group" value={groupId} options={[{ value: "", label: "All athletes" }, ...groups.map((group) => ({ value: group.id, label: group.name, description: stations.find((item) => item.id === group.current_station_id)?.exercise_name }))]} onChange={setGroupId} />
      {conditions?.bilateral && <ClubhouseSelect label="Side" value={side} options={[{ value: "Left", label: "Left" }, { value: "Right", label: "Right" }]} onChange={setSide} />}
      <label className={styles.attempt}>Attempt<input aria-label="Attempt" type="number" min={1} max={100} value={attempt} onChange={(event) => setAttempt(event.target.value)} /></label>
      <button type="button" disabled={!active || !!busy || !groups.length} onClick={() => void rotate()}><RotateCw size={18} />Next Rotation</button>
      <button type="button" onClick={() => void refresh()}><RefreshCw size={18} />Refresh</button>
    </aside>
    <div className={styles.entries}>
      <header><h2>{station?.exercise_name ?? "Testing Circuit"}</h2><span>{conditions && testConditionLabel(conditions)}</span></header>
      {error && <p role="alert">{error}</p>}
      {!active && <p role="status">Workout is not active. Saved results are preserved.</p>}
      {conditions && roster.map((player) => {
        const key = keyFor(player.id);
        const saved = results.find((result) => result.player_id === player.id && result.workout_station_id === station.id && result.test_attempt === Number(attempt) && result.test_side === (conditions.bilateral ? side : null));
        const draft = drafts[key];
        return <div key={key} className={styles.row}>
        <strong>{player.name}</strong>
          {saved ? <span className={styles.saved}><Check size={18} aria-label="Saved" />{formatTestResult(saved.value ?? saved.reps, conditions)}</span> : <form onSubmit={(event) => { event.preventDefault(); void save(player.id); }}>
            <input ref={(element) => { inputs.current[player.id] = element; }} aria-label={`${player.name} result`} inputMode={conditions.mode === "MAX_DURATION" ? "decimal" : "numeric"} placeholder={conditions.mode === "MAX_DURATION" ? "Seconds" : "Reps"} value={draft?.text ?? ""} disabled={!active || busy === key} onChange={(event) => { const text = event.target.value; setDrafts((current) => ({ ...current, [key]: { text, request: current[key]?.request ?? crypto.randomUUID() } })); }} />
            <button aria-label={`Save ${player.name}`} title="Save result" disabled={!active || !!busy || !draft?.text.trim()}><Save size={18} /></button>
          </form>}
          {draft?.error && <p role="alert">{draft.error}</p>}
        </div>;
      })}
    </div>
  </section>;
}
