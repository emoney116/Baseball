import { normalizeVoiceText } from './voiceVocabulary.ts';

/** Preserve fragments until an explicit save; a speech pause is not a pitch boundary. */
export function appendVoiceFragment(previous: string, next: string): string {
  const combined = [previous.trim(), next.trim()].filter(Boolean).join(', ');
  if (combined.length > 700) throw new Error('Pitch description is too long. Review or discard the pending pitch.');
  return combined;
}

export function voiceSessionAction(text: string): 'save' | 'discard' | 'mute' | null {
  const normalized = normalizeVoiceText(text);
  if (/^(save (?:it|pitch|that|event)|log (?:it|pitch|that|event))$/.test(normalized)) return 'save';
  if (/^(discard (?:pitch|that|event)|cancel (?:pitch|that|event))$/.test(normalized)) return 'discard';
  if (/^(mute|mute microphone|pause listening)$/.test(normalized)) return 'mute';
  return null;
}
