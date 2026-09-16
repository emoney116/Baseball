import { normalizeVoiceText, VOICE_PITCH_ALIASES } from './voiceVocabulary.ts';

/** Resolve only explicit, local replacements; ambiguous alternatives stay unresolved. */
export function correctedVoiceText(text: string): string {
  let corrected = normalizeVoiceText(text)
    .replace(/\b(\d{2,3}) (?:actually|no|make that) (\d{2,3})\b/g, '$2')
    .replace(/\b(runner on) (?:first|second|third) (?:no|actually|make that) (first|second|third)\b/g, '$1 $2')
    .replace(/^(.+?) (?:is )?hitting (?:make that|actually) (.+)$/, '$2 is hitting');
  const pitches = Object.keys(VOICE_PITCH_ALIASES).sort((a,b)=>b.length-a.length).join('|');
  const replacement = corrected.match(new RegExp(`\\b(?:that was (?:a )?)?(${pitches}) not (?:a )?(${pitches})\\b`));
  if (replacement) {
    corrected = corrected.replace(replacement[0], replacement[1]);
    corrected = corrected.replace(new RegExp(`\\b${replacement[2]}\\b`, 'g'), replacement[1]);
  }
  return corrected;
}

/** Preserve fragments until an explicit save; a speech pause is not a pitch boundary. */
export function appendVoiceFragment(previous: string, next: string): string {
  const combined = [previous.trim(), next.trim()].filter(Boolean).join(', ');
  if (combined.length > 700) throw new Error('Pitch description is too long. Review or discard the pending pitch.');
  return combined;
}

export function voiceSessionAction(text: string): 'save' | 'discard' | 'mute' | 'undo' | null {
  const normalized = normalizeVoiceText(text);
  if (/^(undo(?: that| last pitch)?|take that back)$/.test(normalized)) return 'undo';
  if (/^(save (?:it|pitch|that|event)|log (?:it|pitch|that|event))$/.test(normalized)) return 'save';
  if (/^(discard (?:pitch|that|event)|cancel (?:pitch|that|event))$/.test(normalized)) return 'discard';
  if (/^(mute|mute microphone|pause listening)$/.test(normalized)) return 'mute';
  return null;
}
