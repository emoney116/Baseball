// Development-only UI verification. This is not hosted authorization acceptance.
import { execFileSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const cli=process.argv[2], base=process.env.QA_BASE_URL ?? 'http://localhost:3123', out='outputs/player-personal';
if(!cli) throw Error('Pass installed agent-browser CLI path.');
mkdirSync(out,{recursive:true});
let sequence=0; const results=[];
function browser(...args){const path=`${out}/command-${sequence++}.log`,fd=openSync(path,'w');try{execFileSync(process.execPath,[cli,'--session','personal-qa',...args],{stdio:['ignore',fd,fd],timeout:45000});}finally{closeSync(fd);}return readFileSync(path,'utf8').trim();}
const evaluate=code=>JSON.parse(browser('eval',code));
const button=name=>browser('find','role','button','click','--name',name,'--exact');
function until(code){for(let n=0;n<25;n++){if(evaluate(code))return;browser('wait','200');}throw Error(`Timed out: ${code}`);}
try{
 for(const [width,height] of [[390,844],[430,932],[820,1180],[1180,820]]){
  browser('set','viewport',`${width}`,`${height}`);
  browser('open',`${base}/player-personal-preview`); browser('snapshot');
  for(const [title,result] of [['Personal Hitting Session','Miss'],['Personal Bullpen','Whiff'],['Personal Defense Session','Clean']]){
   until("document.body.textContent.includes('Start Personal Hitting Session')");
   button(`Start ${title}`);until("!!document.querySelector('.player-live-form')");
   button(result);button('Save Rep');until("document.querySelector('.player-live-message')?.textContent.includes('saved')");
   const size=evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,fields:[...document.querySelectorAll('.player-live-form input,.player-live-form select,.player-live-form button')].every(e=>{const r=e.getBoundingClientRect();return !r.width||(r.left>=0&&r.right<=innerWidth+1)})})");
   assert.ok(size.scroll<=width&&size.fields);
   browser('screenshot',`${out}/${width}-${title.replaceAll(' ','-')}.png`);
   button('End Session');until("!document.querySelector('.player-live-form')");
   results.push({width,height,title,passed:true});
  }
  for(const mode of ['VIEW_ONLY','TRACK_AND_VIEW','FULL_PLAYER']){
   browser('select','label:nth-child(1) select',mode);
   for(const policy of ['LIVE_ONLY','PERSONAL_AND_LIVE']){
    browser('select','label:nth-child(2) select',policy);
    const allowed=mode!=='VIEW_ONLY'&&policy==='PERSONAL_AND_LIVE';
    until(`document.body.textContent.includes('Start Personal Hitting Session')===${allowed}`);
    results.push({width,height,mode,policy,passed:true});
   }
  }
  console.log(`${width}x${height}: Personal UI passed`);
 }
 writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
 console.log(JSON.stringify({cases:results.length,passed:results.length}));
}finally{browser('close');}
