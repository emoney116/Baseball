export const VOICE_TRANSCRIPTION_PROMPT='Baseball practice vocabulary: hitting, pitching, at-bat, ball, ball outside, ball away, fastball, four-seam, slider, changeup, curveball, cutter, swing and miss, whiff, called strike, foul, exit velo, left center, right field.';
const normalize=(text:string)=>text.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
/** Reject long verbatim provider prompt echoes, including omitted headings. */
export function isVoicePromptEcho(text:string):boolean {
  if(/baseball practice vocabulary/i.test(text))return true;
  const value=normalize(text);
  return value.length>=100&&normalize(VOICE_TRANSCRIPTION_PROMPT).includes(value);
}
