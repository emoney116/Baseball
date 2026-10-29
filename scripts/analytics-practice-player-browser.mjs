import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { sampleData } from '../app/data/sampleData.ts';
import { loadPlayerSession } from '../app/lib/playerAccess.ts';
import { playerServiceFixture, uuid } from '../tests/helpers/playerServiceFixture.mjs';

const { chromium } = await import(process.argv[2]);
const origin = 'http://127.0.0.1:3192';
const data = structuredClone(sampleData);
data.players = data.players.slice(0, 2);
data.players[0].name = 'Alex Morgan'; data.players[1].name = 'Jordan Ellis';
const own = data.players[0].id;
data.practices = [{ ...data.practices[0], id: 'qa-practice', date: '2026-10-22' }];
data.pitchingSessions = [{ id:'qa-pitch',practiceId:'qa-practice',pitcherId:own,type:'Live BP' }];
data.hittingSessions = [{ id:'qa-hit',practiceId:'qa-practice',hitterId:own,type:'Live BP' }];
const results = ['Single','Walk','Strikeout','Out','Home Run','HBP','Foul'];
const live = result => ({ source:'Live BP',thrower:'PLAYER',mode:'GAME',result,before:{balls:0,strikes:0,outs:0,pa:1,runners:[]},after:{balls:0,strikes:0,outs:result==='Out'||result==='Strikeout'?1:0,pa:2,runners:[]} });
data.pitchEvents = results.map((result,i)=>({...data.pitchEvents[0],id:`p-${i}`,pitcherId:own,practiceId:'qa-practice',sessionId:'qa-pitch',velocity:70+i,liveBpContext:live(result),isStrike:result!=='Walk',createdAt:'2026-10-22T18:00:00Z'}));
data.hittingEvents = results.map((result,i)=>({...data.hittingEvents[0],id:`h-${i}`,hitterId:own,practiceId:'qa-practice',sessionId:'qa-hit',isLiveBp:true,liveBpContext:live(result),action:['Single','Out','Home Run'].includes(result)?'Ball in play':result==='Strikeout'?'Miss':result==='Foul'?'Foul':'Took pitch',exitVelocityMph:result==='Single'?90:undefined}));
data.gameEvents=[];
data.workoutSessions=[{id:'qa-workout',playerId:own,date:'2026-10-22',completed:true}];
data.workoutEntries=[{id:'qa-set',sessionId:'qa-workout',playerId:own,exercise:'Dumbbell Bench Press',setNumber:1,weight:40,reps:20,unit:'lb',status:'Completed'}];
data.weightRoomWorkouts=[]; data.weightRoomWorkoutStations=[];
const f=playerServiceFixture();
const player=await loadPlayerSession(f.db,uuid(1));
player.context.playerId=own; player.context.name='Alex Morgan';
player.contexts=[player.context];
player.data={...data,players:[data.players[0]],teamContext:player.data.teamContext};
const user={id:uuid(1),email:'local-qa@example.test',aud:'authenticated',role:'authenticated',created_at:'2026-10-22T18:00:00Z',app_metadata:{},user_metadata:{}};
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const auth={access_token:`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})}.local`,refresh_token:'local-fixture-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir('build/qa-analytics',{recursive:true});
try {
  for(const [size,width,height] of [['phone',390,844],['small-phone',360,780],['ipad',820,1180],['desktop',1440,900]]) {
    for(const role of ['coach','player']) {
      const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      await context.route('http://127.0.0.1:1/**',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(route.request().url().includes('/auth/v1/user')?user:[])}));
      if(role==='coach') await page.addInitScript(d=>localStorage.setItem('metrolina-fall-practice-store-v1',JSON.stringify(d)),data);
      else {
        await context.addCookies([{name:'sb-127-auth-token',value:`base64-${b64(auth)}`,url:origin}]);
        await context.route('**/api/player/session?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(player)}));
      }
      await page.goto(`${origin}/?${role==='coach'?'devBypass=1':'workspace=player'}&view=analytics`);
      await page.getByRole('button',{name:'Pitching',exact:true}).click();
      try { await page.getByRole('row',{name:'Open Alex Morgan analytics'}).waitFor({timeout:10000}); }
      catch(error) { await page.screenshot({path:`build/qa-analytics/failure-${role}-${size}.png`,fullPage:true}); console.log(await page.locator('body').innerText()); throw error; }
      assert.ok((await page.locator('.analytics-table-panel').innerText()).includes('73'));
      assert.equal(await page.getByLabel('Analytics athlete',{exact:true}).count(),role==='coach'?1:0);
      if(role==='coach') {
        await page.getByLabel('Analytics athlete',{exact:true}).click();
        await page.getByRole('option',{name:'Jordan Ellis',exact:true}).click();
        await page.getByText('No tracked data for this selection yet.',{exact:true}).waitFor();
        await page.getByLabel('Analytics athlete',{exact:true}).click();
        await page.getByRole('option',{name:'All athletes',exact:true}).click();
        await page.getByRole('row',{name:'Open Alex Morgan analytics'}).waitFor();
      }
      await page.getByRole('button',{name:'Filters',exact:true}).click();
      const filterPanel=page.getByRole('dialog',{name:'Analytics filters'});
      await filterPanel.waitFor();
      const bounds=await filterPanel.boundingBox();
      assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width+1 && bounds.y>=0 && bounds.y+bounds.height<=height+1,'filter panel fits viewport');
      await page.keyboard.press('Escape');
      await page.locator('.analytics-domain-tabs').getByRole('button',{name:'Weight Room',exact:true}).click();
      const records=page.getByRole('region',{name:'Weight Room saved results'});
      await records.getByText('Dumbbell Bench Press',{exact:true}).waitFor();
      assert.ok((await records.innerText()).includes('40'));
      assert.ok((await records.innerText()).includes('20'));
      await page.screenshot({path:`build/qa-analytics/${role}-weights-${size}.png`,fullPage:true});
      await page.reload();
      await records.getByText('Dumbbell Bench Press',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Hitting',exact:true}).click();
      await page.getByRole('row',{name:'Open Alex Morgan analytics'}).waitFor();
      await page.getByRole('button',{name:'All Events',exact:true}).first().click();
      await page.getByLabel('Analytics start date').fill('2026-10-01');
      await page.getByLabel('Analytics end date').fill('2026-10-29');
      await page.keyboard.press('Escape');
      await page.screenshot({path:`build/qa-analytics/${role}-hitting-${size}.png`,fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no document overflow');
      if(role==='player') assert.equal((await page.locator('body').innerText()).includes('Jordan Ellis'),false);
      assert.deepEqual(errors,[]);
      console.log(`${role} ${size}: pitching velocity, saved weights, domain switching, dates, privacy and layout passed`);
      await context.close();
    }
  }
} finally { await browser.close(); }
