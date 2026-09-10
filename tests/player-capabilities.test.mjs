import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAYER_ACCESS_MODES,
  PLAYER_CAPABILITY_GROUPS,
  PLAYER_CAPABILITY_LABELS,
  playerModeCapabilityDetails,
  resolvePlayerCapabilities,
  ownsPlayerEntry,
} from "../app/lib/playerCapabilities.ts";
import {
  loadPlayerSession,
  loadPlayerAccountHome,
  listPlayerContexts,
  hasStaffAccess,
} from "../app/lib/playerAccess.ts";
import { writePlayerSelfEntry } from "../app/lib/playerSelfTracking.ts";
import { playerServiceFixture, uuid } from "./helpers/playerServiceFixture.mjs";
import { executeAnalyticsQuery } from "../app/lib/analyticsQuery.ts";
import { playerAskContext } from "../app/lib/playerAskScope.ts";

for (const mode of PLAYER_ACCESS_MODES) {
  test(`${mode}: mode help lists every granted capability and no unavailable grants`, () => {
    const capabilities = resolvePlayerCapabilities({ approved: true, teamDefault: mode }).capabilities;
    const details = playerModeCapabilityDetails(mode);
    assert.deepEqual(details.map(({ key }) => key).sort(), Object.keys(capabilities).filter((key) => capabilities[key]).sort());
    assert.ok(details.every(({ label }) => label.length > 10 && !label.startsWith("can")));
    assert.equal(new Set(details.map(({ key }) => key)).size, details.length);
  });
  test(`${mode}: hard denies and unsupported tracking cannot be granted`, () => {
    const c = resolvePlayerCapabilities({
      approved: true,
      teamDefault: mode,
    }).capabilities;
    for (const k of [
      ...PLAYER_CAPABILITY_GROUPS.denied,
      ...PLAYER_CAPABILITY_GROUPS.unavailable,
    ])
      assert.equal(c[k], false, k);
    for (const k of PLAYER_CAPABILITY_GROUPS.view) assert.equal(c[k], true, k);
  });
  test(`${mode}: revoked association overrides every capability`, () => {
    assert.ok(
      Object.values(
        resolvePlayerCapabilities({
          approved: false,
          teamDefault: mode,
          override: "FULL_PLAYER",
        }).capabilities,
      ).every((v) => !v),
    );
  });
  test(`${mode}: canonical own Analytics and Ask never receive private team rows`, async () => {
    const f = playerServiceFixture();
    f.tables.teams[0].player_access_default = mode;
    const s = await loadPlayerSession(f.db, uuid(1));
    assert.deepEqual(
      s.data.players.map((p) => p.id),
      [f.own],
    );
    assert.ok(s.data.hittingEvents.every((e) => e.hitterId === f.own));
    assert.throws(
      () => playerAskContext(s.context, { viewerPlayerId: f.other }),
      /limited/,
    );
    assert.equal(s.access.capabilities.canUseAskClubhouse, true);
    const q = executeAnalyticsQuery(s.data, {
      domain: "hitting",
      source: "practice",
      metrics: ["contact_rate"],
      mode: "box-score",
      groupBy: "player",
      timeRange: "all",
      playerIds: [f.own],
    });
    assert.ok(q.rows.length > 0);
    assert.equal(Boolean(s.teamRoster), mode === "FULL_PLAYER");
    if (s.teamRoster)
      assert.ok(
        s.teamRoster.every((p) =>
          Object.keys(p).every((k) =>
            ["playerId", "name", "jersey", "position"].includes(k),
          ),
        ),
      );
  });
}
test("mode help labels cover exactly the supported capability inventory", () => {
  assert.deepEqual(Object.keys(PLAYER_CAPABILITY_LABELS).sort(), [
    ...PLAYER_CAPABILITY_GROUPS.view,
    ...PLAYER_CAPABILITY_GROUPS.track,
    ...PLAYER_CAPABILITY_GROUPS.full,
  ].sort());
});
test("default is View Only and invalid modes cannot create grants", () => {
  assert.equal(resolvePlayerCapabilities({ approved: true }).mode, "VIEW_ONLY");
  assert.equal(
    resolvePlayerCapabilities({
      approved: true,
      teamDefault: "ADMIN",
      override: "COACH",
    }).capabilities.canLogBodyWeight,
    false,
  );
});
test("override wins; clearing override restores the team default without link recreation", () => {
  assert.equal(
    resolvePlayerCapabilities({
      approved: true,
      teamDefault: "FULL_PLAYER",
      override: "VIEW_ONLY",
    }).capabilities.canLogBodyWeight,
    false,
  );
  assert.equal(
    resolvePlayerCapabilities({
      approved: true,
      teamDefault: "TRACK_AND_VIEW",
      override: null,
      trackingPolicy: "PERSONAL_AND_LIVE",
    }).capabilities.canLogBodyWeight,
    true,
  );
});
test("organization and future subscription restrictions intersect, never elevate coach permission", () => {
  const c = resolvePlayerCapabilities({
    approved: true,
    teamDefault: "FULL_PLAYER",
    organizationDenied: ["canViewRoster"],
    entitlementDenied: ["canLogBodyWeight"],
  }).capabilities;
  assert.equal(c.canViewRoster, false);
  assert.equal(c.canLogBodyWeight, false);
  assert.equal(c.canCreateGoals, true);
});
test("ownership requires creator AND explicit self provenance; legacy own-player rows are not self-owned", () => {
  assert.equal(
    ownsPlayerEntry(
      { createdByProfileId: uuid(1), entrySource: "PLAYER_SELF" },
      uuid(1),
    ),
    true,
  );
  for (const r of [
    {},
    { createdByProfileId: uuid(1) },
    { entrySource: "PLAYER_SELF" },
    { createdByProfileId: uuid(2), entrySource: "PLAYER_SELF" },
  ])
    assert.equal(ownsPlayerEntry(r, uuid(1)), false);
});
test("same player in two teams resolves different access on every selection", async () => {
  const f = playerServiceFixture();
  f.tables.teams[0].player_access_default = "TRACK_AND_VIEW";
  f.tables.teams[0].player_tracking_policy = "PERSONAL_AND_LIVE";
  f.tables.teams.push({
    ...f.tables.teams[0],
    id: uuid(21),
    player_access_default: "VIEW_ONLY",
  });
  f.tables.seasons.push({
    id: uuid(31),
    team_id: uuid(21),
    name: "Fall",
    active: true,
  });
  f.tables.player_team_memberships.push({
    ...f.tables.player_team_memberships[0],
    id: uuid(52),
    team_id: uuid(21),
    season_id: uuid(31),
  });
  assert.equal(
    (await loadPlayerSession(f.db, uuid(1), { teamId: f.team })).access
      .capabilities.canLogBodyWeight,
    true,
  );
  assert.equal(
    (await loadPlayerSession(f.db, uuid(1), { teamId: uuid(21) })).access
      .capabilities.canLogBodyWeight,
    false,
  );
});
test("downgrade during roster loading fails closed before sending broader payload", async () => {
  const f = playerServiceFixture();
  f.tables.teams[0].player_access_default = "FULL_PLAYER";
  let reads = 0;
  f.hooks.beforeRead = (t) => {
    if (t === "teams" && ++reads === 4)
      f.tables.teams[0].player_access_default = "VIEW_ONLY";
  };
  await assert.rejects(loadPlayerSession(f.db, uuid(1)), /permissions changed/);
});
test("shared account home has only approved membership summaries, no private player data", async () => {
  const f = playerServiceFixture();
  const contexts = await listPlayerContexts(f.db, uuid(1));
  const data = await loadPlayerAccountHome(f.db, uuid(1), contexts);
  assert.equal(data.teamContext.currentTeam, undefined);
  assert.equal(data.teamContext.availableTeams[0].playerContextId, f.own);
  assert.equal(data.players.length, 0);
  assert.equal(data.hittingEvents.length, 0);
  assert.equal(data.coachNotes.length, 0);
});
for (const role of ["COACH", "ADMIN"])
  test(`${role} retains staff access alongside player links`, async () => {
    const f = playerServiceFixture();
    f.tables.profile_team_memberships.push({
      profile_id: uuid(1),
      team_id: f.team,
      active: true,
      role,
    });
    assert.equal(await hasStaffAccess(f.db, uuid(1)), true);
  });
