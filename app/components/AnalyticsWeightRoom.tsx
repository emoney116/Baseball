"use client";
import { useMemo, useState } from "react";
import type { AppData } from "../types";
import type { AnalyticsQuery } from "../lib/analyticsQuery";
import { resolveDateRange } from "../lib/analyticsQuery";
import { weightRoomAnalyticsRecords } from "../lib/weightRoomAnalytics";
import { ChoiceSelect } from "./ChoiceSelect";

export function AnalyticsWeightRoom({ data, query, playerIds }: { data: AppData; query: AnalyticsQuery; playerIds: string[] }) {
  const [exercise, setExercise] = useState("");
  const { start, end } = resolveDateRange(data, query);
  const records = useMemo(() => weightRoomAnalyticsRecords(data, { start, end, playerIds, eventIds: query.eventIds }), [data, start, end, playerIds, query.eventIds]);
  const exercises = [...new Set(records.map(r => r.entry.exercise))].sort();
  const visible = records.filter(r => !exercise || r.entry.exercise === exercise);
  return <section className="panel analytics-workout-results">
    <div className="analytics-workout-heading"><h2>Weight Room Results</h2><ChoiceSelect aria-label="Workout exercise" value={exercise} options={[{ value: "", label: "All exercises" }, ...exercises.map(value => ({ value, label: value }))]} onChange={setExercise} /></div>
    <p>{visible.length} recorded sets · {new Set(visible.map(r => r.entry.playerId)).size} athletes · {visible.reduce((sum, r) => sum + r.volume, 0).toLocaleString()} lb-reps</p>
    {/* Keyboard focus allows horizontal scrolling of the results on narrow screens. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    <div className="analytics-workout-scroll" role="region" aria-label="Weight Room saved results" tabIndex={0}>
      <table><thead><tr>{["Athlete", "Date", "Exercise", "Set", "Load", "Reps", "Result"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
        {visible.map(({ entry, date, measurement }) => <tr key={entry.id}>
          <td>{data.players.find(p => p.id === entry.playerId)?.name ?? "Athlete"}</td><td>{date}</td><td>{entry.exercise}</td><td>{entry.setNumber ?? 1}</td>
          <td>{measurement === "COMPLETION" || measurement === "TIME" || measurement === "REPS_ONLY" && entry.testConditions?.mode !== "FIXED_LOAD_TIMED_REPS" || entry.unit === "sec" ? "—" : entry.testConditions?.loadLb ?? entry.weight ?? "—"}</td><td>{measurement === "COMPLETION" || measurement === "TIME" || measurement === "WEIGHT_ONLY" || entry.unit === "sec" ? "—" : entry.reps ?? "—"}</td>
          <td>{measurement === "COMPLETION" ? entry.status ?? "Completed" : entry.unit === "sec" && entry.value !== undefined ? `${entry.value} sec` : entry.value !== undefined && entry.unit !== "lb" ? `${entry.value} ${entry.unit ?? ""}` : entry.weight === undefined && entry.reps === undefined ? "Complete · metrics not reported" : entry.status ?? "Recorded"}</td>
        </tr>)}
      </tbody></table>
      {!visible.length && <p>No recorded results for this selection.</p>}
    </div>
  </section>;
}
