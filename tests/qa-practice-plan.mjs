import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const base = process.argv[3] ?? 'http://localhost:3121';
assert.equal(new URL(base).hostname,'localhost');
const browser = await chromium.launch({channel:'msedge',headless:true});
const output='outputs/practice-plan';mkdirSync(output,{recursive:true});
let passed=0;const errors=[];
try {
 const context=await browser.newContext();
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for (const [width,height] of [[390,844],[430,932],[820,1180],[1180,820]]) {
  await page.setViewportSize({width,height});await page.goto(base+'/practice-plan-preview');
  // The canonical content is rendered twice with only coach actions different.
  await page.getByRole('button',{name:'Import Plan',exact:true}).click();
  await page.getByRole('textbox',{name:'Practice message'}).fill('325p meeting 335p warm up 345/350p throw 405p position work 425p hitting rotations 5p end');
  await page.getByRole('button',{name:'Extract Plan',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('heading',{name:'Review Practice Plan'}).waitFor();
  assert.equal(await page.getByText('Existing Plan',{exact:true}).count(),2);
  assert.equal(await dialog.locator('.plan-review-list > li').count(),6);
  await page.screenshot({path:`${output}/review-${width}.png`});
  const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y>=0&&bounds.y+bounds.height<=height+1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await page.getByText('Existing Plan',{exact:true}).count(),2);
  await page.getByRole('button',{name:'Import Plan',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBz0AAAAASUVORK5CYII=','base64')});
  await page.getByRole('button',{name:'Extract Plan',exact:true}).click();
  await dialog.locator('.plan-row-summary').filter({hasText:'Warm Up'}).click();
  await dialog.getByRole('button',{name:'Move Warm Up up',exact:true}).click();
  await dialog.locator('.plan-row-summary').filter({hasText:'End'}).click();
  await dialog.getByRole('button',{name:'Delete End',exact:true}).click();
  await dialog.getByRole('button',{name:'Add Row',exact:true}).click();
  await dialog.getByRole('textbox',{name:'Row activity',exact:true}).fill('End');
  await dialog.getByRole('textbox',{name:'Row time',exact:true}).fill('5p');
  await dialog.getByRole('combobox',{name:'Publish mode'}).selectOption('replace');
  await dialog.getByRole('button',{name:'Publish Plan',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  const lists=await page.locator('.team-plan-schedule').allTextContents();assert.equal(lists[0],lists[1]);assert.match(lists[0],/3:45-3:50 PM/);assert.doesNotMatch(lists[0],/Existing Plan/);
  await page.screenshot({path:`${output}/published-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Edit Plan',exact:true}).click();
  await dialog.getByRole('button',{name:'Add Row',exact:true}).click();
  await dialog.getByRole('textbox',{name:'Row activity',exact:true}).fill('Conditioning');
  await dialog.getByRole('button',{name:'Publish Plan',exact:true}).click();
  await dialog.waitFor({state:'hidden'});assert.equal(await page.getByText('Conditioning',{exact:true}).count(),2);
  await page.getByRole('button',{name:'Import Plan',exact:true}).click();
  await page.getByRole('textbox',{name:'Practice message'}).fill('schedule');
  await page.getByRole('button',{name:'Extract Plan',exact:true}).click();
  await dialog.getByRole('combobox',{name:'Publish mode'}).selectOption('merge');
  await dialog.getByRole('button',{name:'Publish Plan',exact:true}).click();await dialog.waitFor({state:'hidden'});
  assert.equal(await page.locator('.team-plan-schedule').first().locator('li').count(),13);
  assert.equal(await page.getByRole('button',{name:'Import Plan',exact:true}).count(),1);
  passed++;
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed,errors,output,extraction:'mocked; upload/review/publish UI only'}));
} finally {await browser.close();}
