import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listPlayerContexts,
  selectPlayerContext,
  loadContextPlayerAccess,
} from "./playerAccess.ts";
import { PlayerLinkError } from "./playerAccountLinks.ts";
import type { PlayerCapability } from "./playerCapabilities.ts";

export async function writePlayerSelfEntry(
  db: SupabaseClient,
  profileId: string,
  input: Record<string, unknown>,
) {
  const kind = input.kind,
    operation = input.operation;
  if (
    (kind !== "body_weight" && kind !== "goal") ||
    (operation !== "create" && operation !== "update" && operation !== "delete")
  )
    throw new PlayerLinkError("Unsupported self entry.", 400);
  if (typeof input.membershipId !== "string")
    throw new PlayerLinkError("Choose your approved context.", 403);
  const contexts = await listPlayerContexts(db, profileId);
  const selected = contexts.find((c) => c.membershipId === input.membershipId);
  if (!selected)
    throw new PlayerLinkError("Choose your approved context.", 403);
  const context = selectPlayerContext(contexts, {
    playerId: selected.playerId,
    teamId: selected.team.teamId,
    seasonId: selected.team.seasonId,
  })!;
  const permissions: Record<string, Record<string, PlayerCapability>> = {
    body_weight: {
      create: "canLogBodyWeight",
      update: "canUpdateOwnBodyWeight",
      delete: "canDeleteOwnBodyWeight",
    },
    goal: {
      create: "canCreateGoals",
      update: "canUpdateOwnGoals",
      delete: "canDeleteOwnGoals",
    },
  };
  const access = await loadContextPlayerAccess(db, context);
  if (!access.capabilities[permissions[kind][operation]])
    throw new PlayerLinkError(
      "Your team access does not permit this action.",
      403,
    );
  if (
    operation !== "create" &&
    (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id))
  )
    throw new PlayerLinkError("Choose an existing entry.");
  if (
    kind === "body_weight" &&
    operation !== "delete" &&
    (typeof input.bodyWeight !== "number" ||
      !Number.isFinite(input.bodyWeight) ||
      input.bodyWeight < 30 ||
      input.bodyWeight > 700)
  )
    throw new PlayerLinkError("Body weight must be 30-700 lb.");
  if (
    kind === "goal" &&
    operation !== "delete" &&
    (typeof input.title !== "string" ||
      !input.title.trim() ||
      input.title.length > 200 ||
      typeof input.completed !== "boolean")
  )
    throw new PlayerLinkError("Enter a goal of 1-200 characters.");
  const { data, error } = await db.rpc("write_player_self_entry", {
    actor: profileId,
    target_membership: context.membershipId,
    entry_kind: kind,
    operation,
    entry_id: operation === "create" ? null : input.id,
    entry_date:
      kind === "body_weight" && operation === "create" ? input.date : null,
    body_weight_value:
      kind === "body_weight" && operation !== "delete"
        ? input.bodyWeight
        : null,
    goal_title: kind === "goal" && operation !== "delete" ? input.title : null,
    goal_completed:
      kind === "goal" && operation !== "delete" ? input.completed : null,
  });
  if (error)
    throw new PlayerLinkError(
      error.code === "23505"
        ? "An entry already exists for this player and date. Coach entries cannot be replaced."
        : "Unable to change this entry. Refresh and check your access and ownership.",
      error.code === "23505" ? 409 : 403,
    );
  return { id: data };
}
