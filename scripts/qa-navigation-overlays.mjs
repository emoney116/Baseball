import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {closeSync,mkdirSync,openSync,readFileSync} from 'node:fs';
const cli=process.env.AGENT_BROWSER_CLI,url=process.env.QA_URL,state=process.env.QA_BROWSER_STATE;
if(!cli||!url||!state)throw Error('Set AGENT_BROWSER_CLI, QA_URL to a signed-in coach page, and QA_BROWSER_STATE to private browser storage.');
const output='outputs/navigation-overlays';mkdirSync(output,{recursive:true});let sequence=0;
function browser(...args){const path=`${output}/${sequence++}.log`,fd=openSync(path,'w');try{execFileSync(process.execPath,[cli,'--session','clu9-nav-qa',...args],{stdio:['ignore',fd,fd],timeout:45000});}finally{closeSync(fd);}return readFileSync(path,'utf8').trim();}
const read=code=>JSON.parse(browser('eval',code));
const more=()=>browser('find','role','button','click','--name','More navigation','--exact');
browser('state','load',state);browser('set','viewport','820','1180');browser('open',url);
for(let i=0;i<60&&!read(`!!document.querySelector('button[aria-label="More navigation"]')`);i++)browser('wait','250');
for(const theme of ['light','dark']){
 browser('set','viewport','820','1180');browser('eval',`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
 more();browser('wait','250');
 const r=read(`(()=>{const r=document.querySelector('.mobile-more-menu').getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}})()`);
 assert.ok(r.top>=0&&r.bottom<=1180&&r.left>=0&&r.right<=820,JSON.stringify(r));
 browser('press','Escape');assert.equal(read(`document.activeElement.getAttribute('aria-label')`),'More navigation');
 more();browser('click','.mobile-more-dismiss');assert.equal(read(`!!document.querySelector('.mobile-more-menu')`),false);
 more();browser('set','viewport','1180','820');browser('wait','300');
 assert.equal(read(`!!document.querySelector('.mobile-more-menu,.mobile-more-dismiss')`),false,'Hidden trigger must dismiss menu and blocking layer');
 console.log('PASS',theme,'anchoring, Escape/focus, outside dismissal and portrait-to-landscape closure');
}
