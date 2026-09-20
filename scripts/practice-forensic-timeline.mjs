import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const directory=process.argv[2],read=n=>JSON.parse(readFileSync(join(directory,n),'utf8'));
const data=read('canonical-readonly.json'),raw=read('normalized-transcript.json');
const names=Object.fromEntries(read('participant-roster.json').map(p=>[p.id,`${p.first_name} ${p.last_name}`]));
const voice=new Set(data.voice_usage.map(v=>v.request_id));
// Corroborating EV/contact/outcome sequences imply this clock neighborhood, not
// a synchronized timestamp. Preserve its uncertainty in every candidate row.
const estimatedOrigin=Date.parse('2026-09-17T20:05:40Z');
const rows=raw.map(segment=>({
 ...segment,clockAlignment:'Estimated 20:05:40Z +/- 20s; not a device timestamp',
 candidates:data.hitting.filter(e=>{
  const relative=(Date.parse(e.created_at)-estimatedOrigin)/1000;
  return relative>=segment.startSeconds-20&&relative<=segment.endSeconds+35;
 }).map(e=>({id:e.id,savedAt:e.created_at,hitter:names[e.hitter_id],input:voice.has(e.id)?'Voice request ID':'Unlinked coach entry',result:e.live_bp_context?.result,bip:e.contact_result,ev:e.exit_velocity_mph,correct:'UNKNOWN',match:'CANDIDATE_ONLY'})),
 expected:'UNKNOWN until audio adjudication; candidates are not ground truth'
}));
writeFileSync(join(directory,'forensic-timeline.json'),JSON.stringify(rows,null,2));
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const table=rows.map(r=>`<tr><td>${r.startSeconds}-${r.endSeconds}s</td><td>${escape(r.text)}<br><small>${r.status}</small></td><td>${r.candidates.map(c=>`${escape(c.savedAt)} ${escape(c.hitter)}: ${escape(c.result)} / ${escape(c.bip)} / ${escape(c.ev)} EV [${escape(c.input)}]`).join('<br>')}</td><td>UNKNOWN</td></tr>`).join('');
writeFileSync(join(directory,'forensic-timeline.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>Private Practice Timeline</title><style>body{font:15px system-ui;margin:24px}td,th{padding:12px;border-bottom:1px solid #aaa;text-align:left;vertical-align:top}table{border-collapse:collapse;width:100%}small{color:#666}</style><h1>Private Practice Timeline</h1><p>Raw transcription and canonical candidates. Approximate clock alignment +/-20s plus save delay. No candidate is an approved correction. Full audio adjudication remains required.</p><table><thead><tr><th>Audio time</th><th>Provider transcript</th><th>Canonical candidates</th><th>Correct?</th></tr></thead><tbody>${table}</tbody></table></html>`);
const reasoning=readdirSync(directory).filter(n=>/^v2-reasoning.*\.json$/.test(n)).map(read);
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:null;};
const costs={pricingChecked:'2026-09-20',source:'https://developers.openai.com/api/docs/pricing',
 v1TranscriptionPracticeEstimate:data.voice_usage.reduce((n,v)=>n+Number(v.audio_seconds),0)/60*.006,
 fullRecordingTranscriptionEstimate:2263.79/60*.006,
 liveTranscriptionFullRecordingEstimate:2263.79/60*.017,
 ninetyMinuteLiveTranscriptionEstimate:90*.017,ninetyMinuteRecordingTranscriptionEstimate:90*.006,
 ninetyMinuteV1SameDutyCycleEstimate:(data.voice_usage.reduce((n,v)=>n+Number(v.audio_seconds),0)/2263.79)*90*.006,
 reasoningSpikeCalls:reasoning.length,reasoningSpikeEstimatedCost:reasoning.reduce((n,r)=>n+(r.usage.inputTokens-r.usage.cachedInputTokens)*.25/1e6+r.usage.cachedInputTokens*.025/1e6+r.usage.outputTokens*2/1e6,0),
 reasoningMedianMs:median(reasoning.map(r=>r.latencyMs)),
 caveat:'Estimates, not invoices. Full live reasoning cost and mobile latency NOT MEASURED. Realtime test used accelerated upload.'};
writeFileSync(join(directory,'cost-estimates.json'),JSON.stringify(costs,null,2));
console.log(JSON.stringify(costs,null,2));
