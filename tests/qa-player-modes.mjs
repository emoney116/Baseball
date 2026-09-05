// Run against synthetic development fixtures only, using the installed agent-browser CLI.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const cli = process.argv[2];
if (!cli) throw new Error('Pass the installed agent-browser/bin/agent-browser.js path.');
const base = 'http://localhost:3110';
const out = 'outputs/clu947';
mkdirSync(out, { recursive: true });
function browser(...args) { return execFileSync(process.execPath, [cli, '--session', 'clu947', ...args], {encoding:'utf8',timeout:45000}).trim(); }
const evaluate = code => JSON.parse(browser('eval', code));
const rows=[];
for(const [width,height] of [[390,844],[430,932],[820,1180],[1180,820],[1440,900]]) {
  browser('set','viewport',String(width),String(height));
  browser('open',`${base}/player-access-preview`);
  browser('click','.player-access-overrides summary');
  browser('snapshot');
  for(const label of ['View Only','Track & View','Full Player']) {
    browser('find','role','button','click','--name',label,'--exact');
    assert.equal(evaluate("document.querySelector('.player-access-modes [aria-pressed=true]').textContent"),label);
  }
  const selector='.player-access-row:nth-of-type(1) select';
  browser('select',selector,'VIEW_ONLY');
  assert.equal(evaluate("document.querySelector('.player-access-row select').value"),'VIEW_ONLY');
  browser('select',selector,'');
  assert.equal(evaluate("document.querySelector('.player-access-row select').value"),'');
  let dims=evaluate('({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth})');
  assert.equal(dims.width,width);assert.equal(dims.height,height);assert.ok(dims.scroll<=width);
  browser('screenshot',`${out}/coach-${width}.png`);
  rows.push({surface:'coach',width,height,passed:true});
  for(const mode of ['VIEW_ONLY','TRACK_AND_VIEW','FULL_PLAYER']) {
    browser('open',`${base}/player-preview?access=${mode}`);
    browser('snapshot');
    const state=evaluate("({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,tracking:!!document.querySelector('.player-self-tracking'),ask:!!document.querySelector('[aria-label=\"Ask Clubhouse\"]'),staff:!!document.querySelector('[aria-label=\"Player Access\"]')})");
    assert.equal(state.width,width);assert.ok(state.scroll<=width);assert.equal(state.tracking,mode!=='VIEW_ONLY');assert.equal(state.ask,true);assert.equal(state.staff,false);
    browser('screenshot',`${out}/${mode.toLowerCase()}-${width}.png`);
    if(mode!=='VIEW_ONLY') {
      browser('find','role','button','click','--name','Body Weight','--exact');browser('snapshot');
      browser('fill','input[type=number]','182.5');
      assert.equal(evaluate("document.querySelector('input[type=number]').value"),'182.5');
      assert.ok(evaluate('document.documentElement.scrollWidth<=innerWidth'));
      browser('find','role','button','click','--name','Save','--exact');browser('snapshot');
      assert.equal(evaluate("document.querySelector('[role=alert]').textContent"),'Preview only. No records were saved.');
      browser('screenshot',`${out}/body-weight-${mode.toLowerCase()}-${width}.png`);
    }
    browser('find','role','button','click','--name','More','--exact');browser('snapshot');
    assert.equal(evaluate("Array.from(document.querySelectorAll('h2')).some(e=>e.textContent==='Team Roster')"),mode==='FULL_PLAYER');
    browser('screenshot',`${out}/more-${mode.toLowerCase()}-${width}.png`);
    rows.push({surface:mode,width,height,passed:true});
  }
}
writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));
console.log(JSON.stringify({cases:rows.length,passed:rows.length,results:out}));
