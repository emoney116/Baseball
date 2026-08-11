import type { AppData, ID, Player, PlayerTeamMembership, Position, RosterStatus, StaffBaseballRole, StaffMember, StaffTeamMembership, TeamOption } from "../types";

export type RosterImportFileType = "csv" | "pdf";
export type RosterImportMode = "add" | "replace" | "update";
export type RosterImportDecision = "use-existing" | "create-new" | "skip";
export type RosterImportRowStatus = "ready" | "review" | "possible-match" | "error";

export interface ParsedRosterStaff {
  name: string;
  role: string;
}

export interface ParsedRosterRow {
  id: ID;
  sourceId: ID;
  sourceName: string;
  sourceType: RosterImportFileType;
  rowNumber: number;
  firstName: string;
  lastName: string;
  jerseyNumber?: number;
  rawPositions: string[];
  primaryPosition: Position;
  secondaryPosition?: Position;
  bats: Player["bats"];
  throws: Player["throws"];
  rawGrade?: string;
  graduationYear?: number;
  rosterStatus?: RosterStatus;
  height?: string;
  weight?: number;
  isCaptain?: boolean;
  errors: string[];
  warnings: string[];
}

export interface ParsedRosterFile {
  id: ID;
  fileName: string;
  fileType: RosterImportFileType;
  rows: ParsedRosterRow[];
  staff: ParsedRosterStaff[];
  detectedSchoolName?: string;
  detectedTeamName?: string;
  detectedSeasonName?: string;
  parseWarnings: string[];
  parseStatus?: "parsing" | "ready" | "error";
  parseError?: string;
  parseStage?: string;
  fileSize?: number;
}

export interface RosterImportAssignment {
  source: ParsedRosterFile;
  teamId: ID;
  teamName: string;
  seasonId?: ID;
  seasonName?: string;
  mode: RosterImportMode;
  defaultRosterStatus: RosterStatus;
}

export interface RosterImportPlanRow extends ParsedRosterRow {
  teamId: ID;
  teamName: string;
  seasonId?: ID;
  seasonName?: string;
  mode: RosterImportMode;
  rosterStatus: RosterStatus;
  matchedPlayerId?: ID;
  matchedPlayerName?: string;
  duplicateSourcePlayerId?: ID;
  candidatePlayerIds: ID[];
  status: RosterImportRowStatus;
  decision: RosterImportDecision;
}

export interface RosterImportPlanFile {
  sourceId: ID;
  fileName: string;
  fileType: RosterImportFileType;
  teamId: ID;
  teamName: string;
  seasonId?: ID;
  seasonName?: string;
  mode: RosterImportMode;
  defaultRosterStatus: RosterStatus;
  staff: ParsedRosterStaff[];
  rows: RosterImportPlanRow[];
  existingActiveMemberships: number;
  addCount: number;
  updateCount: number;
  keepCount: number;
  removeCount: number;
  skipCount: number;
  errorCount: number;
}

export interface RosterImportPlan {
  id: ID;
  createdAt: string;
  files: RosterImportPlanFile[];
}

export interface RosterImportResult {
  data: AppData;
  playersCreated: number;
  playersUpdated: number;
  membershipsAdded: number;
  membershipsUpdated: number;
  membershipsRemoved: number;
  rowsSkipped: number;
}

const GENERIC_HEADER_ALIASES: Record<string, string[]> = {
  firstName: ["first name", "firstname", "first", "given name"],
  lastName: ["last name", "lastname", "last", "surname"],
  jerseyNumber: ["jersey number", "jersey", "number", "#", "player #", "team number"],
  graduationYear: ["graduation year", "grad year", "class", "classyear", "class year", "grad"],
  primaryPosition: ["primary position", "position", "pos", "position1", "primary pos"],
  secondaryPosition: ["secondary position", "position2", "secondary pos"],
  thirdPosition: ["position3"],
  bats: ["bats", "bat"],
  throws: ["throws", "throw"],
  teamName: ["team", "team name"],
  rosterStatus: ["roster status", "status", "level"],
  height: ["height", "ht"],
  heightFeet: ["heightfeet", "height feet", "feet"],
  heightInches: ["heightinches", "height inches", "inches"],
  weight: ["weight", "wt"],
  isCaptain: ["iscaptain", "captain", "is captain"],
  bio: ["bio"],
};

