import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cityLocationBias } from '../app/lib/cityLocationBias.ts';
import { contextualLocationQuery, rankVenueSuggestions } from '../app/lib/locationContext.ts';
import { googlePlacesProvider } from '../app/lib/googlePlacesProvider.ts';

test('legacy Indian Trail city/state produces a local 35 km bias without a provider', () => {
  const bias = cityLocationBias(' Indian Trail ', 'nc');
  assert.equal(bias.radius, 35000);
  assert.ok(bias.latitude > 35 && bias.latitude < 35.2);
  assert.ok(bias.longitude < -80.5 && bias.longitude > -80.8);
});
test('city context supports different US regions, not a Metrolina-only lookup', () => {
  assert.ok(cityLocationBias('Seattle', 'WA').longitude < -120);
  assert.ok(cityLocationBias('Boston', 'MA').longitude > -75);
  assert.ok(cityLocationBias('Austin', 'TX').latitude < 31);
});
test('unknown or incomplete city context does not guess coordinates', () => {
  assert.equal(cityLocationBias('Not a real city', 'NC'), undefined);
  assert.equal(cityLocationBias('Springfield'), undefined);
});
test('local near clause uses bias while explicit away search remains intact', () => {
  const context = { city: 'Indian Trail', bias: cityLocationBias('Indian Trail', 'NC') };
  assert.equal(contextualLocationQuery('baseball field near Indian Trail', context), 'baseball field');
  assert.equal(contextualLocationQuery('baseball field near Boston', context), 'baseball field near Boston');
});
test('MCA venue query expands the actual organization and prioritizes its field', () => {
  const context = { organizationName: 'Metrolina Christian Academy' };
  const query = contextualLocationQuery('MCA Baseball Field', context);
  const campus = { title: 'Metrolina Christian Academy', providerPlaceId: 'campus' };
  const field = { title: 'Metrolina Christian Academy Athletic Fields', providerPlaceId: 'field' };
  assert.equal(rankVenueSuggestions([campus, field], query, context)[0], field);
  assert.deepEqual(rankVenueSuggestions([campus, field], 'Charlotte Christian School', context), [campus, field]);
});
test('Google request uses contextual bias, US regions, and no hard restriction or narrow type filter', async () => {
  let request;
  const provider = googlePlacesProvider('test-only', async (_url, init) => { request = JSON.parse(init.body); return Response.json({ suggestions: [] }); });
  await provider.autocomplete('baseball field', 'token', undefined, cityLocationBias('Indian Trail', 'NC'));
  assert.equal(request.locationBias.circle.radius, 35000);
  assert.deepEqual(request.includedRegionCodes, ['us']);
  assert.equal(request.regionCode, 'us');
  assert.equal(request.locationRestriction, undefined);
  assert.equal(request.includedPrimaryTypes, undefined);
});
test('organization management uses shared location controls instead of state/city selectors', () => {
  const source = readFileSync('app/org/[id]/manage/OrgManageClient.tsx', 'utf8');
  assert.doesNotMatch(source, /cityOptionsForState|US_STATE_OPTIONS|aria-label="Organization city"|aria-label="Team state"/);
  assert.match(source, /LocationDefaultSettings organizationId/);
  assert.match(source, /locationId: addTeamDraft.locationId/);
});
test('scheduled practice and game creation retain canonical location references', () => {
  const source = readFileSync('app/page.tsx', 'utf8').split('function ScheduleEventModal(')[1].split('function ')[0];
  assert.match(source, /setLocationId/);
  const page = readFileSync('app/page.tsx', 'utf8');
  assert.doesNotMatch(page, /placeholder="Varsity Field or address"/);
  assert.match(page, /global-score-row--/);
});
test('saved location display remains identifiable after reload without fetching Google', () => {
  const picker = readFileSync('app/components/ClubhouseLocationPicker.tsx', 'utf8');
  assert.match(picker, /Saved Google place/);
  assert.match(picker, /locationMapsUrl\(location\)/);
  assert.doesNotMatch(picker, /localStorage|sessionStorage/);
});
test('switching creation modes clears location selected under the previous scope', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  assert.match(page, /if \(mode !== "organization"\) setTeamLocation\(undefined\)/);
  assert.match(page, /if \(mode !== "existing"\) setTeamLocation\(undefined\)/);
});
