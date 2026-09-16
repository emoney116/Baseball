import type { BpState, BpRunnerMovement } from './liveBp.ts';

const bases: Record<string, string> = { first: '1', second: '2', third: '3', home: 'score' };

/** Keep original runner keys while applying explicitly narrated movements in order. */
export function parseVoiceRunners(text: string, state: BpState) {
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
