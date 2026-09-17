import type { BpState, BpRunnerMovement } from './liveBp.ts';
import { normalizeVoiceText, voiceIdentityMatches, type VoiceIdentity } from './voiceVocabulary.ts';

const bases: Record<string, string> = { first: '1', second: '2', third: '3', home: 'score' };

/** Resolve named runners before generic hitter-name extraction. */
export function normalizeNamedRunners(text: string, roster: readonly VoiceIdentity[], state: BpState) {
  const problems: string[] = [];
  const aliases = [...new Set(roster.flatMap(player => player.aliases.map(normalizeVoiceText)))].filter(Boolean).sort((a,b)=>b.length-a.length);
  if (!aliases.length) return {text, problems};
  const names = aliases.map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const pattern = new RegExp(`\\b(${names}) (?=(?:scores?\\b|scored\\b|(?:moves?|moved|advances?|advanced|goes|went) (?:to )?(?:first|second|third|home)\\b))`, 'g');
  text = text.replace(pattern, (_, name: string) => {
    const matches = roster.filter(player=>voiceIdentityMatches(player,name));
    const occupied = state.runners.filter(base=>matches.some(player=>player.id===state.runnerIds?.[base]));
    if (occupied.length !== 1) {
      problems.push(`Which occupied base is ${name} on?`);
      return 'unresolved runner ';
    }
    return `runner from ${['','first','second','third'][occupied[0]]} `;
  }).replace(/\b(scored|scores) (?:on )?(?:that|the) last play\b/g,'$1');
  return {text, problems};
}

/** Keep original runner keys while applying explicitly narrated movements in order. */
export function parseVoiceRunners(text: string, state: BpState) {
  text = text.replace(/\brunner holds? at (first|second|third)(?: base)?\b/g, 'runner on $1 to $1');
  const outcomes: Record<string, string> = {};
  const movements: BpRunnerMovement[] = [];
  const problems: string[] = [];
  const pattern = /\b(?:the )?runner (?:(?:from |on )?(first|second|third)(?: base)? )?(?:(?:moves?|moved|advances?|advanced|goes|went) (?:to )?(first|second|third|home)|to (first|second|third|home)|scores?|scored|(?:is |was )?(out|safe) at (first|second|third|home))\b/g;
  const remaining = text.replace(pattern, (phrase: string, from: string | undefined, move: string | undefined, to: string | undefined, decision: string | undefined, at: string | undefined) => {
    const origin = from ? bases[from] : undefined;
    const candidates = origin && state.runners.includes(Number(origin)) && outcomes[origin] === undefined ? [origin] : state.runners.map(String).filter(base => {
      const current = outcomes[base] ?? base;
      return current !== 'out' && current !== 'score' && (!origin || current === origin);
    });
    if (candidates.length !== 1) {
      problems.push(`Which existing runner: "${phrase}"?`);
    } else {
      const previous = outcomes[candidates[0]] ?? candidates[0];
      outcomes[candidates[0]] = decision === 'out' ? 'out' : bases[move ?? to ?? at ?? 'home'];
      movements.push({runnerBase:Number(candidates[0]),from:previous,to:outcomes[candidates[0]]});
    }
    return ' ';
  });
  return { remaining, outcomes, movements, problems };
}
