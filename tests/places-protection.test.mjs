import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { searchPlaces } from "../app/lib/placesSearchService.ts";
import { placesDigest, placesIpBucket, placesTelemetry } from "../app/lib/placesProtection.ts";
import { createPlacesPickerSearch } from "../app/lib/placesPickerSearch.ts";

const user = "00000000-0000-4000-8000-000000000001";
const hash = "a".repeat(64);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function dependencies(overrides = {}) {
  const calls = [];
  return { calls, userId: user, authorize: async () => {}, saved: async () => [],
    reserve: async () => { calls.push("reserve"); return { allowed: true, retryAfter: 0 }; },
    predictions: async () => {}, event: (op, event) => calls.push(event),
    provider: { autocomplete: async () => { calls.push("google"); return []; }, getPlace: async () => { calls.push("details"); return {}; } }, ...overrides };
}
const input = () => ({ operation: "autocomplete", query: "School", sessionToken: randomUUID() });

test("unauthenticated requests never authorize, reserve or call Google", async () => {
  const deps = dependencies({ userId: null, authorize: () => assert.fail("authorization should not run") });
  await assert.rejects(searchPlaces(input(), deps), { status: 401 });
  assert.deepEqual(deps.calls, ["unauthenticated"]);
});
test("cross-team denial precedes provider reservation", async () => {
  const deps = dependencies({ authorize: async () => { throw Object.assign(new Error(), { status: 403 }); } });
  await assert.rejects(searchPlaces(input(), deps), { status: 403 });
  assert.deepEqual(deps.calls, []);
});
test("blocked or unavailable reservation never calls Google", async () => {
  const deps = dependencies({ reserve: async () => ({ allowed: false, retryAfter: 60 }) });
  await assert.rejects(searchPlaces(input(), deps), { status: 429, retryAfter: 60 });
  assert.deepEqual(deps.calls, ["rate_limited"]);
  const broken = dependencies({ reserve: async () => { throw new Error("database down"); } });
  await assert.rejects(searchPlaces(input(), broken));
  assert.deepEqual(broken.calls, []);
});
test("saved results, saved Details and short queries work with an exhausted provider", async () => {
  const deps = dependencies({ saved: async () => [{ id: "local", name: "School", providerPlaceId: "savedPlace", createdByProfileId: user }],
    reserve: async () => assert.fail("local must bypass limiter") });
  assert.equal((await searchPlaces(input(), deps)).saved.length, 1);
  assert.equal((await searchPlaces({ operation: "details", placeId: "savedPlace" }, deps)).saved[0].id, "local");
  assert.deepEqual((await searchPlaces({ ...input(), query: "ab" }, deps)).suggestions, []);
  assert.deepEqual(deps.calls, []);
});
test("provider quota failure emits safe telemetry, never provider data", async () => {
  const deps = dependencies({ provider: { autocomplete: async () => { throw new Error("private Google response"); } } });
  await assert.rejects(searchPlaces(input(), deps), error => error.status === 503 && !error.message.includes("private"));
  assert.deepEqual(deps.calls, ["reserve", "attempt", "provider_error"]);
  assert.deepEqual(Object.keys(placesTelemetry("preview", "autocomplete", "attempt")), ["system", "environment", "operation", "event", "estimatedUsd"]);
});
test("IP protection ignores local spoofed headers and groups IPv6 /64", () => {
  assert.equal(placesIpBucket(new Headers({ "x-forwarded-for": "1.2.3.4" }), false), "local-shared");
  assert.equal(placesIpBucket(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }), true), "unknown-shared");
  assert.equal(placesIpBucket(new Headers({ "x-forwarded-for": "2001:db8::1" }), true), placesIpBucket(new Headers({ "x-forwarded-for": "2001:db8::ffff" }), true));
  assert.match(placesDigest("test-secret", "ip", "1.2.3.4"), /^[a-f0-9]{64}$/);
});

