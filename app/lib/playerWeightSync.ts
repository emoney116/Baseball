import type { SupabaseClient } from "@supabase/supabase-js";

// Call only with a session ID returned by the authorized weigh-in RPC.
export async function syncMeasuredProfileWeight(db: SupabaseClient, sessionId: string) {
  const session = await db.from("workout_sessions").select("player_id").eq("id", sessionId).single();
  if (session.error || !session.data) throw new Error("Unable to resolve saved weigh-in.");
  const playerId = session.data.player_id;
  const latest = await db.from("workout_sessions").select("body_weight,session_date,updated_at").eq("player_id", playerId)
    .gt("body_weight", 0).or("notes.is.null,notes.not.like.%Unverified roster-copy%").order("session_date", { ascending: false }).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (latest.error) throw new Error("Unable to resolve latest weigh-in.");
  const pounds = Number(latest.data?.body_weight);
  if (!Number.isFinite(pounds) || pounds <= 0) return;
  const player = await db.from("players").select("metadata").eq("id", playerId).single();
  if (player.error || !player.data) throw new Error("Unable to load player weight.");
  const saved = await db.from("players").update({ weight: Math.round(pounds), metadata: { ...player.data.metadata, weightLb: pounds } }).eq("id", playerId);
  if (saved.error) throw new Error("Weigh-in saved, but profile weight could not be updated. Retry to synchronize.");
}
