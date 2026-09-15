import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs';
const cli = process.env.AGENT_BROWSER_CLI;
if (!cli) throw new Error('Set AGENT_BROWSER_CLI to the installed agent-browser JavaScript CLI.');
const base = process.env.QA_BASE_URL ?? 'http://localhost:3130';
const output = process.env.QA_OUTPUT_DIR ?? 'outputs/selector-system';
mkdirSync(output, { recursive: true });
let command = 0;
function browser(...args) {
  const path = `${output}/command-${command++}.log`;
  const fd = openSync(path,'w');
  try { execFileSync(process.execPath, [cli, '--session', 'clu9-select-qa', ...args], { stdio: ['ignore',fd,fd], timeout: 45000 }); }
  finally { closeSync(fd); }
  return readFileSync(path,'utf8').trim();
}
browser('open', new URL('/select-preview', base).href);
const read = expression => JSON.parse(browser('eval', expression));
const click = name => browser('find','role','button','click','--name',name,'--exact');
click('Search player');
browser('find','role','textbox','fill','--name','Search options...','Player 40');
browser('press','ArrowDown');
browser('press','Enter');
assert.deepEqual(read(`({selected:document.querySelector('[data-label="Search player"] strong').textContent,focus:document.activeElement.getAttribute('aria-label')})`), { selected: 'Player 40', focus: 'Search player' });
click('Players');
browser('find','role','textbox','fill','--name','Search options...','Player 40');
browser('press','ArrowDown');
assert.equal(read(`document.activeElement.textContent.trim()`),'Player 40');
browser('press','Enter');
click('Cancel');
assert.equal(read(`document.querySelector('output').textContent`),'1,3');
click('Players');
click('Clear');
click('Cancel');
assert.equal(read(`document.querySelector('output').textContent`),'1,3');
click('Players');
click('Clear');
click('Apply');
assert.equal(read(`document.querySelector('output').textContent`),'All');
click('Search player');
click('Outside target');
assert.equal(read(`document.querySelectorAll('.clubhouse-option-overlay').length`),0);
click('Open dialog');
click('Dialog player');
assert.equal(read(`document.querySelector('.clubhouse-option-overlay').matches(':popover-open')`),true);
browser('press','Escape');
assert.deepEqual(read(`({dialog:document.querySelector('dialog').open,focus:document.activeElement.getAttribute('aria-label'),menus:document.querySelectorAll('.clubhouse-option-overlay').length})`),{dialog:true,focus:'Dialog player',menus:0});
click('Close dialog');

const sizes = [[390,844],[430,932],[820,1180],[1180,820],[1440,900]];
const records = [];
for (const [width,height] of sizes) {
  for (const theme of ['light','dark']) {
    browser('press','Escape');
    browser('set','viewport',String(width),String(height));
    browser('eval',`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
    for (const label of ['Search player','Players','Bottom edge']) {
      browser('find','role','button','click','--name',label,'--exact');
      const geometry = JSON.parse(browser('eval',`(()=>{const m=document.querySelector('.clubhouse-option-overlay'),r=m.getBoundingClientRect(),t=document.querySelector('button[aria-label=${JSON.stringify(label)}]').getBoundingClientRect();return {placement:m.dataset.placement,top:r.top,left:r.left,right:r.right,bottom:r.bottom,gap:m.dataset.placement==='top'?t.top-r.bottom:r.top-t.bottom}})()`));
      assert.ok(geometry.top >= 0 && geometry.left >= 0 && geometry.right <= width + 1 && geometry.bottom <= height + 1,JSON.stringify({width,height,theme,label,geometry}));
      if (geometry.placement !== 'sheet') assert.ok(Math.abs(geometry.gap-6)<1,JSON.stringify(geometry));
      if (label === 'Search player') assert.equal(geometry.placement, width<=640?'sheet':'bottom');
      if (label === 'Players') { browser('wait','300'); browser('screenshot',`${output}/select-${width}-${height}-${theme}.png`); }
      browser('press','Escape');
      const focus=JSON.parse(browser('eval',`({label:document.activeElement.getAttribute('aria-label'),open:document.querySelectorAll('.clubhouse-option-overlay').length})`));
      assert.equal(focus.label,label);
      assert.equal(focus.open,0);
      records.push({width,height,theme,label,placement:geometry.placement});
    }
  }
}
console.log(JSON.stringify({checks:records.length,passed:records.length,records},null,2));
