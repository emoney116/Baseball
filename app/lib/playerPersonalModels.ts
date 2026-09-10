import type { PlayerCapability } from "./playerCapabilities.ts";

export const PERSONAL_DOMAINS = ["hitting", "pitching", "defense"] as const;
export type PersonalDomain = typeof PERSONAL_DOMAINS[number];
export const PERSONAL_TITLES: Record<PersonalDomain, string> = { hitting: "Personal Hitting Session", pitching: "Personal Bullpen", defense: "Personal Defense Session" };
export const personalCapability = (domain: PersonalDomain): PlayerCapability => ({ hitting: "canStartPersonalHittingSession", pitching: "canStartPersonalPitchingSession", defense: "canStartPersonalDefenseSession" } as const)[domain];
export type PersonalSession = { id: string; domain: PersonalDomain; startedAt: string; endedAt?: string };