export function parseRosterCsv(text: string, options: { sourceId: ID; fileName: string; seasonName?: string; defaultRosterStatus?: RosterStatus }): ParsedRosterFile {
  const records = parseCsvRecords(text);
  if (records.length === 0) {
    return emptyParsedFile(options.sourceId, options.fileName, "csv", ["No CSV rows found."]);
  }
  const headers = records[0].map(normalizeHeader);
  const rows = records.slice(1).filter((record) => record.some((value) => value.trim()));
  const parseWarnings: string[] = [];
  const parsedRows = rows.map((record, index) => {
    const get = (field: keyof typeof GENERIC_HEADER_ALIASES) => readMappedCell(headers, record, field);
    const firstName = get("firstName").trim();
    const lastName = get("lastName").trim();
    const jerseyNumber = parseInteger(get("jerseyNumber"));
    const rawPositions = [get("primaryPosition"), get("secondaryPosition"), get("thirdPosition")]
      .flatMap(splitPositions)
      .filter(Boolean);
    const positions = normalizePositions(rawPositions);
    const classValue = get("graduationYear").trim();
    const interpretedGraduationYear = interpretGraduationYear(classValue, options.seasonName);
    const rosterStatus = normalizeRosterStatus(get("rosterStatus")) ?? options.defaultRosterStatus;
    const height = normalizeHeight(get("height")) ?? normalizeHeightFromParts(get("heightFeet"), get("heightInches"));
    const weight = parseInteger(get("weight"));
    const throws = normalizeThrows(get("throws")) ?? throwsFromPositions(rawPositions) ?? "R";
    const bats = normalizeBats(get("bats")) ?? "R";
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!firstName) errors.push("First name is required.");
    if (!lastName) errors.push("Last name is required.");
    if (!interpretedGraduationYear) errors.push("Graduation year or grade is required.");
    if (rawPositions.length === 0) warnings.push("No position found; defaulted to UTIL.");
    if (classValue && interpretedGraduationYear && String(interpretedGraduationYear) !== classValue) {
      warnings.push(`${classValue} interpreted as class of ${interpretedGraduationYear}.`);
    }
    return {
      id: makeImportId("row"),
      sourceId: options.sourceId,
      sourceName: options.fileName,
      sourceType: "csv" as const,
      rowNumber: index + 2,
      firstName,
      lastName,
      jerseyNumber,
      rawPositions,
      primaryPosition: positions[0],
      secondaryPosition: positions[1],
      bats,
      throws,
      rawGrade: classValue || undefined,
      graduationYear: interpretedGraduationYear,
      rosterStatus,
      height,
      weight,
      isCaptain: parseBoolean(get("isCaptain")),
      errors,
      warnings,
    };
  });
  return {
    id: options.sourceId,
    fileName: options.fileName,
    fileType: "csv",
    rows: parsedRows,
    staff: [],
    parseWarnings,
    parseStatus: parsedRows.length > 0 ? "ready" : "error",
    parseError: parsedRows.length > 0 ? undefined : "No roster rows were found in this CSV.",
  };
}

