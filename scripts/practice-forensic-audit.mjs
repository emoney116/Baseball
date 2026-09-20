import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { voiceTokenConfidence } from '../app/lib/voiceTranscriptionConfidence.ts';
import { interpretVoice, canFastSaveVoice } from '../app/lib/voiceIntent.ts';
import { initialBpState } from '../app/lib/liveBp.ts';

const directory = process.argv[2];
if (!directory) throw new Error('Private evidence directory required');
const read = name => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const source = read('source-manifest.json');
const data = read('canonical-readonly.json');
const roster = read('participant-roster.json');
const names = Object.fromEntries(roster.map(p => [p.id, `${p.first_name} ${p.last_name}`]));
const transcripts = readdirSync(directory).filter(n => /^raw-\d+\.json$/.test(n)).sort().map(read);
const voiceIds = new Set(data.voice_usage.map(v => v.request_id));
const pitches = data.hitting;
const bip = pitches.filter(e => e.action === 'Ball in play');
const summary = {
  canonicalPitches: pitches.length, linkedVoicePitches: pitches.filter(e => voiceIds.has(e.id)).length,
  noVoiceLink: pitches.filter(e => !voiceIds.has(e.id)).length,
  completedTranscriptions: data.voice_usage.length,
  telemetryAutoSaved: data.voice_usage.filter(v => v.auto_saved).length,
  telemetryCorrections: data.voice_usage.filter(v => v.manual_correction).length,
  voiceAudioSeconds: data.voice_usage.reduce((n,v) => n + Number(v.audio_seconds), 0),
  bip: bip.length, measuredEv: bip.filter(e => e.exit_velocity_mph !== null).length,
  spray: bip.filter(e => e.field_location !== null).length,
  pitchVelocity: pitches.filter(e => e.velocity !== null).length,
  pitchLocation: pitches.filter(e => e.pitch_location !== null).length,
  pitchType: pitches.filter(e => e.pitch_type !== null).length,
  defenseRows: (data.defense ?? []).length,
  embeddedDefense: pitches.filter(e => e.live_bp_context?.fieldingSequence?.length).length,
  runnerActions: data.actions.filter(e => e.kind === 'runner').length,
  undoActions: data.actions.filter(e => e.kind === 'undo').length,
  participants: new Set(pitches.map(e => e.hitter_id)).size,
  transcriptChunks: transcripts.length,
  promptEchoChunks: transcripts.filter(t => /hitting, pitching, at-bat|baseball practice vocabulary/i.test(t.rawProviderResponse.text)).map(t => t.index),
  recordingSeconds: source.durationSeconds,
  timestampPrecision: source.timestampPrecision,
  historicalTranscriptAvailable: false,
  caution: 'Telemetry false/null is not proof of Review. Nonmatching Voice attempts include context commands. Re-transcription is not the historical transcript. Ground truth needs audio adjudication.',
};
writeFileSync(join(directory,'quality-summary.json'),JSON.stringify(summary,null,2));
const normalized = transcripts.map(t => ({index:t.index,startSeconds:t.startSeconds,endSeconds:t.endSeconds,
  rawFile:`raw-${String(t.index).padStart(3,'0')}.json`,holdout:source.holdoutChunkIndices.includes(t.index),
  text:t.rawProviderResponse.text, status:summary.promptEchoChunks.includes(t.index)?'PROVIDER_PROMPT_ECHO_REJECTED':'UNADJUDICATED_TRANSCRIPT',
  expectedInterpretation:'UNKNOWN until adjudicated; not inferred from canonical rows'}));
writeFileSync(join(directory,'normalized-transcript.json'),JSON.stringify(normalized,null,2));
const timeline = pitches.map(e=>({time:e.created_at,eventId:e.id,hitter:names[e.hitter_id],
  inputMethod:voiceIds.has(e.id)?'voice_request_link':'no_voice_request_link',
  result:e.live_bp_context?.result,contact:e.contact_result,ev:e.exit_velocity_mph,
  canonical:e,audioMatch:'UNMATCHED',correct:'UNKNOWN'}));
writeFileSync(join(directory,'canonical-timeline.json'),JSON.stringify(timeline,null,2));
const pas = new Map();
for(const e of pitches){const key=`${e.live_bp_round_id}:${e.live_bp_context?.before.pa}:${e.hitter_id}`;
  const rows=pas.get(key)??[];rows.push(e);pas.set(key,rows);}
writeFileSync(join(directory,'canonical-pa-reconstruction.json'),JSON.stringify([...pas].map(([key,events])=>({key,hitter:names[events[0].hitter_id],eventIds:events.map(e=>e.id),startingState:events[0].live_bp_context.before,endingState:events.at(-1).live_bp_context.after,confidence:'CANONICAL_GROUPING_ONLY; audio corroboration pending'})),null,2));
// Diagnostic only: whole chunks are NOT single events. This reports the V1 gate,
// not accuracy, and excludes reserved holdout text from development output.
const diagnostic=transcripts.filter(t=>!source.holdoutChunkIndices.includes(t.index)&&!summary.promptEchoChunks.includes(t.index)).map(t=>{
 const confidence=voiceTokenConfidence(t.rawProviderResponse.logprobs);
 const intent=interpretVoice(t.rawProviderResponse.text,{domain:'live-bp',roster:roster.map(p=>({id:p.id,aliases:[p.first_name,`${p.first_name} ${p.last_name}`]})),settings:data.rounds[0].settings,state:initialBpState()},`qa-${t.index}`,confidence);
 return {index:t.index,confidence,fastGate:canFastSaveVoice(intent),unresolved:intent.unresolvedFields,notAccuracyBenchmark:true};
});
writeFileSync(join(directory,'v1-chunk-diagnostic.json'),JSON.stringify(diagnostic,null,2));
console.log(JSON.stringify(summary,null,2));