test("Super User entitlement remains separate from player modes", async () => {
  const f = playerServiceFixture();
  f.tables.account_entitlements.push({
    profile_id: uuid(1),
    entitlement_key: "SUPER_USER",
    enabled: true,
    expires_at: null,
  });
  assert.equal(await hasStaffAccess(f.db, uuid(1)), true);
  assert.equal(
    resolvePlayerCapabilities({ approved: true, teamDefault: "FULL_PLAYER" })
      .capabilities.canManageTeamSettings,
    false,
  );
});
for (const attack of [
  {
    kind: "body_weight",
    operation: "create",
    membershipId: uuid(50),
    bodyWeight: 180,
    date: "2026-09-05",
    mode: "FULL_PLAYER",
  },
  {
    kind: "goal",
    operation: "create",
    membershipId: uuid(50),
    title: "Forged UI",
    completed: false,
    capabilities: { canCreateGoals: true },
  },
  {
    kind: "hitting",
    operation: "update",
    membershipId: uuid(50),
    id: uuid(80),
  },
  { kind: "game", operation: "delete", membershipId: uuid(50), id: uuid(80) },
  {
    kind: "goal",
    operation: "create",
    membershipId: uuid(51),
    title: "Other player",
    completed: false,
  },
])
  test(`direct self API service rejects ${attack.kind}/${attack.operation} tampering`, async () => {
    const f = playerServiceFixture();
    f.db.rpc = () => {
      throw new Error("RPC must not run");
    };
    await assert.rejects(
      writePlayerSelfEntry(f.db, uuid(1), attack),
      /permit|Unsupported|approved/,
    );
  });
test("permitted server write ignores forged actor/player/source and pins verified context", async () => {
  const f = playerServiceFixture();
  f.tables.teams[0].player_access_default = "TRACK_AND_VIEW";
  let args;
  f.db.rpc = async (name, value) => {
    args = value;
    return { data: uuid(99), error: null };
  };
  await writePlayerSelfEntry(f.db, uuid(1), {
    kind: "goal",
    operation: "create",
    membershipId: uuid(50),
    title: "Personal goal",
    completed: false,
    actor: uuid(2),
    playerId: f.other,
    entrySource: "COACH",
  });
  assert.equal(args.actor, uuid(1));
  assert.equal(args.target_membership, uuid(50));
  assert.equal(args.entry_id, null);
  assert.equal(args.playerId, undefined);
});
