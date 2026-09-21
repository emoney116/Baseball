import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
const [directory,cli]=process.argv.slice(2);
if(!directory||!cli)throw new Error('Private evidence directory and agent-browser CLI path required');
const run=(...args)=>execFileSync(process.execPath,[cli,'--session','recap-v2',...args],{encoding:'utf8',timeout:45000}).trim();
const results=[];
for(const theme of ['dark','light'])for(const [width,height] of [[390,844],[430,932],[820,1180],[1180,820],[1440,900]]) {
  run('set','viewport',String(width),String(height));run('set','media',theme);
  const check=run('eval',`JSON.stringify({overflow:document.documentElement.scrollWidth>innerWidth,height:document.documentElement.scrollHeight,metrics:Array.from(document.querySelectorAll('dt')).map(e=>[e.textContent,e.nextElementSibling.textContent]),overflows:Array.from(document.querySelectorAll('dt,dd,li')).filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)})`);
  const parsed=JSON.parse(JSON.parse(check));
  if(parsed.overflow||parsed.overflows.length)throw new Error(`Layout overflow ${width} ${theme}: ${check}`);
  for(const [label,value] of [['Runs','5'],['Pitches','86'],['BIP','46']])
    if(!parsed.metrics.some(m=>m[0]===label&&m[1]===value))throw new Error(`Missing ${label} ${value}`);
  if(width<500&&parsed.height>height*2)throw new Error('Overview exceeds two screens');
  run('screenshot',join(directory,`recap-v2-${width}-${theme}.png`),'--full');
  results.push({width,height,theme,...parsed});
}
writeFileSync(join(directory,'recap-v2-layout-qa.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({layouts:results.length,passed:true}));
