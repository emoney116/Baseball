import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';

function sourceFiles(directory){
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sourceFiles(join(directory,entry.name)):entry.name.endsWith('.tsx')?[join(directory,entry.name)]:[]);
}
test('native selects are limited to documented rapid-entry and development exceptions',()=>{
  const actual=Object.fromEntries(sourceFiles('app').flatMap(path=>{
    const count=(readFileSync(path,'utf8').match(/<select\b/g)??[]).length;
    return count?[[path.replaceAll('\\','/'),count]]:[];
  }));
  assert.deepEqual(actual,{
    'app/components/DemoDataQaPanel.tsx':3,
    'app/components/PlayerLiveEntry.tsx':1,
    'app/page.tsx':3,
    'app/player-live-preview/preview.tsx':3,
    'app/player-personal-preview/preview.tsx':2,
  });
});
test('Practice and profile context menus use the shared positioned overlay',()=>{
  const page=readFileSync('app/page.tsx','utf8');
  assert.match(page,/<ClubhouseOptionSheet title="Start hitting session"/);
  assert.match(page,/<ClubhouseOptionSheet title="My account"/);
  assert.match(page,/<ClubhouseOptionSheet title="Game commands"/);
  assert.match(page,/<ChoiceSelect label="All new players" aria-label="Apply roster status to all manual rows"/);
  assert.doesNotMatch(page,/className="(?:profile-menu__panel|practice-hitting-start-popover)"/);
});
test('Game Center identifies the selected team rather than a hard-coded organization',()=>{
  const page=readFileSync('app/page.tsx','utf8');
  assert.match(page,/const currentGameTeamName = data\.teamContext\?\.currentTeam\?\.teamName \?\? "Our team"/);
  assert.match(page,/<GameScoreRibbon game=\{game\} teamName=\{currentGameTeamName\}/);
  assert.doesNotMatch(page,/<strong>Metrolina <em>vs<\/em>/);
  assert.doesNotMatch(page,/"Metrolina batting"|"Metrolina pitching"/);
  assert.doesNotMatch(page,/>[+−] Metro(?: Run)?</);
  const css=readFileSync('app/game-session.css','utf8');
  assert.match(css,/\.game-field-command__surface \.practice-spray-field__mode\s*\{\s*display: none;/);
});
test('Player settings selectors use the full row after label migration',()=>{
  const css=readFileSync('app/player-access.css','utf8');
  assert.match(css,/\.player-access-default-row\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
});
test('Analytics filter sheet does not insert a second handle into its content grid',()=>{
  const css=readFileSync('app/globals.css','utf8');
  assert.match(css,/\.analytics-filter-sheet::before\s*\{\s*content: none;/);
});
test('bottom navigation menus dismiss hidden triggers and follow the visual viewport',()=>{
  const page=readFileSync('app/page.tsx','utf8');
  const hook=page.slice(page.indexOf('function useBottomNavMenuStyle('),page.indexOf('type WeightRoomSetDraft'));
  assert.match(hook,/if \(!rect\.width \|\| !rect\.height\)\s*\{\s*setOpen\(false\)/);
  assert.match(hook,/visualViewport\?\.addEventListener\("resize", updatePosition\)/);
  assert.match(hook,/visualViewport\?\.removeEventListener\("resize", updatePosition\)/);
  assert.match(hook,/overflowY: "auto"/);
});