export function parseMaxPrepsPdfText(text: string, options: { sourceId: ID; fileName: string; fallbackSeasonName?: string }): ParsedRosterFile {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parseWarnings: string[] = [];
  const detectedSeasonName = detectSeasonName(lines) ?? options.fallbackSeasonName;
  const detectedSchoolName = detectSchoolName(lines);
  const detectedTeamName = detectTeamName(lines);
  let rows: ParsedRosterRow[] = [];
  const staff: ParsedRosterStaff[] = parseMaxPrepsStaffCells(lines);
  let inStaff = false;
  let rowNumber = 1;

  for (const line of lines) {
    if (/^staff\s+position$/i.test(line) || /^staff$/i.test(line)) {
      inStaff = true;
      continue;
    }
    if (/^https?:\/\//i.test(line) || /^powered by$/i.test(line) || /^address$/i.test(line) || /^#\s+name\s+pos/i.test(line)) continue;
    if (inStaff) {
      if (/^position$/i.test(line) || /^(Head Coach|Assistant Coach|Coach|Manager|Trainer)$/i.test(line)) continue;
      const staffMatch = line.match(/^(.+?)\s+(Head Coach|Assistant Coach|Coach|Manager|Trainer)$/i);
      if (staffMatch && !staff.some((item) => item.name === staffMatch[1].trim() && item.role === staffMatch[2].trim())) {
        staff.push({ name: staffMatch[1].trim(), role: staffMatch[2].trim() });
      }
      continue;
    }

    const parsed = parseMaxPrepsRosterLine(line, options.sourceId, options.fileName, detectedSeasonName, rowNumber);
    if (parsed) {
      rows.push(parsed);
      rowNumber += 1;
    }
  }

  if (rows.length === 0) {
    rows = parseMaxPrepsTableCells(lines, options.sourceId, options.fileName, detectedSeasonName);
  }

  if (rows.length === 0) {
    parseWarnings.push("No player rows were found in the PDF text layer. Review the file or use CSV export.");
  }

  return {
    id: options.sourceId,
    fileName: options.fileName,
    fileType: "pdf",
    rows,
    staff,
    detectedSchoolName,
    detectedTeamName,
    detectedSeasonName,
    parseWarnings,
    parseStatus: rows.length > 0 ? "ready" : "error",
    parseError: rows.length > 0 ? undefined : "No roster rows were detected in this PDF.",
  };
}

export function buildRosterImportPlan(data: AppData, assignments: RosterImportAssignment[]): RosterImportPlan {
  const importedIdentityToPlayerId = new Map<string, ID>();
  const files = assignments.map((assignment) => {
    const activeMemberships = (data.playerTeamMemberships ?? []).filter(
      (membership) =>
        membership.teamId === assignment.teamId &&
        membership.seasonId === assignment.seasonId &&
        membership.active,
    );
    const existingIds = new Set(activeMemberships.map((membership) => membership.playerId));
    const uploadedIds = new Set<ID>();
    const rows = assignment.source.rows.map((row) => {
      const identity = identityKey(row.firstName, row.lastName, row.graduationYear);
      const duplicateSourcePlayerId = importedIdentityToPlayerId.get(identity);
      const candidates = findPlayerCandidates(data.players, row);
      const highConfidence = candidates.filter((player) => player.confidence === "high");
      const possible = candidates.filter((player) => player.confidence === "possible");
      let matchedPlayerId = duplicateSourcePlayerId;
      let matchedPlayerName: string | undefined;
      let decision: RosterImportDecision = "create-new";
      let status: RosterImportRowStatus = row.errors.length ? "error" : "ready";
      const warnings = [...row.warnings];

      if (!matchedPlayerId && highConfidence.length === 1) {
        matchedPlayerId = highConfidence[0].player.id;
        matchedPlayerName = highConfidence[0].player.name;
        decision = "use-existing";
      } else if (!matchedPlayerId && highConfidence.length > 1) {
        status = "possible-match";
        decision = "skip";
        warnings.push("Multiple strong player matches. Choose one before importing.");
      } else if (!matchedPlayerId && possible.length > 0) {
        status = "possible-match";
        decision = "skip";
        warnings.push("Possible existing player match needs review.");
      }

      if (assignment.mode === "update" && !matchedPlayerId && !duplicateSourcePlayerId) {
        status = "review";
        decision = "skip";
        warnings.push("Update-only mode will not create a new player.");
      }

      const playerId = matchedPlayerId ?? row.id;
      if (!row.errors.length && decision !== "skip") {
        importedIdentityToPlayerId.set(identity, playerId);
        uploadedIds.add(playerId);
      }

      return {
        ...row,
        warnings,
        teamId: assignment.teamId,
        teamName: assignment.teamName,
        seasonId: assignment.seasonId,
        seasonName: assignment.seasonName,
        mode: assignment.mode,
        rosterStatus: row.rosterStatus ?? assignment.defaultRosterStatus,
        matchedPlayerId,
        matchedPlayerName: matchedPlayerName ?? data.players.find((player) => player.id === matchedPlayerId)?.name,
        duplicateSourcePlayerId,
        candidatePlayerIds: candidates.map((candidate) => candidate.player.id),
        status,
        decision,
      };
    });

    const acceptedRows = rows.filter((row) => row.status !== "error" && row.decision !== "skip");
    const acceptedPlayerIds = new Set(acceptedRows.map((row) => row.matchedPlayerId ?? row.duplicateSourcePlayerId ?? row.id));
    const removeCount = assignment.mode === "replace"
      ? activeMemberships.filter((membership) => !acceptedPlayerIds.has(membership.playerId)).length
      : 0;
    const addCount = acceptedRows.filter((row) => !existingIds.has(row.matchedPlayerId ?? row.duplicateSourcePlayerId ?? row.id)).length;
    const updateCount = acceptedRows.length - addCount;
    return {
      sourceId: assignment.source.id,
      fileName: assignment.source.fileName,
      fileType: assignment.source.fileType,
      teamId: assignment.teamId,
      teamName: assignment.teamName,
      seasonId: assignment.seasonId,
      seasonName: assignment.seasonName,
      mode: assignment.mode,
      defaultRosterStatus: assignment.defaultRosterStatus,
      staff: assignment.source.staff,
      rows,
      existingActiveMemberships: activeMemberships.length,
      addCount,
      updateCount,
      keepCount: Math.max(0, activeMemberships.length - updateCount - removeCount),
      removeCount,
      skipCount: rows.filter((row) => row.decision === "skip").length,
      errorCount: rows.filter((row) => row.status === "error").length,
    };
  });
  return { id: makeImportId("import"), createdAt: new Date().toISOString(), files };
}

export function applyRosterImportPlan(data: AppData, plan: RosterImportPlan): RosterImportResult {
  const now = new Date().toISOString();
  const nextPlayers = [...data.players];
  const nextMemberships = [...(data.playerTeamMemberships ?? [])];
  const nextStaffMembers = [...(data.staffMembers ?? [])];
  const nextStaffMemberships = [...(data.staffTeamMemberships ?? [])];
  const playersById = new Map(nextPlayers.map((player) => [player.id, player]));
  const playerIdByIdentity = new Map<string, ID>();
  const staffByIdentity = new Map(nextStaffMembers.map((member) => [staffIdentityKey(member.displayName, member.email), member.id]));
  let playersCreated = 0;
  let playersUpdated = 0;
  let membershipsAdded = 0;
  let membershipsUpdated = 0;
  let membershipsRemoved = 0;
  let rowsSkipped = 0;

  for (const file of plan.files) {
    const acceptedPlayerIds = new Set<ID>();
    for (const row of file.rows) {
      if (row.status === "error" || row.decision === "skip") {
        rowsSkipped += 1;
        continue;
      }
      const identity = identityKey(row.firstName, row.lastName, row.graduationYear);
      const playerId = row.decision === "use-existing"
        ? row.matchedPlayerId ?? row.duplicateSourcePlayerId ?? playerIdByIdentity.get(identity) ?? row.id
        : row.duplicateSourcePlayerId ?? playerIdByIdentity.get(identity) ?? row.id;
      const existing = playersById.get(playerId);
      const nextPlayer = mergeImportedPlayer(existing, row, playerId, now);
      const playerIndex = nextPlayers.findIndex((player) => player.id === playerId);
      if (playerIndex >= 0) {
        nextPlayers[playerIndex] = nextPlayer;
        playersUpdated += 1;
      } else {
        nextPlayers.unshift(nextPlayer);
        playersCreated += 1;
      }
      playersById.set(playerId, nextPlayer);
      playerIdByIdentity.set(identity, playerId);
      acceptedPlayerIds.add(playerId);

      const membershipIndex = nextMemberships.findIndex((membership) =>
        membership.playerId === playerId &&
        membership.teamId === file.teamId &&
        membership.seasonId === file.seasonId,
      );
      const existingMembership = membershipIndex >= 0 ? nextMemberships[membershipIndex] : undefined;
      const nextMembership: PlayerTeamMembership = {
        id: existingMembership?.id ?? makeImportId("ptm"),
        playerId,
        teamId: file.teamId,
        seasonId: file.seasonId,
        rosterStatus: row.rosterStatus,
        jerseyNumber: row.jerseyNumber,
        rosterRole: row.rosterStatus === "JV" ? "JV" : row.rosterStatus === "Varsity" ? "Varsity" : "Development",
        active: true,
        startDate: existingMembership?.startDate,
        endDate: undefined,
        isCaptain: row.isCaptain,
        positionLabels: row.rawPositions,
      };
      if (membershipIndex >= 0) {
        nextMemberships[membershipIndex] = nextMembership;
        membershipsUpdated += 1;
      } else {
        nextMemberships.unshift(nextMembership);
        membershipsAdded += 1;
      }
    }

    if (file.mode === "replace") {
      for (let index = 0; index < nextMemberships.length; index += 1) {
        const membership = nextMemberships[index];
        if (
          membership.teamId === file.teamId &&
          membership.seasonId === file.seasonId &&
          membership.active &&
          !acceptedPlayerIds.has(membership.playerId)
        ) {
          nextMemberships[index] = { ...membership, active: false, endDate: now.slice(0, 10) };
          membershipsRemoved += 1;
        }
      }
    }

    for (const staff of file.staff) {
      const displayName = staff.name.trim();
      if (!displayName) continue;
      const identity = staffIdentityKey(displayName);
      let staffMemberId = staffByIdentity.get(identity);
      const existingMember = staffMemberId ? nextStaffMembers.find((member) => member.id === staffMemberId) : undefined;
      const { firstName, lastName } = splitStaffName(displayName);
      const team = data.teamContext?.availableTeams.find((item) => item.teamId === file.teamId) ?? data.teamContext?.currentTeam;
      if (!staffMemberId) {
        staffMemberId = makeImportId("staff");
        const staffMember: StaffMember = {
          id: staffMemberId,
          organizationId: team?.organizationId ?? data.teamContext?.currentTeam?.organizationId ?? "",
          firstName,
          lastName,
          displayName,
          active: true,
          createdAt: now,
          updatedAt: now,
        };
        nextStaffMembers.unshift(staffMember);
        staffByIdentity.set(identity, staffMemberId);
      } else if (existingMember) {
        const index = nextStaffMembers.findIndex((member) => member.id === existingMember.id);
        nextStaffMembers[index] = {
          ...existingMember,
          firstName: existingMember.firstName ?? firstName,
          lastName: existingMember.lastName ?? lastName,
          active: true,
          updatedAt: now,
        };
      }

      const membershipIndex = nextStaffMemberships.findIndex((membership) =>
        membership.staffMemberId === staffMemberId &&
        membership.teamId === file.teamId &&
        membership.seasonId === file.seasonId,
      );
      const existingMembership = membershipIndex >= 0 ? nextStaffMemberships[membershipIndex] : undefined;
      const nextStaffMembership: StaffTeamMembership = {
        id: existingMembership?.id ?? makeImportId("stm"),
        staffMemberId,
        profileId: existingMembership?.profileId,
        teamId: file.teamId,
        seasonId: file.seasonId,
        baseballRole: normalizeImportedStaffRole(staff.role),
        accessRole: existingMembership?.accessRole ?? "COACH",
        active: true,
        invitationId: existingMembership?.invitationId,
        createdAt: existingMembership?.createdAt ?? now,
        updatedAt: now,
      };
      if (membershipIndex >= 0) {
        nextStaffMemberships[membershipIndex] = nextStaffMembership;
      } else {
        nextStaffMemberships.unshift(nextStaffMembership);
      }
    }
  }

  const currentTeamPlayers = nextPlayers.map((player) => {
    const currentMembership = nextMemberships.find(
      (membership) =>
        membership.playerId === player.id &&
        membership.teamId === data.settings.selectedTeamId &&
        membership.seasonId === data.settings.selectedSeasonId &&
        membership.active,
    );
    return currentMembership
      ? {
          ...player,
          jerseyNumber: currentMembership.jerseyNumber ?? player.jerseyNumber,
          rosterStatus: currentMembership.rosterStatus,
          programLevel: currentMembership.rosterRole === "JV" ? "JV" : currentMembership.rosterRole === "Varsity" ? "Varsity" : player.programLevel,
        }
      : player;
  });

  return {
    data: {
      ...data,
      players: currentTeamPlayers,
      playerTeamMemberships: nextMemberships,
      staffMembers: nextStaffMembers,
      staffTeamMemberships: nextStaffMemberships,
      rosterImports: [
        buildImportHistory(plan, { playersCreated, playersUpdated, membershipsAdded, membershipsUpdated, membershipsRemoved, rowsSkipped }),
        ...(data.rosterImports ?? []),
      ],
      settings: {
        ...data.settings,
        recentPlayerIds: [
          ...plan.files.flatMap((file) => file.rows.map((row) => row.matchedPlayerId ?? row.duplicateSourcePlayerId ?? row.id)),
          ...data.settings.recentPlayerIds,
        ].filter((id, index, ids) => ids.indexOf(id) === index).slice(0, 8),
      },
    },
    playersCreated,
    playersUpdated,
    membershipsAdded,
    membershipsUpdated,
    membershipsRemoved,
    rowsSkipped,
  };
}

export function rosterStatusForTeam(team?: TeamOption): RosterStatus {
  const value = `${team?.teamName ?? ""} ${team?.teamLevel ?? ""}`.toLowerCase();
  if (value.includes("varsity")) return "Varsity";
  if (/\bjv\b|junior varsity/.test(value)) return "JV";
  return "Undecided";
}

export function importModeLabel(mode: RosterImportMode) {
  if (mode === "replace") return "Replace This Team's Roster";
  if (mode === "update") return "Update Existing Players Only";
  return "Keep Current Roster + Add Players";
}

function emptyParsedFile(sourceId: ID, fileName: string, fileType: RosterImportFileType, parseWarnings: string[]): ParsedRosterFile {
  return {
    id: sourceId,
    fileName,
    fileType,
    rows: [],
    staff: [],
    parseWarnings,
    parseStatus: "error",
    parseError: parseWarnings[0] ?? "No roster rows were found.",
  };
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) records.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  if (row.some(Boolean)) records.push(row);
  return records;
}

