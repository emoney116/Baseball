import type { createAdminClient } from "./supabase/admin";
import { assertPlayerLinkTeamManager, PlayerLinkError } from "./playerAccountLinks.ts";
import { combinePracticePlan, validatePlanItems } from "./practicePlan.ts";
type Database = ReturnType<typeof createAdminClient>;
export const PLAN_SELECTION = "id,team_id,season_id,organization_id,team_plan,team_plan_revision";
export async function countRecentPlanImports(db: Database, actor: string, since: string) {
  // JSONB containment needs JSON encoding, not the client's PostgreSQL array literal.
  return db.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("profile_id", actor).contains("safe_tool_names", JSON.stringify(["practice_plan_import"])).gte("created_at", since);
}
export async function authorizePracticePlan(db: Database, actor: string, teamId: string, practiceId: string) {
  await assertPlayerLinkTeamManager(db, actor, teamId);
  const { data, error } = await db.from("practices").select(PLAN_SELECTION).eq("id", practiceId).eq("team_id", teamId).single();
  if (error || !data) throw new PlayerLinkError("Save the Practice first, or check that the Team Plan migration is installed.", 409);
  return data;
}
export async function publishPracticePlan(db: Database, actor: string, input: { teamId: string; practiceId: string; revision: number; mode: unknown; items: unknown }) {
  const practice = await authorizePracticePlan(db, actor, input.teamId, input.practiceId);
  if (!Number.isSafeInteger(input.revision) || input.revision !== practice.team_plan_revision) throw new PlayerLinkError("This plan changed. Close review and reload before publishing.", 409);
  const items = combinePracticePlan(validatePlanItems(practice.team_plan), validatePlanItems(input.items), input.mode);
  const { data, error } = await db.from("practices").update({ team_plan: items, team_plan_revision: input.revision + 1, team_plan_published_by: actor, team_plan_published_at: new Date().toISOString() }).eq("id", practice.id).eq("team_id", input.teamId).eq("team_plan_revision", input.revision).select("team_plan,team_plan_revision").maybeSingle();
  if (error || !data) throw new PlayerLinkError("The plan changed or could not be saved. Reload before trying again.", 409);
  return { items: data.team_plan, revision: data.team_plan_revision };
}
