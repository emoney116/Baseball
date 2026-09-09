import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readPreviousLocations } from "../app/lib/placesRepository.ts";
import { reuseClubhouseLocation } from "../app/lib/locationSave.ts";
const own = "10000000-0000-4000-8000-000000000001";
const foreign = "10000000-0000-4000-8000-000000000002";
function database(rows) {
  return { from(table) {
    assert.equal(table, "clubhouse_locations");
    const filters = []; let insert;
    const result = () => ({ data: insert ? [insert] : rows.filter(row => filters.every(fn => fn(row))), error: null });
    const query = {
      select() { return query; }, order() { return query; }, limit() { return Promise.resolve(result()); },
      eq(key,value) { filters.push(row => row[key] === value); return query; },
      is(key,value) { filters.push(row => (row[key] ?? null) === value); return query; },
      insert(value) { insert = { ...value, id: "20000000-0000-4000-8000-000000000003" }; rows.push(insert); return query; },
      single() { return Promise.resolve({ ...result(), data: result().data[0] }); },
      maybeSingle() { return query.single(); },
    }; return query;
  } };
}
test("previous locations are per account and deduplicate Place IDs across teams", async () => {
  const rows = [{ id: own, name: "Home", created_by_profile_id: own, provider_place_id: "placeOne" }, { id: foreign, name: "Other account", created_by_profile_id: foreign }, { id: "copy", name: "Home", created_by_profile_id: own, provider_place_id: "placeOne" }];
  const result = await readPreviousLocations(database(rows), own);
  assert.equal(result.length, 1); assert.equal(result[0].name, "Home"); assert.equal(result[0].group, "Previous Locations");
});
test("owned previous location can be reused personally without Google and without moving original", async () => {
  const rows = [{ id: own, name: "Home", created_by_profile_id: own, team_id: foreign, provider_place_id: "placeOne" }];
  const db = database(rows);
  const result = await reuseClubhouseLocation(db, own, { locationId: own });
  assert.equal(result.name, "Home"); assert.equal(rows[0].team_id, foreign);
  await reuseClubhouseLocation(db, own, { locationId: own });
  assert.equal(rows.length, 2);
});
test("guessed location from another account is denied", async () => {
  const db = database([{ id: foreign, name: "Private", created_by_profile_id: foreign }]);
  await assert.rejects(reuseClubhouseLocation(db, own, { locationId: foreign }), { status: 403 });
});
test("picker omits redundant inputs and Home keeps empty states", () => {
  const picker = readFileSync("app/components/ClubhouseLocationPicker.tsx", "utf8");
  assert.doesNotMatch(picker, /City \(optional\)|State \(optional\)|Enter venue name|>Cancel</);
  assert.match(picker, /Previous Locations/);
  const home = readFileSync("app/page.tsx", "utf8");
  assert.match(home, /Nothing on your schedule/); assert.match(home, /No recent game scores/);
});