function readMappedCell(headers: string[], record: string[], field: keyof typeof GENERIC_HEADER_ALIASES) {
  const aliases = new Set(GENERIC_HEADER_ALIASES[field].map(normalizeHeader));
  const index = headers.findIndex((header) => aliases.has(header));
  return index >= 0 ? record[index] ?? "" : "";
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function parseMaxPrepsRosterLine(line: string, sourceId: ID, fileName: string, seasonName: string | undefined, rowNumber: number): ParsedRosterRow | undefined {
  const match = line.match(/^(\d{1,3})\s+(.+?)\s+((?:[A-Z0-9]{1,3},?\s*)+)\s+(Fr\.?|So\.?|Jr\.?|Sr\.?|\d{1,2})\s+(\d+'\d{1,2}")\s+(\d{2,3})$/i);
  if (!match) return undefined;
  return buildMaxPrepsRow({
    sourceId,
    fileName,
    seasonName,
    rowNumber,
    jersey: match[1],
    name: match[2],
    positions: match[3],
    grade: match[4],
    height: match[5],
    weight: match[6],
  });
}

function parseMaxPrepsTableCells(lines: string[], sourceId: ID, fileName: string, seasonName: string | undefined): ParsedRosterRow[] {
  const headerIndex = lines.findIndex((line, index) =>
    line === "#" &&
    /^name$/i.test(lines[index + 1] ?? "") &&
    /^pos\.?$/i.test(lines[index + 2] ?? "") &&
    /^gr\.?$/i.test(lines[index + 3] ?? ""),
  );
  if (headerIndex < 0) return [];
  const rows: ParsedRosterRow[] = [];
  let index = headerIndex + 5;
  while (index < lines.length) {
    if (/^(staff|powered by|address)$/i.test(lines[index])) break;
    if (!/^\d{1,3}$/.test(lines[index])) {
      index += 1;
      continue;
    }
    const row = buildMaxPrepsRow({
      sourceId,
      fileName,
      seasonName,
      rowNumber: rows.length + 1,
      jersey: lines[index],
      name: lines[index + 1] ?? "",
      positions: lines[index + 2] ?? "",
      grade: lines[index + 3] ?? "",
      height: lines[index + 4] ?? "",
      weight: lines[index + 5] ?? "",
    });
    if (row) {
      rows.push(row);
      index += 6;
    } else {
      index += 1;
    }
  }
  return rows;
}

function parseMaxPrepsStaffCells(lines: string[]): ParsedRosterStaff[] {
  const splitHeader = lines.findIndex((line, index) => /^staff$/i.test(line) && /^position$/i.test(lines[index + 1] ?? ""));
  const combinedHeader = lines.findIndex((line) => /^staff\s+position$/i.test(line));
  const start = splitHeader >= 0 ? splitHeader + 2 : combinedHeader >= 0 ? combinedHeader + 1 : -1;
  if (start < 0) return [];
  const staff: ParsedRosterStaff[] = [];
  for (let index = start; index < lines.length - 1; index += 2) {
    const name = lines[index];
    const role = lines[index + 1];
    if (/^powered by$/i.test(name) || /^https?:\/\//i.test(name)) break;
    if (/^(Head Coach|Assistant Coach|Coach|Manager|Trainer)$/i.test(role)) {
      staff.push({ name, role });
    }
  }
  return staff;
}

function buildMaxPrepsRow({
  sourceId,
  fileName,
  seasonName,
  rowNumber,
  jersey,
  name,
  positions,
  grade,
  height,
  weight,
}: {
  sourceId: ID;
  fileName: string;
  seasonName: string | undefined;
  rowNumber: number;
  jersey: string;
  name: string;
  positions: string;
  grade: string;
  height: string;
  weight: string;
}): ParsedRosterRow | undefined {
  if (!name || !positions || !grade || !height || !weight) return undefined;
  const rawPositions = splitPositions(positions);
  const mappedPositions = normalizePositions(rawPositions);
  const rawGrade = grade.replace(/\.$/, "");
  const graduationYear = interpretGraduationYear(rawGrade, seasonName);
  const throws = throwsFromPositions(rawPositions) ?? "R";
  const errors: string[] = [];
  if (!graduationYear) errors.push("Unable to interpret grade.");
  const parts = name.trim().split(/\s+/);
  return {
    id: makeImportId("row"),
    sourceId,
    sourceName: fileName,
    sourceType: "pdf",
    rowNumber,
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    jerseyNumber: parseInteger(jersey),
    rawPositions,
    primaryPosition: mappedPositions[0],
    secondaryPosition: mappedPositions[1],
    bats: "R",
    throws,
    rawGrade,
    graduationYear,
    height: normalizeHeight(height),
    weight: parseInteger(weight),
    errors,
    warnings: graduationYear ? [`${rawGrade} interpreted as class of ${graduationYear}.`] : [],
  };
}

function detectSeasonName(lines: string[]) {
  const line = lines.find((item) => /\b\d{2}[-\u2013]\d{2}\b.*\bbaseball roster\b/i.test(item)) ??
    (lines.some((item) => /^baseball$/i.test(item)) ? lines.find((item) => /^\d{2}[-\u2013]\d{2}$/.test(item)) : undefined);
  const match = line?.match(/\b(\d{2}[-\u2013]\d{2})\b/);
  return match ? `20${match[1].replace("\u2013", "-")}` : undefined;
}

function detectTeamName(lines: string[]) {
  const line = lines.find((item) => /\b(Varsity|JV|Junior Varsity|Freshman|Travel)\b.*\bBaseball Roster\b/i.test(item));
  const match = line?.match(/\b(Varsity|JV|Junior Varsity|Freshman|Travel)\b/i);
  if (match) return `Metrolina ${match[1].replace("Junior Varsity", "JV")}`;
  const level = lines.find((item) => /^(Varsity|JV|Junior Varsity|Freshman|Travel)$/i.test(item));
  return level ? `Metrolina ${level.replace("Junior Varsity", "JV")}` : undefined;
}

function detectSchoolName(lines: string[]) {
  const ignored = /^(address|#|name|pos\.?|gr\.?|ht\.?|wt\.?|staff|position|varsity|jv|junior varsity|freshman|travel|baseball|roster|powered by|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{2}[-\u2013]\d{2})$/i;
  return lines.find((line) => !ignored.test(line) && /academy|school|christian|baseball|metrolina/i.test(line));
}

function splitPositions(value: string) {
  return value
    .split(/[/,;]+|\s{2,}/)
    .map((item) => item.trim().replace(/\.$/, "").toUpperCase())
    .filter(Boolean);
}

function normalizePositions(rawPositions: string[]): [Position, Position?] {
  const mapped = rawPositions.map(mapPosition).filter((position): position is Position => Boolean(position));
  const unique = mapped.filter((position, index) => mapped.indexOf(position) === index);
  if (unique.length === 0) return ["UTIL"];
  return [unique[0], unique[1]];
}

function mapPosition(value: string): Position | undefined {
  const normalized = value.toUpperCase();
  if (normalized === "UTIL") return "UTIL";
  if (normalized === "UT") return "UTIL";
  if (["P", "RHP", "LHP", "C", "1B", "2B", "3B", "SS", "INF", "LF", "CF", "RF", "OF", "UTL", "UTIL", "DH"].includes(normalized)) return normalized as Position;
  return undefined;
}

function throwsFromPositions(rawPositions: string[]): Player["throws"] | undefined {
  if (rawPositions.some((position) => position.toUpperCase() === "LHP")) return "L";
  if (rawPositions.some((position) => position.toUpperCase() === "RHP")) return "R";
  return undefined;
}

function normalizeBats(value: string): Player["bats"] | undefined {
  const normalized = value.trim().toUpperCase();
  return normalized === "L" || normalized === "R" || normalized === "S" ? normalized : undefined;
}

function normalizeThrows(value: string): Player["throws"] | undefined {
  const normalized = value.trim().toUpperCase();
  return normalized === "L" || normalized === "R" ? normalized : undefined;
}

function interpretGraduationYear(value: string, seasonName?: string) {
  const normalized = value.trim().replace(/\.$/, "").toLowerCase();
  const directYear = parseInteger(normalized);
  if (directYear && directYear > 1900) return directYear;
  const grade = gradeNumber(normalized);
  if (!grade) return directYear && directYear >= 9 && directYear <= 12 ? gradeToGraduationYear(directYear, seasonName) : undefined;
  return gradeToGraduationYear(grade, seasonName);
}

function gradeNumber(value: string) {
  if (["sr", "senior", "12"].includes(value)) return 12;
  if (["jr", "junior", "11"].includes(value)) return 11;
  if (["so", "sophomore", "10"].includes(value)) return 10;
  if (["fr", "freshman", "9"].includes(value)) return 9;
  return undefined;
}

function gradeToGraduationYear(grade: number, seasonName?: string) {
  const endYear = schoolYearEnd(seasonName);
  return endYear + (12 - grade);
}

function schoolYearEnd(seasonName?: string) {
  const value = seasonName ?? "";
  const mixedRange = value.match(/\b(20\d{2})[-\u2013](\d{2})\b/);
  if (mixedRange) {
    const start = Number(mixedRange[1]);
    let end = Math.floor(start / 100) * 100 + Number(mixedRange[2]);
    if (end < start) end += 100;
    return end;
  }
  const twoDigitRange = value.match(/\b(\d{2})[-\u2013](\d{2})\b/);
  if (twoDigitRange) {
    const start = 2000 + Number(twoDigitRange[1]);
    const end = 2000 + Number(twoDigitRange[2]);
    return end < start ? end + 100 : end;
  }
  const fourDigitRange = value.match(/\b(20\d{2})\D+(20\d{2})\b/);
  if (fourDigitRange) return Number(fourDigitRange[2]);
  const year = value.match(/\b(20\d{2})\b/);
  if (!year) return new Date().getFullYear() + 1;
  return /fall/i.test(value) ? Number(year[1]) + 1 : Number(year[1]);
}

function normalizeHeight(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d)['\s-]*(\d{1,2})"?$/);
  if (!match) return trimmed || undefined;
  return `${Number(match[1])}'${Number(match[2])}"`;
}

function normalizeHeightFromParts(feet: string, inches: string) {
  const ft = parseInteger(feet);
  const inch = parseInteger(inches);
  if (!ft && !inch) return undefined;
  return `${ft ?? 0}'${inch ?? 0}"`;
}

function parseInteger(value: string) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function parseBoolean(value: string) {
  return /^(true|yes|y|1)$/i.test(value.trim());
}

function normalizeRosterStatus(value: string): RosterStatus | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "varsity" || normalized === "v") return "Varsity";
  if (normalized === "jv" || normalized === "junior varsity") return "JV";
  if (normalized === "undecided" || normalized === "development" || normalized === "pending") return "Undecided";
  if (normalized === "cut" || normalized === "inactive") return "Cut";
  return undefined;
}

function findPlayerCandidates(players: Player[], row: ParsedRosterRow) {
  const rowName = normalizeName(`${row.firstName} ${row.lastName}`);
  return players
    .map((player) => {
      const sameName = normalizeName(player.name) === rowName;
      const sameGrad = row.graduationYear && player.graduationYear === row.graduationYear;
      if (sameName && sameGrad) return { player, confidence: "high" as const };
      if (sameName) return { player, confidence: "possible" as const };
      return undefined;
    })
    .filter((item): item is { player: Player; confidence: "high" | "possible" } => Boolean(item));
}

function mergeImportedPlayer(existing: Player | undefined, row: RosterImportPlanRow, playerId: ID, now: string): Player {
  const name = `${row.firstName} ${row.lastName}`.trim();
  const programLevel = row.rosterStatus === "JV" ? "JV" : row.rosterStatus === "Varsity" ? "Varsity" : "Development";
  return {
    id: playerId,
    name: existing?.name || name,
    jerseyNumber: row.jerseyNumber ?? existing?.jerseyNumber ?? 0,
    primaryPosition: existing?.primaryPosition ?? row.primaryPosition,
    secondaryPosition: existing?.secondaryPosition ?? row.secondaryPosition,
    bats: existing?.bats ?? row.bats,
    throws: existing?.throws ?? row.throws,
    graduationYear: existing?.graduationYear ?? row.graduationYear ?? schoolYearEnd(row.seasonName),
    rosterStatus: row.rosterStatus,
    programLevel,
    height: existing?.height ?? row.height,
    weight: existing?.weight ?? row.weight,
    avatarColor: existing?.avatarColor ?? colorForName(name),
    imageUrl: existing?.imageUrl,
    isPitcher: existing?.isPitcher ?? row.rawPositions.some((position) => ["P", "RHP", "LHP"].includes(position.toUpperCase())),
    isHitter: existing?.isHitter ?? true,
    notes: existing?.notes,
    archived: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function buildImportHistory(plan: RosterImportPlan, result: Omit<RosterImportResult, "data">) {
  return {
    id: plan.id,
    createdAt: plan.createdAt,
    fileNames: plan.files.map((file) => file.fileName),
    teams: plan.files.map((file) => file.teamName),
    teamIds: [...new Set(plan.files.map((file) => file.teamId))],
    seasonIds: [...new Set(plan.files.map((file) => file.seasonId).filter((seasonId): seasonId is ID => Boolean(seasonId)))],
    modes: plan.files.map((file) => file.mode),
    rowsProcessed: plan.files.reduce((sum, file) => sum + file.rows.length, 0),
    ...result,
  };
}

function identityKey(firstName: string, lastName: string, graduationYear?: number) {
  return `${normalizeName(`${firstName} ${lastName}`)}:${graduationYear ?? "unknown"}`;
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function staffIdentityKey(name: string, email?: string) {
  return email ? `email:${email.toLowerCase().trim()}` : `name:${normalizeName(name)}`;
}

function splitStaffName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? undefined,
    lastName: parts.slice(1).join(" ") || undefined,
  };
}

function normalizeImportedStaffRole(role: string): StaffBaseballRole {
  const value = role.trim().toLowerCase();
  if (value.includes("head")) return "Head Coach";
  if (value.includes("pitch")) return "Pitching Coach";
  if (value.includes("hit")) return "Hitting Coach";
  if (value.includes("strength")) return "Strength Coach";
  if (value.includes("catch")) return "Catching Coach";
  if (value.includes("trainer") || value.includes("athletic")) return "Athletic Trainer";
  if (value.includes("manager")) return "Manager";
  if (value.includes("volunteer")) return "Volunteer";
  if (value.includes("assistant") || value === "coach") return "Assistant Coach";
  return "Other";
}

function colorForName(name: string) {
  const colors = ["#8b1e3f", "#2f6f89", "#4f6f52", "#7c5a21", "#5b4f8f", "#8a3d32"];
  const index = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

function makeImportId(prefix: string) {
  void prefix;
  return crypto.randomUUID();
}
