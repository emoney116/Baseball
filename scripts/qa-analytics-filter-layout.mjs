import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {closeSync,mkdirSync,openSync,readFileSync,writeFileSync} from 'node:fs';

const cli=process.env.AGENT_BROWSER_CLI,url=process.env.QA_URL,state=process.env.QA_BROWSER_STATE;
if(!cli||!url||!state)throw Error('Set AGENT_BROWSER_CLI, QA_URL to coach Analytics, and QA_BROWSER_STATE to private browser storage.');
const output='outputs/analytics-filter-layout';mkdirSync(output,{recursive:true});let sequence=0;
function browser(...args){const path=`${output}/${sequence++}.log`,fd=openSync(path,'w');try{execFileSync(process.execPath,[cli,'--session','clu9-analytics-qa',...args],{stdio:['ignore',fd,fd],timeout:45000});}finally{closeSync(fd);}return readFileSync(path,'utf8').trim();}
const read=code=>JSON.parse(browser('eval',code));
browser('state','load',state);browser('open',url);
for(let i=0;i<60&&!read(`!![...document.querySelectorAll('button')].find(e=>e.textContent==='Filters')`);i++)browser('wait','250');
const results=[];
for(const [width,height] of [[390,844],[430,932],[820,1180],[1180,820],[1440,900]])for(const theme of ['light','dark']){
 browser('set','viewport',String(width),String(height));browser('eval',`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
 browser('find','role','button','click','--name','Filters','--exact');browser('wait','300');
 const result=read(`(()=>{
  const rect=s=>document.querySelector(s)?.getBoundingClientRect().toJSON();
  const button=[...document.querySelectorAll('.analytics-filter-sheet__footer button')].find(e=>e.textContent.includes('Apply Filters'));
  const r=button?.getBoundingClientRect();const target=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return {panel:rect('.analytics-filter-sheet'),head:rect('.analytics-filter-sheet__head'),body:rect('.analytics-filter-sheet__body'),footer:rect('.analytics-filter-sheet__footer'),applyVisible:!!button&&button.contains(target)};
 })()`);
 assert.ok(result.panel&&result.head&&result.body&&result.footer,JSON.stringify(result));
 assert.ok(result.panel.top>=0&&result.panel.bottom<=height+1&&result.panel.left>=0&&result.panel.right<=width+1,JSON.stringify(result));
 assert.ok(result.head.bottom<=result.body.top+1,'Filter header overlaps body');
 assert.ok(result.body.bottom<=result.footer.top+1,'Filter body overlaps footer');
 assert.ok(result.applyVisible,'Apply action is obscured');
 browser('screenshot',`${output}/${width}-${height}-${theme}.png`);
 browser('press','Escape');browser('wait','100');
 assert.equal(read('!!document.querySelector(".analytics-filter-sheet")'),false,'Escape must remove the panel, not only focus its trigger');
 assert.equal(read('document.activeElement?.textContent'),'Filters');
 results.push({width,height,theme,...result});
}
writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2));
console.log('PASS',results.length,'Analytics panel bounds, header/body/footer separation, Apply hit target and Escape focus checks. No filters applied.');
for(const [width,height] of [[390,844],[820,1180],[1440,900]])for(const label of ['All Events','Columns: Standard']){
 browser('set','viewport',String(width),String(height));
 browser('find','role','button','click','--name',label,'--exact');browser('wait','300');
 const r=read(`document.querySelector('.analytics-popover')?.getBoundingClientRect().toJSON()`);
 assert.ok(r&&r.top>=0&&r.bottom<=height+1&&r.left>=0&&r.right<=width+1,JSON.stringify({label,width,r}));
 assert.ok(read(`document.querySelector('.analytics-popover')?.contains(document.activeElement)`),'Focus must enter the panel');
 browser('press','Shift+Tab');
 assert.ok(read(`document.querySelector('.analytics-popover')?.contains(document.activeElement)`),'Backward Tab must remain in the panel');
 browser('press','Tab');
 assert.ok(read(`document.querySelector('.analytics-popover')?.contains(document.activeElement)`),'Forward Tab must remain in the panel');
 browser('press','Escape');browser('wait','100');
 assert.equal(read(`!!document.querySelector('.analytics-popover')`),false);
 assert.equal(read(`document.activeElement?.textContent`),label);
 browser('find','role','button','click','--name',label,'--exact');browser('wait','100');
 const outside=read(`(()=>{for(const y of [12,60,innerHeight-12])for(const x of [12,innerWidth-12])if(document.elementFromPoint(x,y)?.classList.contains('analytics-sheet-scrim'))return {x,y};return null;})()`);
 assert.ok(outside,'A visible scrim target must be available outside the panel');
 browser('mouse','move',String(outside.x),String(outside.y));browser('mouse','down');browser('mouse','up');browser('wait','100');
 assert.equal(read(`!!document.querySelector('.analytics-popover')`),false,'Outside dismissal must remove the panel');
}
console.log('PASS 6 Events/Columns viewport, focus entry, Tab containment, Escape and outside-dismissal checks. No selection changes.');
