import {correctedVoiceText} from './voiceSession.ts';
import {voiceIdentityMatches, type VoiceIdentity} from './voiceVocabulary.ts';

// Suggestions require a coach selection. Never silently turn "fall" into Ball/Foul.
export function voiceSpeechSuggestions(text: string, roster: readonly VoiceIdentity[]): string[] {
  const value=correctedVoiceText(text);
  const result=value.match(/^fall(?: (outside|away|inside|high|low|up|down|up away|down away))?$/);
  if(result)return ['ball','foul'].map(word=>`${word}${result[1]?` ${result[1]}`:''}`);
  const hitter=value.match(/^(.+?) (?:is )?heading$/);
  if(hitter) {
    const matches=roster.filter(player=>voiceIdentityMatches(player,hitter[1]));
    if(matches.length===1)return [`${matches[0].aliases[0]} is hitting`];
  }
  return [];
}
