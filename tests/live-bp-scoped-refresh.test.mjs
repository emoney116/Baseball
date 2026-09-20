import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeLiveBpPracticeSnapshot} from '../app/lib/liveSyncDelta.ts';
import {emptyData} from '../app/lib/askClubhouse/serverData.ts';
test('scoped refresh reconciles Undo removals without replacing another Practice or UI settings',()=>{
 const current=emptyData({availableTeams:[]},{id:'qa'},undefined);
 current.practices=[{id:'p'},{id:'other'}];current.hittingEvents=[{id:'undone',practiceId:'p'},{id:'keep',practiceId:'other'}];
 const remote={practices:[{id:'p',endedAt:'now'}],attendance:[],hittingSessions:[],pitchingSessions:[],defenseSessions:[],hittingEvents:[{id:'new',practiceId:'p'},{id:'foreign',practiceId:'other'}],pitchEvents:[],defenseEvents:[]};
 const next=mergeLiveBpPracticeSnapshot(current,remote,'p');
 assert.deepEqual(next.hittingEvents.map(e=>e.id),['keep','new']);assert.equal(next.settings,current.settings);assert.equal(next.players,current.players);assert.equal(next.practices[1],current.practices[1]);
});