test("database budgets are atomic, service-only, rolling and bounded", async t => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role;");
    await db.exec(readFileSync(new URL("../supabase/migrations/20260909183000_places_cost_protection.sql", import.meta.url), "utf8"));
    const reserve = async (options = {}) => {
      const { rows } = await db.query("select reserve_places_request($1,$2,$3,$4,$5,$6,$7) result", [
        options.user ?? user, options.ip ?? hash, options.query ?? randomUUID().replaceAll("-", "").repeat(2),
        options.env ?? "production", options.op ?? "autocomplete", options.token ?? randomUUID(), options.place ?? null,
      ]);
      return rows[0].result;
    };
    const reset = () => db.exec("truncate places_request_reservations, places_search_sessions");
    const seed = (count, options = {}) => db.query(`insert into places_request_reservations(profile_id,ip_hash,environment,operation,created_at)
      select $1,$2,'production',$3,clock_timestamp()-interval '2 hours' from generate_series(1,$4)`, [options.user ?? user, options.ip ?? hash, options.op ?? "autocomplete", count]);
    await t.test("rapid bot-like requests stop at eight per user", async () => {
      const results = await Promise.all(Array.from({ length: 25 }, () => reserve()));
      assert.equal(results.filter(r => r.allowed).length, 8);
      assert.equal((await db.query("select count(*)::integer n from places_request_reservations")).rows[0].n, 8);
    });
    await t.test("one IP cannot evade burst cap with new accounts", async () => {
      await reset();
      for (let i = 0; i < 20; i++) assert.equal((await reserve({ user: randomUUID() })).allowed, true);
      assert.equal((await reserve({ user: randomUUID() })).allowed, false);
    });
    await t.test("duplicate normalized query rejected even with a fresh token", async () => {
      await reset();
      assert.equal((await reserve({ query: hash })).allowed, true);
      assert.equal((await reserve({ query: hash })).allowed, false);
    });
    await t.test("user daily ceiling and rolling reset", async () => {
      await reset(); await seed(150);
      assert.equal((await reserve()).allowed, false);
      await db.exec("update places_request_reservations set created_at=clock_timestamp()-interval '25 hours'");
      assert.equal((await reserve()).allowed, true);
    });
    await t.test("IP daily ceiling across users", async () => {
      await reset(); await seed(400, { user: randomUUID() });
      assert.equal((await reserve()).allowed, false);
    });
    await t.test("environment ceiling across users and IPs", async () => {
      await reset(); await seed(1000, { user: randomUUID(), ip: "b".repeat(64) });
      assert.equal((await reserve()).allowed, false);
    });
    await t.test("Details only after an actual prediction, only once", async () => {
      await reset(); const token = randomUUID();
      assert.equal((await reserve({ token, op: "details", place: "placeOne" })).allowed, false);
      assert.equal((await reserve({ token })).allowed, true);
      await db.query("select record_places_predictions($1,$2,$3)", [token, user, ["placeOne"]]);
      assert.equal((await reserve({ token, op: "details", place: "otherPlace" })).allowed, false);
      assert.equal((await reserve({ token, op: "details", place: "placeOne", user: randomUUID() })).allowed, false);
      assert.equal((await reserve({ token, op: "details", place: "placeOne" })).allowed, true);
      assert.equal((await reserve({ token, op: "details", place: "placeOne" })).allowed, false);
    });
    await t.test("expired sessions rejected", async () => {
      await reset(); const token = randomUUID(); await reserve({ token });
      await db.exec("update places_search_sessions set created_at=clock_timestamp()-interval '21 minutes'");
      assert.equal((await reserve({ token })).allowed, false);
    });
    await t.test("authenticated clients cannot bypass service budgets through RPC", async () => {
      await db.exec("set role authenticated");
      await assert.rejects(reserve(), /permission denied/);
      await assert.rejects(db.query("select * from places_request_reservations"), /permission denied/);
      await db.exec("reset role");
    });
  } finally { await db.close(); }
});

test("picker debounces, suppresses repeats, cancels stale and rotates after selection", async () => {
  const calls = []; const results = [];
  const picker = createPlacesPickerSearch({}, [], r => results.push(r), async (_url, options) => {
    calls.push({ body: JSON.parse(options.body), signal: options.signal });
    return Response.json({ suggestions: [] });
  });
  picker.search("M"); picker.search("MC"); picker.search("MCA"); picker.search("MCA school");
  await pause(340);
  assert.equal(calls.length, 1);
  picker.search("MCA school"); await pause(340); assert.equal(calls.length, 1);
  await picker.select({ providerPlaceId: "placeOne", title: "School", subtitle: "" });
  assert.equal(calls[1].body.operation, "details");
  assert.equal(calls[0].body.sessionToken, calls[1].body.sessionToken);
  picker.search("Charlotte"); await pause(340);
  assert.notEqual(calls[2].body.sessionToken, calls[1].body.sessionToken);
  picker.search("Cancel pending"); picker.close(); await pause(340);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].signal.aborted, true);
});

test("picker local matches and saved selection do not touch the network", async () => {
  const picker = createPlacesPickerSearch({}, [{ id: "saved", name: "School", providerPlaceId: "placeOne", createdByProfileId: user }], () => {}, async () => assert.fail("Google/network called"));
  picker.search("school"); await pause(340);
  await picker.select({ providerPlaceId: "placeOne", title: "School", subtitle: "" });
  picker.close();
});
