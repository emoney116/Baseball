import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { playerServiceFixture, uuid } from "./helpers/playerServiceFixture.mjs";
import {
  loadPlayerLiveSessions,
  writePlayerLiveEntry,
} from "../app/lib/playerLiveEntry.ts";
import {
  LIVE_DOMAINS,
  LIVE_FIELDS,
  LIVE_RESULTS,
  normalizeLivePayload,
  liveCapability,
} from "../app/lib/playerLiveModels.ts";
import { resolvePlayerCapabilities } from "../app/lib/playerCapabilities.ts";
import { changedRows, liveSyncDelta } from "../app/lib/liveSyncDelta.ts";
function fixture() {
  const f = playerServiceFixture();
  f.tables.teams[0].player_access_default = "TRACK_AND_VIEW";
  Object.assign(f.tables.practices[0], {
    status: "active",
    starts_at: "2026-01-01T10:00:00Z",
    ended_at: null,
  });
  Object.assign(f.tables.practice_sessions[0], {
    status: "ACTIVE",
    ended_at: null,
    entry_policy: "COACH_AND_ASSIGNED_PLAYERS",
    created_by_profile_id: uuid(2),
    metadata: {
      playerEntryFields: ["pitch_type", "exit_velocity_mph", "PRIVATE"],
      privateStaffComment: "PRIVATE",
    },
  });
  f.tables.practice_attendance = [
    { practice_id: uuid(60), player_id: f.own, status: "Present" },
  ];
  f.db.rpc = async (name, args) => {
    f.calls.push({ name, args });
    return { data: uuid(99), error: null };
  };
  return f;
}
const input = {
  membershipId: uuid(50),
  domain: "hitting",
  sessionId: uuid(61),
  operation: "create",
  requestId: uuid(100),
  payload: { action: "Miss" },
};
for (const mode of ["VIEW_ONLY", "TRACK_AND_VIEW", "FULL_PLAYER"])
  for (const domain of LIVE_DOMAINS)
    test(`${mode} resolves ${domain} live capability without staff elevation`, () => {
      const c = resolvePlayerCapabilities({
        approved: true,
        teamDefault: mode,
      }).capabilities;
      assert.equal(c[liveCapability(domain)], mode !== "VIEW_ONLY");
      for (const key of [
        "canScoreGames",
        "canEditCoachPractice",
        "canEditCoachWeightRoom",
        "canManageTeamSettings",
        "canApproveClaims",
      ])
        assert.equal(c[key], false);
    });
for (const domain of LIVE_DOMAINS)
  test(`${domain} rejects identity and programming fields in payload`, () => {
    for (const k of [
      "player_id",
      "created_by",
      "session_id",
      "teamId",
      "accessMode",
      "target_reps",
      "game_id",
    ])
      assert.throws(
        () => normalizeLivePayload(domain, { [k]: uuid(9) }),
        /Unsupported/,
      );
  });
test("every configured option is accepted by the normalizer", () => {
  for (const domain of LIVE_DOMAINS)
    for (const f of LIVE_FIELDS[domain])
      for (const value of f.options ?? []) {
        const resultKey =
          domain === "hitting"
            ? "action"
            : domain === "workout"
              ? "status"
              : "outcome";
        assert.equal(
          normalizeLivePayload(domain, {
            [resultKey]: LIVE_RESULTS[domain][0],
            [f.key]: value,
            ...(domain === "workout"
              ? { stationId: uuid(92), setNumber: 1 }
              : {}),
          })[f.key],
          value,
        );
      }
});
for (const value of [-1, 131, Infinity, NaN, "90"])
  test(`invalid exit velocity ${value} is rejected`, () =>
    assert.throws(() =>
      normalizeLivePayload("hitting", {
        action: "Ball in play",
        exit_velocity_mph: value,
      }),
    ));
test("locations and counts are bounded and extra properties cannot inject identity", () => {
  assert.deepEqual(
    normalizeLivePayload("pitching", {
      outcome: "Ball",
      location: { x: 0.4, y: 0.3, playerId: uuid(4) },
      count_before: { balls: 3, strikes: 2 },
    }).location,
    { x: 0.4, y: 0.3 },
  );
  assert.throws(() =>
    normalizeLivePayload("pitching", {
      outcome: "Ball",
      count_before: { balls: 4, strikes: 2 },
    }),
  );
  assert.throws(() =>
    normalizeLivePayload("hitting", {
      action: "Miss",
      field_location: { x: Infinity, y: 0.2 },
    }),
  );
});
test("live projection contains only assigned sessions and configured safe fields", async () => {
  const f = fixture(),
    s = await loadPlayerLiveSessions(f.db, uuid(1), uuid(50));
  assert.equal(s.sessions.length, 1);
  assert.deepEqual(s.sessions[0].fields, ["pitch_type", "exit_velocity_mph"]);
  assert.doesNotMatch(JSON.stringify(s), /PRIVATE/);
});
for (const change of ["ended", "absent", "unassigned", "Live BP", "coach-only"])
  test(`live projection excludes ${change} station`, async () => {
    const f = fixture();
    if (change === "ended")
      f.tables.practices[0].ended_at = "2026-09-06T00:00:00Z";
    if (change === "absent") f.tables.practice_attendance[0].status = "Absent";
    if (change === "unassigned")
      f.tables.practice_sessions[0].player_id = f.other;
    if (change === "Live BP")
      f.tables.practice_sessions[0].session_type = "Live BP";
    if (change === "coach-only")
      f.tables.practice_sessions[0].entry_policy = "COACH_ONLY";
    assert.equal(
      (await loadPlayerLiveSessions(f.db, uuid(1), uuid(50))).sessions.length,
      0,
    );
  });
