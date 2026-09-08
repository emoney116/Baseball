import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizePlanTime, validatePlanExtraction, validatePlanItems, combinePracticePlan, PLAN_EXTRACTION_INSTRUCTIONS, PLAN_EXTRACTION_SCHEMA } from '../app/lib/practicePlan.ts';
import { authorizePracticePlan, publishPracticePlan } from '../app/lib/practicePlanService.ts';
import { OpenAIProvider } from '../app/lib/askClubhouse/provider.ts';
import { loadPlayerSession } from '../app/lib/playerAccess.ts';
import { playerServiceFixture, uuid } from './helpers/playerServiceFixture.mjs';

const row = (id = 'r1') => ({ id, timeLabel: '3:25 PM', activity: 'Team Meeting', shortDetail: null });
for (const [input, expected] of [['325p','3:25 PM'], ['345/350p','3:45-3:50 PM'], ['3:45–3:50 PM','3:45-3:50 PM'], ['about 4p','~4:00 PM'], ['~4:10','~4:10'], ['3:30','3:30'], ['5p','5:00 PM'], [null,null], ['',null], ['11am-1pm','11:00 AM-1:00 PM']]) {
  test(`time normalization preserves meaning: ${input}`, () => assert.equal(normalizePlanTime(input), expected));
}
for (const input of ['25:00 PM', '3:75', 'tomorrow', {}, 330]) test(`invalid time rejected: ${JSON.stringify(input)}`, () => assert.throws(() => normalizePlanTime(input)));
test('review fixture matches the six concise screenshot schedule activities', () => {
  const result = validatePlanExtraction({ warnings: ['Approximate time'], items: [
    ['325p','Team Meeting',null],['335p','Warm Up',null],['345/350p','Throwing',null],['405p','Position Work','IF / OF / C'],['425p','Hitting Rotations','Live / Baserunning / Defense / Cages'],['5p','End',null],
  ].map(([timeLabel, activity, shortDetail]) => ({ timeLabel, activity, shortDetail })) });
  assert.equal(result.items.length, 6); assert.equal(result.items[2].timeLabel, '3:45-3:50 PM');
  assert.ok(result.items.every(r=>r.activity.length <= 48 && (r.shortDetail?.length ?? 0) <= 64));
  assert.doesNotMatch(JSON.stringify(result), /Coach|expectations|Bryson|Hack/);
});
test('missing time remains missing with a review warning', () => {
  const result = validatePlanExtraction({ items: [{timeLabel:null,activity:'Defense',shortDetail:null}], warnings:[] });
  assert.equal(result.items[0].timeLabel,null); assert.ok(result.warnings.includes('Time not found'));
});
test('text extraction refuses a time or meridiem absent from the source', () => {
  const extraction={items:[{timeLabel:'3:30 PM',activity:'Warm Up',shortDetail:null}],warnings:[]};
  assert.throws(()=>validatePlanExtraction(extraction,'3:30 Warm Up'));
  assert.throws(()=>validatePlanExtraction(extraction,'4p Warm Up'));
  assert.equal(validatePlanExtraction({...extraction,items:[{...extraction.items[0],timeLabel:'330p'}]},'330p Coach leads warm up').items[0].timeLabel,'3:30 PM');
});
test('unknown fields, paragraph activities, unknown warnings and duplicate IDs are rejected', () => {
  assert.throws(()=>validatePlanItems([{...row(), description:'staff paragraph'}]));
  assert.throws(()=>validatePlanItems([{...row(), activity:'paragraph\ncontinued'}]));
  assert.throws(()=>validatePlanItems([row(),row()]));
  assert.throws(()=>validatePlanExtraction({items:[],warnings:['provider secret']}));
  assert.throws(()=>validatePlanExtraction('markdown'));
});
test('short detail is one bounded line and no default time is invented', () => {
  const result = validatePlanItems([{...row(),timeLabel:null,shortDetail:'word '.repeat(50)}]);
  assert.equal(result[0].shortDetail.length,64); assert.equal(result[0].timeLabel,null);
});
test('replace and merge preserve order and leave original plan untouched before publish', () => {
  const old=[row('old')], incoming=[row('new')]; const before=structuredClone(old);
  assert.deepEqual(combinePracticePlan(old,incoming,'replace'),incoming);
  assert.deepEqual(combinePracticePlan(old,incoming,'merge'),[...old,...incoming]);
  assert.deepEqual(old,before); assert.throws(()=>combinePracticePlan(old,incoming,'automatic'));
});
test('bounded strict extraction excludes conversational and conditional chatter by instruction', () => {
  assert.equal(PLAN_EXTRACTION_SCHEMA.additionalProperties,false);
  assert.match(PLAN_EXTRACTION_INSTRUCTIONS,/coach names, player exceptions/);
  assert.match(PLAN_EXTRACTION_INSTRUCTIONS,/Do not invent times/);
  assert.match(PLAN_EXTRACTION_INSTRUCTIONS,/phone clock timestamps/);
});
function database(role='COACH') {
  const tables={teams:[{id:'team',organization_id:'org'}],profile_team_memberships:role?[{profile_id:'actor',team_id:'team',role,active:true}]:[],organization_memberships:[],account_entitlements:[],practices:[{id:'practice',team_id:'team',season_id:'season',team_plan:[row('old')],team_plan_revision:1}]};
  let writes=0;
  const db={from(table){const filters=[];let patch;const result=()=>{const rows=(tables[table]??[]).filter(r=>filters.every(f=>f(r)));if(patch){writes++;rows.forEach(r=>Object.assign(r,patch));}return rows;};const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},limit(){return q;},order(){return q;},update(value){patch=value;return q;},maybeSingle(){return Promise.resolve({data:result()[0]??null,error:null});},single(){return q.maybeSingle();},then(resolve,reject){return Promise.resolve({data:result(),error:null}).then(resolve,reject);}};return q;}};
  return {db,tables,get writes(){return writes;}};
}
for (const role of ['PLAYER',null]) test(`${role} cannot extract or publish through the shared server authorization`, async()=>{
  const f=database(role); await assert.rejects(()=>authorizePracticePlan(f.db,'actor','team','practice'));
  await assert.rejects(()=>publishPracticePlan(f.db,'actor',{teamId:'team',practiceId:'practice',items:[row()],revision:1,mode:'replace'}));assert.equal(f.writes,0);
});
test('wrong team and stale revision fail without mutation',async()=>{
  const f=database(); await assert.rejects(()=>authorizePracticePlan(f.db,'actor','other','practice'));
  await assert.rejects(()=>publishPracticePlan(f.db,'actor',{teamId:'team',practiceId:'practice',items:[row()],revision:0,mode:'replace'}));assert.equal(f.writes,0);
});
test('coach publish writes only canonical plan and audit, not lifecycle',async()=>{
  const f=database(); const result=await publishPracticePlan(f.db,'actor',{teamId:'team',practiceId:'practice',items:[row()],revision:1,mode:'replace'});
  assert.equal(result.revision,2);assert.equal(f.tables.practices[0].team_plan_published_by,'actor');assert.equal(f.tables.practices[0].starts_at,undefined);assert.equal(f.writes,1);
});
test('player projection includes identical canonical plan but not private Practice notes',async()=>{
  const f=playerServiceFixture();f.tables.practices[0].team_plan=[row()];f.tables.practices[0].team_plan_revision=2;
  const session=await loadPlayerSession(f.db,uuid(1));
  assert.deepEqual(session.data.practices[0].teamPlan,[row()]);assert.equal(session.data.practices[0].notes,undefined);
});
test('image provider uses strict structured input, no web tools and no storage',async(t)=>{
  let body; t.mock.method(globalThis,'fetch',async(_url,init)=>{body=JSON.parse(init.body);return new Response(JSON.stringify({output_text:'{"items":[],"warnings":[]}',usage:{input_tokens:10,output_tokens:5}}),{status:200});});
  const provider=new OpenAIProvider({apiKey:'fixture-not-a-secret',model:'gpt-5-mini'});
  await provider.generate({system:PLAN_EXTRACTION_INSTRUCTIONS,prompt:'Extract',maxOutputTokens:3000,structured:{name:'practice_plan_v1',schema:PLAN_EXTRACTION_SCHEMA,image:'data:image/png;base64,fixture'}});
  assert.equal(body.store,false);assert.equal(body.tools,undefined);assert.equal(body.text.format.strict,true);assert.equal(body.input[0].content[1].type,'input_image');
});
test('both roles reuse the same view and canonical sync does not overwrite plan columns',()=>{
  const page=readFileSync('app/page.tsx','utf8'),player=readFileSync('app/components/PlayerShell.tsx','utf8'),repo=readFileSync('app/data/supabaseRepository.ts','utf8');
  assert.match(page,/<PracticeTeamPlan/);assert.match(player,/<PracticeTeamPlan/);assert.doesNotMatch(page,/function PracticePlanCard/);
  const sync=repo.slice(repo.indexOf('async function syncPractices'),repo.indexOf('async function syncPractices')+1800);
  assert.doesNotMatch(sync,/team_plan:/);
});
