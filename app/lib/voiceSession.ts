import { normalizeVoiceText, VOICE_PITCH_ALIASES } from './voiceVocabulary.ts';
import { normalizeBaseballLanguage } from './voiceBaseballLanguage.ts';

/** Resolve only explicit, local replacements; ambiguous alternatives stay unresolved. */
export function correctedVoiceText(text: string): string {
  let corrected = normalizeVoiceText(text)
    .replace(/^bal(?= (?:outside|away|inside|high|low|up|down|one|two|three|four)\b|$)/, 'ball')
    .replace(/\b(?:uh|um)\b/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .replace(/\b(\d{2,3}) (?:actually (?:make that )?|no (?:sorry )?|make that )(\d{2,3})\b/g, '$2')
    .replace(/\b(runner on) (?:first|second|third) (?:no (?:sorry )?|actually (?:wait )?|make that )(?:runner on )?(first|second|third)\b/g, '$1 $2')
    .replace(/^.+? (?:is )?hitting (?:make that|actually)(?: wait)? (.+)$/, (_, replacement: string) => /\b(?:is )?hitting$/.test(replacement) ? replacement : `${replacement} is hitting`);
  const pitches = Object.keys(VOICE_PITCH_ALIASES).sort((a,b)=>b.length-a.length).join('|');
  corrected = corrected.replace(new RegExp(`\\b(?:${pitches}) (\\d{2,3}) no (?:that was (?:a )?)?(${pitches}) (\\d{2,3})\\b`, 'g'), '$2 $3');
  const replacement = corrected.match(new RegExp(`\\b(?:that was (?:a )?)?(${pitches}) not (?:a )?(${pitches})\\b`));
  if (replacement) {
    corrected = corrected.replace(replacement[0], replacement[1]);
    corrected = corrected.replace(new RegExp(`\\b${replacement[2]}\\b`, 'g'), replacement[1]);
  }
  return normalizeBaseballLanguage(corrected
    .replace(/\b(?:that was|kind of|i think)\b/g, ' ')
    .replace(/\b(?:he )?fouled (?:it )?off\b/g, 'foul')
    .replace(/\s+/g, ' ').trim());
}

/** Preserve fragments until an explicit save; a speech pause is not a pitch boundary. */
export function appendVoiceFragment(previous: string, next: string): string {
  const combined = [previous.trim(), next.trim()].filter(Boolean).join(', ');
  if (combined.length > 700) throw new Error('Pitch description is too long. Review or discard the pending pitch.');
  return combined;
}

/** Only missing detail fragments may extend an unsaved event, never another pitch. */
export function isVoiceDetailFragment(text:string):boolean {
  const value=correctedVoiceText(text);
  return /^(?:single|double|triple|home run|out|reached on error|(?:left|right)(?: center)?(?: field)?|center(?: field)?|\d{2,3} (?:exit|exit velo|exit velocity|ev)|(?:exit velo|exit velocity|ev) \d{2,3})$/.test(value);
}

export function voiceSessionAction(text: string): 'save' | 'discard' | 'mute' | 'undo' | null {
  const normalized = normalizeVoiceText(text);
  if (/^(undo(?: that| last pitch)?|take that back)$/.test(normalized)) return 'undo';
  if (/^(save (?:it|pitch|that|event)|log (?:it|pitch|that|event))$/.test(normalized)) return 'save';
  if (/^(discard (?:pitch|that|event)|cancel (?:pitch|that|event))$/.test(normalized)) return 'discard';
  if (/^(mute|mute microphone|pause listening)$/.test(normalized)) return 'mute';
  return null;
}
