import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { sampleData } from '../app/data/sampleData.ts';

const { chromium } = await import(process.argv[2]);
const url = process.argv[3] ?? 'http://127.0.0.1:3192';
assert.equal(new URL(url).hostname, '127.0.0.1');
const data = structuredClone(sampleData);
const stamp = '2026-10-06T15:00:00.000Z';
data.players = data.players.slice(0, 2).map((player, index) => ({ ...player, name: `QA Athlete ${index + 1}` }));
data.workoutEntries = [];
data.workoutSessions = [];
data.weightRoomWorkouts = [{ id: 'qa-timed-workout', title: 'Weight Room', date: '2026-10-06', status: 'ACTIVE', createdAt: stamp, updatedAt: stamp }];
data.weightRoomWorkoutStations = ['30-Yard Dash', '5-10-5 Shuttle', '300-Yard Shuttle'].map((exerciseName, index) => ({ id: `qa-station-${index}`, workoutId: 'qa-timed-workout', exerciseName, displayOrder: index + 1, targetSets: 2, measurementType: 'TIME', targetStyle: 'Best Time', performanceDirection: 'LOWER_IS_BETTER', unit: 'sec', createdAt: stamp, updatedAt: stamp }));
data.weightRoomWorkoutGroups = [{ id: 'qa-group', workoutId: 'qa-timed-workout', name: 'QA Group', displayOrder: 1, currentStationId: 'qa-station-0', createdAt: stamp, updatedAt: stamp }];
data.weightRoomWorkoutGroupMembers = data.players.map(player => ({ id: `qa-member-${player.id}`, workoutId: 'qa-timed-workout', groupId: 'qa-group', playerId: player.id, participantStatus: 'ASSIGNED', createdAt: stamp, updatedAt: stamp }));
await mkdir('build/qa-dropoff', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [name, width, height] of [['phone', 390, 844], ['ipad', 820, 1180], ['desktop', 1440, 900]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(fixture => { if (!localStorage.getItem('metrolina-fall-practice-store-v1')) localStorage.setItem('metrolina-fall-practice-store-v1', JSON.stringify(fixture)); }, data);
    await page.goto(`${url}/?devBypass=1&view=weights`);
    await page.getByRole('button', { name: 'Resume Workout', exact: true }).first().click();
    await page.getByRole('group', { name: 'Workout entry mode' }).getByRole('button', { name: 'Individual', exact: true }).click();
    const row = page.locator('.weight-room-individual-box-score [role="row"]').filter({ hasText: 'QA Athlete 1' });
    const inputs = row.locator('input');
    await inputs.nth(0).fill('60');
    await inputs.nth(0).press('Enter');
    await inputs.nth(1).fill('66');
    await row.getByRole('status').filter({ hasText: 'Drop-off 10.0%' }).waitFor();
    assert.equal(await inputs.nth(1).evaluate(input => document.activeElement === input), true);
    await inputs.nth(1).press('Enter');
    await inputs.nth(1).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `build/qa-dropoff/${name}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.reload();
    await page.getByRole('button', { name: 'Resume Workout', exact: true }).first().click();
    await page.getByRole('group', { name: 'Workout entry mode' }).getByRole('button', { name: 'Individual', exact: true }).click();
    await row.getByRole('status').filter({ hasText: 'Drop-off 10.0%' }).waitFor();
    await inputs.nth(1).fill('54');
    await row.getByRole('status').filter({ hasText: '10.0% faster' }).waitFor();
    await inputs.nth(1).fill('');
    assert.equal(await row.getByRole('status').count(), 0);
    await page.getByRole('group', { name: 'Workout entry mode' }).getByRole('button', { name: 'Groups', exact: true }).click();
    const groupRow = page.locator('.weight-room-group-matrix [role="row"]').filter({ hasText: 'QA Athlete 1' });
    await groupRow.locator('input').nth(1).fill('72');
    await groupRow.getByRole('status').filter({ hasText: 'Drop-off 20.0%' }).waitFor();
    assert.equal(await page.locator('.weight-room-group-matrix [role="row"]').filter({ hasText: 'QA Athlete 2' }).getByRole('status').count(), 0);
    assert.deepEqual(errors, []);
    console.log(`${name}: Individual/Group focused-input calculation, save/reload, improvement, blank, athlete isolation and page width passed`);
    await context.close();
  }
} finally { await browser.close(); }
