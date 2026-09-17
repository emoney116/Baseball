export function voiceTokenConfidence(tokens: unknown): number | null {
  if (!Array.isArray(tokens) || !tokens.length) return null;
  const transcript=tokens.map(token=>typeof token?.token==='string'?token.token:'').join('');
  const units=[...transcript.matchAll(/\d{2,3}\s*(mph|miles?\s+(?:an?|per)\s+hour)\b/gi)]
    .map(match=>({start:match.index+match[0].lastIndexOf(match[1]),end:match.index+match[0].length}));
  let offset=0;
  const values: number[] = [];
  for (const token of tokens) {
    if (!token || typeof token.token !== 'string' || typeof token.logprob !== 'number' || !Number.isFinite(token.logprob) || token.logprob > 0) return null;
    // Unit wording does not select a stat value; the number and EV/pitch anchor
    // remain gated. Do not relax names, results, directions or alternatives.
    const start=offset+token.token.length-token.token.trimStart().length;
    offset+=token.token.length;
    if(units.some(range=>start>=range.start&&offset<=range.end) && /^(?:miles?|mph|hour)$/i.test(token.token.trim()))continue;
    if (/[a-z0-9]/i.test(token.token)) values.push(Math.exp(token.logprob));
  }
  return values.length ? Math.min(...values) : null;
}
