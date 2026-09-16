import type { PitchType } from "../types.ts";
import { TENDEX_PITCH_TYPES } from "./tendexGameAnalysis.ts";

export const VOICE_PITCH_ALIASES: Readonly<Record<string, PitchType>> = {
  "four seam": "4-Seam",
  "4 seam": "4-Seam",
  fastball: "4-Seam",
  heater: "4-Seam",
  "two seam": "2-Seam",
  "2 seam": "2-Seam",
  sinker: "Sinker",
  change: "Changeup",
  changeup: "Changeup",
  ch: "Changeup",
  slider: "Slider",
  sl: "Slider",
  "slide piece": "Slider",
  curve: "Curveball",
  curveball: "Curveball",
  cb: "Curveball",
  cutter: "Cutter",
  splitter: "Splitter",
};

export const VOICE_RESULT_ALIASES = {
  "called strike": "Called Strike",
  "strike looking": "Called Strike",
  "swing and miss": "Whiff",
  "swing miss": "Whiff",
  whiff: "Whiff",
  foul: "Foul",
  "in play": "Ball in play",
  "ball in play": "Ball in play",
  "hit by pitch": "HBP",
  hbp: "HBP",
  ball: "Ball",
} as const;

export const VOICE_CONTACT_ALIASES = {
  "hard ground ball": "Hard ground ball",
  "ground ball": "Ground ball",
  "line drive": "Line drive",
  "fly ball": "Fly ball",
  "pop up": "Pop up",
  "pop fly": "Pop up",
  bunt: "Bunt",
} as const;

export function normalizeVoiceText(text: string): string {
  const tens: Record<string, number> = {twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
  const ones: Record<string, number> = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9};
  return text
    .toLowerCase()
    .replace(/[-\u2010-\u2015]/g, " ")
    .replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s+(one|two|three|four|five|six|seven|eight|nine))?\b/g,
      (_, ten: string, one: string | undefined) => String(tens[ten] + (one ? ones[one] : 0)))
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type VocabularyMatch<T extends string> = {
  value: T;
  phrase: string;
  start: number;
  end: number;
};

// Longer phrases consume their span first: "ground ball" must not also become "ball".
export function matchVoiceVocabulary<T extends string>(
  text: string,
  vocabulary: Readonly<Record<string, T>>,
): VocabularyMatch<T>[] {
  const matches: VocabularyMatch<T>[] = [];
  for (const [phrase, value] of Object.entries(vocabulary).sort(
    (a, b) => b[0].length - a[0].length,
  )) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "g");
    for (const match of text.matchAll(pattern)) {
      const start = match.index!,
        end = start + match[0].length;
      if (
        !matches.some(
          (existing) => start < existing.end && end > existing.start,
        )
      )
        matches.push({ value: value as T, phrase, start, end });
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

export function resolveVoicePitchType(transcript: string): {
  value?: PitchType;
  ambiguous: boolean;
} {
  const values = [
    ...new Set(
      matchVoiceVocabulary(
        normalizeVoiceText(transcript),
        VOICE_PITCH_ALIASES,
      ).map((match) => match.value),
    ),
  ];
  return {
    value:
      values.length === 1 && TENDEX_PITCH_TYPES.includes(values[0])
        ? values[0]
        : undefined,
    ambiguous: values.length > 1,
  };
}

export type VoiceIdentity = { id: string; aliases: readonly string[]; bats?: "R" | "L" | "S" };

export function resolveVoiceIdentity(
  name: string,
  roster: readonly VoiceIdentity[],
): { id?: string; candidates: string[] } {
  const normalized = normalizeVoiceText(name);
  const candidates = [
    ...new Set(
      roster
        .filter(
          (player) =>
            normalized &&
            player.aliases.some(
              (alias) => normalizeVoiceText(alias) === normalized,
            ),
        )
        .map((player) => player.id),
    ),
  ];
  return {
    id: candidates.length === 1 ? candidates[0] : undefined,
    candidates,
  };
}
