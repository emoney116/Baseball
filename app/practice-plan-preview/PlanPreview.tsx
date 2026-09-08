"use client";
import { useState } from "react";
import { PracticeTeamPlan, type PlanRequest } from "../components/PracticeTeamPlan";
import { combinePracticePlan, validatePlanExtraction, type PracticePlanItem } from "../lib/practicePlan";
import type { Practice } from "../types";
export function PlanPreview() {
  const [items, setItems] = useState<PracticePlanItem[]>([{ id: "existing", timeLabel: "3:00 PM", activity: "Existing Plan", shortDetail: null }]);
  const [revision, setRevision] = useState(0);
  const request: PlanRequest = async (method, body) => {
    if (method === "GET") return { items, revision };
    if (body?.action === "extract") return validatePlanExtraction({ warnings: ["Approximate time"], items: [
      ["325p", "Team Meeting", null], ["335p", "Warm Up", null], ["345/350p", "Throwing", null], ["405p", "Position Work", "IF / OF / C"], ["425p", "Hitting Rotations", "Live / Baserunning / Defense / Cages"], ["5p", "End", null],
    ].map(([timeLabel, activity, shortDetail]) => ({ timeLabel, activity, shortDetail })) });
    if (body?.revision !== revision) throw new Error("Plan changed.");
    const next = combinePracticePlan(items, body.items as PracticePlanItem[], body.mode); setItems(next); setRevision(revision + 1); return { items: next, revision: revision + 1 };
  };
  const practice = { id: "fixture", name: "Varsity Practice", date: "2026-09-08", teamPlan: items, teamPlanRevision: revision } as Practice;
  return <main style={{ maxWidth: 680, margin: "auto", padding: 16 }}><h1>Practice Plan Fixture</h1><PracticeTeamPlan practice={practice} canManage teamId="fixture" request={request} /><h2>Player View</h2><PracticeTeamPlan practice={practice} /></main>;
}