test("revocation during live projection fails closed", async () => {
  const f = fixture();
  f.hooks.beforeRead = (t) => {
    if (t === "practice_sessions")
      f.tables.profile_player_links[0].status = "REVOKED";
  };
  await assert.rejects(
    loadPlayerLiveSessions(f.db, uuid(1), uuid(50)),
    (e) => e.status === 403,
  );
});
test("server pins actor and context instead of accepting forged player/team/mode", async () => {
  const f = fixture();
  await writePlayerLiveEntry(f.db, uuid(1), {
    ...input,
    actor: uuid(2),
    playerId: f.other,
    teamId: uuid(999),
    mode: "FULL_PLAYER",
  });
  const call = f.calls.find((c) => c.name === "write_player_live_entry");
  assert.equal(call.args.actor, uuid(1));
  assert.equal(call.args.target_membership, uuid(50));
  assert.equal(call.args.target_session, uuid(61));
  assert.equal(call.args.payload.playerId, undefined);
});
for (const attack of [
  "view-only",
  "revoked",
  "membership",
  "forged-field",
  "malformed-request",
  "game",
])
  test(`server denies ${attack} before privileged write`, async () => {
    const f = fixture(),
      body = { ...input };
    if (attack === "view-only")
      f.tables.teams[0].player_access_default = "VIEW_ONLY";
    if (attack === "revoked")
      f.tables.profile_player_links[0].status = "REVOKED";
    if (attack === "membership") body.membershipId = uuid(999);
    if (attack === "forged-field")
      body.payload = { action: "Miss", player_id: f.other };
    if (attack === "malformed-request") body.requestId = "not-a-uuid";
    if (attack === "game") body.domain = "game";
    await assert.rejects(writePlayerLiveEntry(f.db, uuid(1), body));
    assert.ok(!f.calls.some((c) => c.name === "write_player_live_entry"));
  });
test("ended-session database response becomes a graceful conflict", async () => {
  const f = fixture();
  f.db.rpc = async () => ({ error: { code: "55000" }, data: null });
  await assert.rejects(
    writePlayerLiveEntry(f.db, uuid(1), input),
    (e) => e.status === 409 && /Session ended/.test(e.message),
  );
});
test("delta preserves unseen concurrent entries and only writes changed rows", () => {
  const before = {
      hittingEvents: [
        { id: "a", action: "Miss" },
        { id: "b", action: "Foul" },
      ],
    },
    after = {
      ...before,
      hittingEvents: [...before.hittingEvents, { id: "c", action: "Miss" }],
    };
  const d = liveSyncDelta(before, after);
  assert.deepEqual(d.hittingEvents, [{ id: "c", action: "Miss" }]);
  assert.equal(after.hittingEvents.length, 3);
  assert.deepEqual(
    changedRows([{ id: "a", weight: 185 }], [{ id: "a", weight: 190 }]),
    [{ id: "a", weight: 190 }],
  );
});
test("ordered delta keeps the complete changed workout and leaves other workouts untouched", () => {
  const a = { id: "a", workoutId: "w", displayOrder: 0 },
    b = { id: "b", workoutId: "w", displayOrder: 1 },
    c = { id: "c", workoutId: "other", displayOrder: 0 };
  const before = { weightRoomWorkoutStations: [a, b, c] },
    after = {
      weightRoomWorkoutStations: [
        { ...a, displayOrder: 1 },
        { ...b, displayOrder: 0 },
        c,
      ],
    };
  assert.deepEqual(
    liveSyncDelta(before, after).weightRoomWorkoutStations,
    after.weightRoomWorkoutStations.slice(0, 2),
  );
});
test("protected APIs authenticate before creating admin client and preview is development-only", () => {
  for (const path of [
    "app/api/player/live-entry/route.ts",
    "app/api/player/live-entry/settings/route.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /auth.getUser\(\)/);
    assert.match(source, /401/);
    assert.match(source, /no-store/);
    assert.ok(
      source.indexOf("auth.getUser()") < source.search(/db\s*[:=]\s*createAdminClient\(\)/),
    );
  }
  assert.match(
    readFileSync("app/player-live-preview/page.tsx", "utf8"),
    /NODE_ENV\s*!==\s*"development"\)\s*notFound/,
  );
});
