import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRosterImportPlan,
  buildRosterImportPlan,
  parseMaxPrepsPdfText,
  parseRosterCsv,
} from "../app/lib/rosterImport.ts";

const varsity = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  organizationName: "Metrolina Christian Academy",
  teamId: "00000000-0000-4000-8000-000000000101",
  teamName: "Metrolina Varsity",
  teamLevel: "Varsity",
  seasonId: "00000000-0000-4000-8000-000000000201",
  seasonName: "Fall 2026",
  role: "ADMIN",
  active: true,
};

const jv = {
  ...varsity,
  teamId: "00000000-0000-4000-8000-000000000102",
  teamName: "Metrolina JV",
  teamLevel: "JV",
  seasonId: "00000000-0000-4000-8000-000000000202",
};

function appData(overrides = {}) {
  return {
    teamContext: {
      profile: { id: "00000000-0000-4000-8000-000000000301", email: "coach@example.com" },
      currentTeam: varsity,
      availableTeams: [varsity, jv],
    },
    players: [],
    playerTeamMemberships: [],
    rosterImports: [],
    settings: {
      activePracticeId: undefined,
      theme: "dark",
      rosterSeason: "Fall 2026",
      recentPlayerIds: [],
      selectedTeamId: varsity.teamId,
      selectedSeasonId: varsity.seasonId,
    },
    ...overrides,
  };
}

test("parses MaxPreps CSV headers and converts grade level to graduation year", () => {
  const parsed = parseRosterCsv(
    [
      "iscaptain,jersey,firstname,lastname,position1,position2,classyear,heightfeet,heightinches,weight",
      "true,12,Jackson,Smith,SS,RHP,12,6,1,170",
    ].join("\n"),
    { sourceId: "csv-1", fileName: "Varsity.csv", seasonName: "Fall 2026" },
  );

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].graduationYear, 2027);
  assert.equal(parsed.rows[0].isCaptain, true);
  assert.equal(parsed.rows[0].jerseyNumber, 12);
  assert.equal(parsed.rows[0].height, "6'1\"");
});

test("parses MaxPreps PDF table cells and staff", () => {
  const text = [
    "Metrolina Christian Academy",
    "25-26",
    "Varsity",
    "Baseball",
    "Roster",
    "#",
    "Name",
    "Pos.",
    "Gr.",
    "Ht.",
    "Wt.",
    "1",
    "Jacob Seamon",
    "CF, SS",
    "Jr.",
    "6'5\"",
    "200",
    "Staff",
    "Position",
    "Eric Boston",
    "Assistant Coach",
  ].join("\n");
  const parsed = parseMaxPrepsPdfText(text, { sourceId: "pdf-1", fileName: "maxpreps.pdf" });

  assert.equal(parsed.detectedTeamName, "Metrolina Varsity");
  assert.equal(parsed.detectedSeasonName, "2025-26");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].graduationYear, 2027);
  assert.equal(parsed.staff.length, 1);
  assert.equal(parsed.staff[0].name, "Eric Boston");
});

test("uses one player identity with separate team-specific jersey memberships across files", () => {
  const varsityFile = parseRosterCsv(
    "First Name,Last Name,Jersey Number,Graduation Year,Primary Position\nJackson,Smith,12,2027,SS",
    { sourceId: "varsity-file", fileName: "Varsity.csv", seasonName: "Fall 2026" },
  );
  const jvFile = parseRosterCsv(
    "First Name,Last Name,Jersey Number,Graduation Year,Primary Position\nJackson,Smith,7,2027,SS",
    { sourceId: "jv-file", fileName: "JV.csv", seasonName: "Fall 2026" },
  );
  const data = appData();
  const plan = buildRosterImportPlan(data, [
    { source: varsityFile, teamId: varsity.teamId, teamName: varsity.teamName, seasonId: varsity.seasonId, seasonName: varsity.seasonName, mode: "add", defaultRosterStatus: "Varsity" },
    { source: jvFile, teamId: jv.teamId, teamName: jv.teamName, seasonId: jv.seasonId, seasonName: jv.seasonName, mode: "add", defaultRosterStatus: "JV" },
  ]);
  const result = applyRosterImportPlan(data, plan).data;

  assert.equal(result.players.length, 1);
  assert.equal(result.playerTeamMemberships.length, 2);
  assert.deepEqual(
    result.playerTeamMemberships
      .map((membership) => [membership.teamId, membership.jerseyNumber, membership.rosterStatus])
      .sort(),
    [
      [jv.teamId, 7, "JV"],
      [varsity.teamId, 12, "Varsity"],
    ].sort(),
  );
});

