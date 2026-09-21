import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const [directory,cli]=process.argv.slice(2);
const run=(...args)=>execFileSync(process.execPath,[cli,'--session','recap-v2',...args],{encoding:'utf8',timeout:45000}).trim();
const evaluate=script=>execFileSync(process.execPath,[cli,'--session','recap-v2','eval','--stdin'],{input:script,encoding:'utf8',timeout:45000}).trim();
const data=JSON.parse(readFileSync(join(directory,'private-app-data.json'),'utf8'));
// The forensic export intentionally omits directory display metadata.
data.teamContext.currentTeam={...data.teamContext.currentTeam,teamName:'Private Practice QA',organizationName:'Private QA',seasonName:'Fall 2026'};
data.teamContext.availableTeams=[data.teamContext.currentTeam];
data.teamContext.profile={...data.teamContext.profile,displayName:'QA Coach',firstName:'QA',lastName:'Coach'};
const practice=data.practices[0];
const base=process.env.RECAP_QA_BASE??'http://127.0.0.1:3188';
run('open',base+'/?devBypass=1');
evaluate(`localStorage.setItem('metrolina-fall-practice-store-v1',${JSON.stringify(JSON.stringify(data))}); 'Local fixture loaded'`);
const results=[];
for(const theme of ['dark','light'])for(const [width,height] of [[390,844],[430,932],[820,1180],[1180,820],[1440,900]]) {
  run('set','viewport',String(width),String(height));
  data.settings.theme=theme;
  evaluate(`localStorage.setItem('metrolina-fall-practice-store-v1',${JSON.stringify(JSON.stringify(data))});localStorage.setItem('clubhouse9-theme:device',${JSON.stringify(theme)});localStorage.setItem(${JSON.stringify('clubhouse9-theme:'+data.teamContext.profile.id)},${JSON.stringify(theme)}); 'Theme set'`);
  for(const tab of ['Summary','Hitting','Pitching','Defense','Situational']) {
    run('open',`${base}/?devBypass=1&view=practice&practicePanel=review&practiceId=${practice.id}&practiceReviewTab=${tab}`);
    run('wait','[aria-label="Recorded Practice metrics"]');
    const raw=evaluate(`JSON.stringify({theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth,height:document.querySelector('.practice-review-page').getBoundingClientRect().height,text:document.querySelector('.practice-review-page').innerText,metrics:Array.from(document.querySelectorAll('.practice-review-page dt')).map(e=>[e.textContent,e.nextElementSibling.textContent]),overflows:Array.from(document.querySelectorAll('.practice-review-page dt,.practice-review-page dd,.practice-review-tabs button')).filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)})`);
    const check=JSON.parse(JSON.parse(raw));
    if(check.theme!==theme)throw new Error(`Theme not applied: ${check.theme}`);
    if(check.overflow||check.overflows.length)throw new Error(`Overflow ${tab} ${width} ${theme}`);
    if(tab==='Defense'&&!check.text.includes('Not tracked'))throw new Error('Defense availability');
    for(const [label,value] of tab==='Situational'?[['Runs','5'],['Runner advances','16'],['Runner outs','2']]:tab==='Hitting'?[['Hitting events','86'],['BIP','46']]:[])
      if(!check.metrics.some(m=>m[0]===label&&m[1]===value))throw new Error(`Wrong ${label}`);
    if(tab==='Hitting'&&(!check.text.includes('20 measured')||!check.text.includes('24 / 46')))throw new Error('Sample mismatch');
    if(tab==='Summary'&&width<500&&check.height>height*2)throw new Error(`Overview too tall ${check.height}`);
    run('screenshot',join(directory,`recap-app-${tab}-${width}-${theme}.png`),'--full');
    results.push({tab,width,height,theme,...check});
  }
}
writeFileSync(join(directory,'recap-app-qa.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({checks:results.length,passed:true}));
