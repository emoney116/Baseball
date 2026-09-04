import type { AppData, Player } from "../../types.ts";
import { baseballKnowledgeVocabulary, type BaseballKnowledgeItem } from "./knowledge.ts";
import type { AskClubhouseRoute, AskClubhouseUiContext } from "./types.ts";

export type AskClubhousePlayerResolution =
  | { status: "none" }
  | { status: "single"; player: Player; source: "full_name" | "partial_name" | "player_context" | "tracked_identity" }
  | { status: "ambiguous"; players: Player[]; reason: "same_name" | "partial_name" };

interface ResolvePlayerInput {
  data: AppData;
  message: string;
  route: AskClubhouseRoute;
  uiContext?: AskClubhouseUiContext;
  knowledgeItems?: BaseballKnowledgeItem[];
}

export function resolveAskClubhousePlayer(input: ResolvePlayerInput): AskClubhousePlayerResolution {
  if (input.route !== "clubhouse_data" && input.route !== "mixed") return { status: "none" };

  const message = input.message.trim().toLowerCase();
  const players = [...new Map(input.data.players.map((player) => [player.id, player])).values()];
  const contextPlayerId = contextPlayerReference(input.uiContext, message);
  const exactMatches = players.filter((player) => hasWordBoundedName(message, player.name));
  if (exactMatches.length === 1) return { status: "single", player: exactMatches[0], source: "full_name" };
  if (exactMatches.length > 1) {
    const contextual = exactMatches.find((player) => player.id === contextPlayerId);
    if (contextual) return { status: "single", player: contextual, source: "player_context" };
    const tracked = uniquelyTrackedPlayer(input.data, exactMatches);
    if (tracked) return { status: "single", player: tracked, source: "tracked_identity" };
    return { status: "ambiguous", players: exactMatches, reason: "same_name" };
  }

  const protectedTerms = baseballKnowledgeVocabulary(input.knowledgeItems ?? []);
  const partialMatches = players.filter((player) => player.name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length >= 4)
    .some((part) => hasExplicitPartialPlayerReference(message, part, protectedTerms.has(part))));
  if (partialMatches.length === 1) return { status: "single", player: partialMatches[0], source: "partial_name" };
  if (partialMatches.length > 1) {
    const contextual = partialMatches.find((player) => player.id === contextPlayerId);
    if (contextual) return { status: "single", player: contextual, source: "player_context" };
    return { status: "ambiguous", players: partialMatches, reason: "partial_name" };
  }

  if (contextPlayerId) {
    const player = players.find((candidate) => candidate.id === contextPlayerId);
    if (player) return { status: "single", player, source: "player_context" };
  }
  return { status: "none" };
}

export function messageHasExplicitPlayerReference(message: string, players: Player[]): boolean {
  const lower = message.trim().toLowerCase();
  return players.some((player) => {
    if (hasWordBoundedName(lower, player.name)) return true;
    return player.name.toLowerCase().split(/[^a-z0-9]+/)
      .filter((part) => part.length >= 4)
      .some((part) => hasExplicitPartialPlayerReference(lower, part, false));
  });
}

function contextPlayerReference(uiContext: AskClubhouseUiContext | undefined, message: string): string | undefined {
  if (!uiContext) return undefined;
  if (uiContext.playerId && (isSelfReference(message) || isContextualFollowUp(message))) return uiContext.playerId;
  if (uiContext.viewerPlayerId && isSelfReference(message)) return uiContext.viewerPlayerId;
  return undefined;
}

function isSelfReference(message: string): boolean {
  return /\b(i|me|my|mine)\b/.test(message);
}

function isContextualFollowUp(message: string): boolean {
  return /\b(he|him|his|she|her|hers|they|them|their)\b/.test(message)
    || /^(why|how about|what about|only|and)\b/.test(message);
}

function hasExplicitPartialPlayerReference(message: string, token: string, protectedBaseballTerm: boolean): boolean {
  if (!hasWordBoundedName(message, token)) return false;
  const escaped = escapeRegExp(token);
  const addressedAsPerson = new RegExp(
    `\\b(?:how|why)\\s+(?:is|did|does|can|should)\\s+${escaped}\\b|\\bwhat\\s+(?:can|should|did|does)\\s+${escaped}\\b|\\b(?:show(?:\\s+me)?|compare|for|about)\\s+${escaped}\\b|\\b${escaped}(?:'s|\\s+(?:hit|hits|hitting|pitch|pitches|pitching|perform|performs|improve|improves|doing|topped|reached|recorded|threw|had|has))\\b`,
  ).test(message);
  if (!addressedAsPerson) return false;
  if (!protectedBaseballTerm) return true;
  return /\b(player|hitter|pitcher|hit|hits|hitting|pitch|pitches|pitching|stats?|analytics|performance|performing|improve|doing)\b/.test(message);
}

function uniquelyTrackedPlayer(data: AppData, players: Player[]): Player | undefined {
  const scores = new Map(players.map((player) => [player.id, 0]));
  const add = (playerId: string | undefined) => {
    if (playerId && scores.has(playerId)) scores.set(playerId, (scores.get(playerId) ?? 0) + 1);
  };
  data.hittingEvents.forEach((event) => { add(event.hitterId); add(event.pitcherId); });
  data.pitchEvents.forEach((event) => { add(event.pitcherId); add(event.hitterId); });
  data.defenseEvents.forEach((event) => add(event.playerId));
  data.workoutEntries.forEach((entry) => add(entry.playerId));
  data.gameEvents.forEach((event) => { add(event.batterId); add(event.pitcherId); add(event.runnerId); });
  const tracked = players.filter((player) => (scores.get(player.id) ?? 0) > 0);
  return tracked.length === 1 ? tracked[0] : undefined;
}

function hasWordBoundedName(message: string, name: string): boolean {
  const escaped = escapeRegExp(name.trim().toLowerCase());
  return escaped.length > 0 && new RegExp(`\\b${escaped}\\b`).test(message);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