test("replace mode archives missing team memberships without deleting player identities", () => {
  const existingPlayer = {
    id: "00000000-0000-4000-8000-000000000401",
    name: "Existing Player",
    jerseyNumber: 3,
    primaryPosition: "SS",
    bats: "R",
    throws: "R",
    graduationYear: 2027,
    rosterStatus: "Varsity",
    programLevel: "Varsity",
    avatarColor: "#8b1e3f",
    isPitcher: false,
    isHitter: true,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
  const data = appData({
    players: [existingPlayer],
    playerTeamMemberships: [{
      id: "00000000-0000-4000-8000-000000000501",
      playerId: existingPlayer.id,
      teamId: varsity.teamId,
      seasonId: varsity.seasonId,
      rosterStatus: "Varsity",
      jerseyNumber: 3,
      active: true,
    }],
  });
  const uploaded = parseRosterCsv(
    "First Name,Last Name,Jersey Number,Graduation Year,Primary Position\nNew,Player,9,2027,CF",
    { sourceId: "replace-file", fileName: "Varsity.csv", seasonName: "Fall 2026" },
  );
  const plan = buildRosterImportPlan(data, [
    { source: uploaded, teamId: varsity.teamId, teamName: varsity.teamName, seasonId: varsity.seasonId, seasonName: varsity.seasonName, mode: "replace", defaultRosterStatus: "Varsity" },
  ]);
  const result = applyRosterImportPlan(data, plan).data;

  assert.equal(result.players.some((player) => player.id === existingPlayer.id), true);
  const archivedMembership = result.playerTeamMemberships.find((membership) => membership.playerId === existingPlayer.id);
  assert.equal(archivedMembership?.active, false);
});

test("update-only mode skips new players and ambiguous duplicates require review", () => {
  const uploaded = parseRosterCsv(
    "First Name,Last Name,Jersey Number,Graduation Year,Primary Position\nJackson,Smith,12,2027,SS",
    { sourceId: "update-file", fileName: "Varsity.csv", seasonName: "Fall 2026" },
  );
  const updatePlan = buildRosterImportPlan(appData(), [
    { source: uploaded, teamId: varsity.teamId, teamName: varsity.teamName, seasonId: varsity.seasonId, seasonName: varsity.seasonName, mode: "update", defaultRosterStatus: "Varsity" },
  ]);

  assert.equal(updatePlan.files[0].rows[0].decision, "skip");
  assert.equal(updatePlan.files[0].rows[0].status, "review");

  const duplicateData = appData({
    players: [
      { id: "00000000-0000-4000-8000-000000000601", name: "Jackson Smith", jerseyNumber: 12, primaryPosition: "SS", bats: "R", throws: "R", graduationYear: 2027, rosterStatus: "Varsity", avatarColor: "#8b1e3f", isPitcher: true, isHitter: true, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" },
      { id: "00000000-0000-4000-8000-000000000602", name: "Jackson Smith", jerseyNumber: 4, primaryPosition: "P", bats: "R", throws: "R", graduationYear: 2027, rosterStatus: "JV", avatarColor: "#2f6f89", isPitcher: true, isHitter: true, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" },
    ],
  });
  const duplicatePlan = buildRosterImportPlan(duplicateData, [
    { source: uploaded, teamId: varsity.teamId, teamName: varsity.teamName, seasonId: varsity.seasonId, seasonName: varsity.seasonName, mode: "add", defaultRosterStatus: "Varsity" },
  ]);

  assert.equal(duplicatePlan.files[0].rows[0].decision, "skip");
  assert.equal(duplicatePlan.files[0].rows[0].status, "possible-match");
});
