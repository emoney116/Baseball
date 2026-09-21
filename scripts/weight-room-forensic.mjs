import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {mapWorkoutSession,mapWorkoutEntry,mapPlayer} from '../app/lib/askClubhouse/serverData.ts';
import {buildWeightRoomLeaders} from '../app/lib/weightRoomLeaders.ts';
import {buildWeightRoomScoreRows} from '../app/lib/weightRoom.ts';
const dir=process.argv[2],raw=JSON.parse(readFileSync(join(dir,'weight-room-readonly.json'),'utf8'));
const players=raw.players.map(p=>mapPlayer({...p,active:true,metadata:{}}));
const sessions=raw.sessions.map(mapWorkoutSession);
const entries=raw.entries.map(e=>mapWorkoutEntry(e,raw.exercises.find(x=>x.id===e.exercise_id)));
const report=buildWeightRoomLeaders(players,sessions,entries);
writeFileSync(join(dir,'weight-room-reconciliation.json'),JSON.stringify({report,scores:buildWeightRoomScoreRows(players,sessions,entries,'This Season')},null,2));
const app=JSON.parse(readFileSync(join(dir,'private-app-data.json'),'utf8'));
// Display metadata only; canonical workout rows remain the unmodified export.
app.teamContext.currentTeam={...app.teamContext.currentTeam,organizationName:'Metrolina Baseball',teamName:'Metrolina Fall Ball',seasonName:'Fall 2026'};
app.teamContext.availableTeams=[app.teamContext.currentTeam];
writeFileSync(join(dir,'weight-room-app-data.json'),JSON.stringify({...app,players,workoutSessions:sessions,workoutEntries:entries},null,2));
console.log(JSON.stringify({athletes:report.athletesTrained,days:report.recordedDays,volume:report.volume,leaders:report.volumeLeaders.slice(0,5).map(r=>[r.player.name,r.volume]),tests:report.tests.map(t=>({exercise:t.exercise,condition:t.condition,leaders:t.rows.slice(0,3).map(r=>[r.player.name,r.value])}))},null,2));
