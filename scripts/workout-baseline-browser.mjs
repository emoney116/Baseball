import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { sampleData } from '../app/data/sampleData.ts';
import { BASELINE_TESTING_CIRCUIT } from '../app/lib/workoutTesting.ts';

const { chromium } = await import(process.argv[2]);
const data = structuredClone(sampleData);
const date = '2026-10-27';
const stamp = `${date}T16:00:00Z`;
data.players = data.players.slice(0, 4);
data.players.forEach((p, i) => { p.name = ['Alex Morgan', 'Jordan Ellis', 'Casey Reed', 'Taylor Brooks'][i]; });
data.workoutSessions = data.players.map(p => ({ id: `initial-${p.id}`, playerId: p.id, date: '2026-09-15', weekOf: '2026-09-14', day: 'Tue', completed: true, createdAt: stamp, updatedAt: stamp }));
const tests = BASELINE_TESTING_CIRCUIT.filter(t => !['dead-hang', 'side-plank'].includes(t.conditions.key)).map(t => ({ ...t, conditions: { ...t.conditions, ...(t.conditions.key === 'plate-hold' ? { loadLb: 25 } : {}) } }));
data.workoutEntries = data.players.slice(0, 3).flatMap((p, index) => tests.map((t, j) => ({ id: `initial-${p.id}-${j}`, playerId: p.id, sessionId: `initial-${p.id}`, exercise: t.name, kind: 'Test', testConditions: t.conditions, reps: t.conditions.mode === 'MAX_DURATION' ? undefined : [10, 12, 0][index], value: t.conditions.mode === 'MAX_DURATION' ? [40, 50, 0][index] : undefined, status: 'Completed', createdAt: '2026-09-15T16:00:00Z' })));
data.weightRoomWorkouts = [{ id: 'qa-baseline', title: 'Baseline Retest', date, status: 'ACTIVE', createdAt: stamp, updatedAt: stamp }];
data.weightRoomWorkoutStations = tests.map((t, j) => ({ id: `qa-station-${j}`, workoutId: 'qa-baseline', exerciseName: t.name, displayOrder: j + 1, targetSets: 1, measurementType: t.conditions.mode === 'MAX_DURATION' ? 'TIME' : 'REPS_ONLY', testConditions: t.conditions, createdAt: stamp, updatedAt: stamp }));
data.weightRoomWorkoutGroups = [];
data.weightRoomWorkoutGroupMembers = [];
data.players.slice(0, 3).forEach((p, index) => {
  data.workoutSessions.push({ id: `today-${p.id}`, playerId: p.id, date, weekOf: '2026-10-26', day: 'Tue', completed: false, createdAt: stamp, updatedAt: stamp });
  data.workoutEntries.push({ id: `today-${p.id}`, playerId: p.id, sessionId: `today-${p.id}`, activeWorkoutId: 'qa-baseline', workoutStationId: 'qa-station-0', exercise: 'Pull-Ups', kind: 'Test', testConditions: tests[0].conditions, testAttempt: 1, reps: [15, 9, 3][index], status: 'Completed', createdAt: stamp });
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('build/qa-baseline', { recursive: true });
try {
  for (const [name, width, height] of [['phone', 390, 844], ['ipad', 820, 1180], ['desktop', 1440, 900]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const results = [];
    await context.route('**/rest/v1/**', async route => {
      const url = new URL(route.request().url());
      let body;
      if (url.pathname.endsWith('/weight_room_workouts')) body = { status: 'ACTIVE', ended_at: null, circuit_revision: 0 };
      else if (url.pathname.endsWith('/weight_room_workout_stations')) body = data.weightRoomWorkoutStations.map(s => ({ id: s.id, exercise_name: s.exerciseName, test_conditions: s.testConditions }));
      else if (url.pathname.endsWith('/workout_sets')) body = results;
      else if (url.pathname.endsWith('/rpc/record_workout_test')) {
        const input = route.request().postDataJSON();
        results.push({ id: `saved-${input.athlete}`, player_id: input.athlete, workout_station_id: input.target_station, reps: input.result_value, value: null, test_side: null, test_attempt: 1, test_revision: 0 });
        body = {};
      } else body = [];
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    await page.addInitScript(fixture => localStorage.setItem('metrolina-fall-practice-store-v1', JSON.stringify(fixture)), data);
    await page.goto('http://127.0.0.1:3192/?devBypass=1&view=weights');
    await page.getByRole('button', { name: 'Resume Workout', exact: true }).first().click();
    await page.getByRole('group', { name: 'Workout entry mode' }).getByRole('button', { name: 'Individual', exact: true }).click();
    const table = page.getByRole('table', { name: /athlete results/ });
    await table.getByText('Initial 09/15 · 10 reps', { exact: true }).waitFor();
    const first = page.getByRole('textbox', { name: 'Alex Morgan result', exact: true });
    await first.fill('15');
    await table.getByText('+50.0% vs initial', { exact: true }).waitFor();
    await first.press('Tab');
    await page.getByRole('button', { name: 'Edit Alex Morgan result' }).waitFor();
    await page.getByRole('textbox', { name: 'Jordan Ellis result' }).fill('9');
    await table.getByText('-25.0% vs initial', { exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Casey Reed result' }).fill('3');
    await table.getByText('Initial 0 · now 3', { exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Casey Reed result' }).press('Tab');
    await page.getByRole('button', { name: 'Edit Jordan Ellis result' }).waitFor();
    await page.getByRole('button', { name: 'Edit Casey Reed result' }).waitFor();
    await table.getByText('-25.0% vs initial', { exact: true }).waitFor();
    await table.getByText('No matching baseline').waitFor();
    await page.screenshot({ path: `build/qa-baseline/retest-${name}.png`, fullPage: true });
    assert.ok(await table.getByText('+50.0% vs initial').evaluate(el => el.classList.contains('positive')));
    assert.ok(await table.getByText('-25.0% vs initial').evaluate(el => el.classList.contains('negative')));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    for (const label of await table.locator('small').all()) {
      assert.ok(await label.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'baseline label fits its cell');
    }
    assert.deepEqual(errors, []);
    await page.reload();
    await page.getByRole('button', { name: 'Resume Workout', exact: true }).first().click();
    await page.getByRole('group', { name: 'Workout entry mode' }).getByRole('button', { name: 'Individual', exact: true }).click();
    await table.getByText('+50.0% vs initial', { exact: true }).waitFor();
    await table.getByText('-25.0% vs initial', { exact: true }).waitFor();
    console.log(`${name}: baseline, live draft comparison, persisted save, zero and missing baseline passed`);
    await context.close();
  }
} finally { await browser.close(); }
