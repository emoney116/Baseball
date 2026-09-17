export function voiceTokenConfidence(tokens: unknown): number | null {
  if (!Array.isArray(tokens) || !tokens.length) return null;
  const values: number[] = [];
  for (const token of tokens) {
    if (!token || typeof token.token !== 'string' || typeof token.logprob !== 'number' || !Number.isFinite(token.logprob) || token.logprob > 0) return null;
    // Punctuation does not change baseball meaning. Every spoken word/number remains gated.
    if (/[a-z0-9]/i.test(token.token)) values.push(Math.exp(token.logprob));
  }
  return values.length ? Math.min(...values) : null;
}
