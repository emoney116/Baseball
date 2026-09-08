import type { createAdminClient } from "./supabase/admin";
import { assertPlayerLinkTeamManager, PlayerLinkError } from "./playerAccountLinks.ts";

export async function renamePractice(db: ReturnType<typeof createAdminClient>, actor: string, input: {
  teamId: string; practiceId: string; name: string; expectedName: string;
}) {
  const name = input.name.trim();
  if (!name || name.length > 120 || [...name].some(char => char.charCodeAt(0) < 32)) throw new PlayerLinkError("Enter a Practice name of 1-120 characters.");
  await assertPlayerLinkTeamManager(db, actor, input.teamId);
  const { data, error } = await db.from("practices").update({ name })
    .eq("id", input.practiceId).eq("team_id", input.teamId).eq("name", input.expectedName)
    .select("id,name").maybeSingle();
  if (error || !data) throw new PlayerLinkError("The Practice changed or is unavailable. Refresh and try again.", 409);
  return data as { id: string; name: string };
}
