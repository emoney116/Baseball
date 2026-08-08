export type ID = string;

export type PracticeType =
  | "Full Practice"
  | "Bullpen Day"
  | "Live BP"
  | "Hitting Day"
  | "Scrimmage"
  | "Pitcher Development"
  | "Hitter Development"
  | "Custom";

export type Position =
  | "P"
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "LF"
  | "CF"
  | "RF"
  | "UTL"
  | "DH";

export type Handedness = "R" | "L" | "S";
export type Throws = "R" | "L";

export type PracticeStation =
  | "Bullpen"
  | "Live BP"
  | "Machine"
  | "Coach BP"
  | "Front Toss"
  | "Tee";

export type PitchType =
  | "4-Seam"
  | "2-Seam"
  | "Sinker"
  | "Cutter"
  | "Slider"
  | "Curveball"
  | "Changeup"
  | "Splitter"
  | "Other";

export type PitchOutcome =
  | "Ball"
  | "Called Strike"
  | "Swing"
  | "Take"
  | "Foul"
  | "Whiff"
  | "Ball in play"
  | "HBP";

export type BattedBallType = "Ground ball" | "Line drive" | "Fly ball" | "Pop up";
export type ContactQuality =
  | "Weak contact"
  | "Medium contact"
  | "Hard contact";
export type HittingContactQuality = "Poor" | "Weak" | "Solid" | "Hard" | "Barrel";

export type Direction =
  | "Pull"
  | "Pull-center"
  | "Center"
  | "Opposite-center"
  | "Opposite"
  | "LF"
  | "LCF"
  | "CF"
  | "RCF"
  | "RF"
  | "3B side"
  | "Middle"
  | "1B side";

export type PitchFocusTag =
  | "Fastball command"
  | "Secondary command"
  | "Velocity"
  | "Mechanics"
  | "Sequencing"
  | "Strike throwing"
  | "Two-strike pitches"
  | "Changeup development"
  | "Breaking ball development"
  | "Other";

export type RoundGoal =
  | "Pull"
  | "Middle"
  | "Oppo"
  | "Line drives"
  | "Two-strike"
  | "Situational"
  | "Fastball timing"
  | "Breaking balls"
  | "Velocity"
  | "Approach"
  | "Custom";

export type NoteTag =
  | "Mechanics"
  | "Approach"
  | "Timing"
  | "Command"
  | "Velocity"
  | "Confidence"
  | "Defense"
  | "Strength"
  | "Development Goal";

export interface Player {
  id: ID;
  name: string;
  jerseyNumber: number;
  primaryPosition: Position;
  secondaryPosition?: Position;
  bats: Handedness;
  throws: Throws;
  graduationYear: number;
  avatarColor: string;
  imageUrl?: string;
  isPitcher: boolean;
  isHitter: boolean;
  notes?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Practice {
  id: ID;
  date: string;
  name: string;
  type: PracticeType;
  location: string;
  notes?: string;
  playerIds: ID[];
  pitcherIds: ID[];
  hitterIds: ID[];
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeAttendance {
  id: ID;
  practiceId: ID;
  playerId: ID;
  role: "Pitcher" | "Hitter" | "Two-way" | "Observer";
  checkedInAt: string;
}

export interface PitchingSession {
  id: ID;
  practiceId: ID;
  pitcherId: ID;
  type: "Bullpen" | "Live BP";
  catcherId?: ID;
  hitterId?: ID;
  focusTags: PitchFocusTag[];
  intendedFocus?: string;
  startedAt: string;
  endedAt?: string;
  summaryNote?: string;
  sessionGrade?: string;
}

export interface PitchEvent {
  id: ID;
  practiceId: ID;
  sessionId: ID;
  pitcherId: ID;
  hitterId?: ID;
  plateAppearanceId?: ID;
  pitchNumber: number;
  pitchType: PitchType;
  outcome: PitchOutcome;
  isStrike: boolean;
  isSwing: boolean;
  isZone: boolean;
  isChase?: boolean;
  isWhiff?: boolean;
  isCalledStrike?: boolean;
  isBallInPlay?: boolean;
  battedBall?: BattedBallType;
  contactQuality?: ContactQuality;
  velocity?: number;
  qualityRating?: number;
  missedIntendedLocation?: boolean;
  intendedTarget?: ZonePoint;
  location?: ZonePoint;
  countBefore?: CountState;
  countAfter?: CountState;
  mechanicalNote?: string;
  coachNote?: string;
  createdAt: string;
}

export interface HittingSession {
  id: ID;
  practiceId: ID;
  hitterId: ID;
  type: "Tee" | "Front Toss" | "Machine" | "Coach BP" | "Live BP";
  machineVelocity?: number;
  machinePitchType?: PitchType;
  machineLocation?: string;
  distance?: string;
  machineType?: string;
  coachBpStyle?: "Overhand" | "Short toss" | "Front toss" | "Mixed";
  roundGoals: RoundGoal[];
  plannedReps?: number;
  startedAt: string;
  endedAt?: string;
  summaryNote?: string;
  sessionGrade?: string;
}

export interface HittingEvent {
  id: ID;
  practiceId: ID;
  sessionId: ID;
  hitterId: ID;
  pitcherId?: ID;
  plateAppearanceId?: ID;
  eventNumber: number;
  action: "Took pitch" | "Swing" | "Miss" | "Foul" | "Ball in play";
  contactResult?: BattedBallType;
  contactQuality?: HittingContactQuality;
  direction?: Direction;
  fieldLocation?: ZonePoint;
  pitchType?: PitchType;
  velocity?: number;
  isLiveBp?: boolean;
  createdAt: string;
}

export interface PlateAppearance {
  id: ID;
  practiceId: ID;
  pitchingSessionId?: ID;
  hittingSessionId?: ID;
  pitcherId: ID;
  hitterId: ID;
  startedAt: string;
  endedAt?: string;
  outcome?:
    | "Strikeout looking"
    | "Strikeout swinging"
    | "Walk"
    | "HBP"
    | "Single"
    | "Double"
    | "Triple"
    | "Home run"
    | "Groundout"
    | "Flyout"
    | "Lineout"
    | "Popout"
    | "Reached on error"
    | "Fielder's choice";
  balls: number;
  strikes: number;
}

export interface CoachNote {
  id: ID;
  scope:
    | { type: "Player"; playerId: ID }
    | { type: "Practice"; practiceId: ID }
    | { type: "PitchingSession"; sessionId: ID; playerId: ID }
    | { type: "HittingSession"; sessionId: ID; playerId: ID };
  tags: NoteTag[];
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface DevelopmentGoal {
  id: ID;
  playerId: ID;
  title: string;
  tags: NoteTag[];
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ZonePoint {
  x: number;
  y: number;
}

export interface CountState {
  balls: number;
  strikes: number;
}

export interface AppSettings {
  activePracticeId?: ID;
  theme: "dark" | "light";
  rosterSeason: string;
  recentPlayerIds: ID[];
}

export interface AppData {
  players: Player[];
  practices: Practice[];
  attendance: PracticeAttendance[];
  pitchingSessions: PitchingSession[];
  pitchEvents: PitchEvent[];
  hittingSessions: HittingSession[];
  hittingEvents: HittingEvent[];
  plateAppearances: PlateAppearance[];
  coachNotes: CoachNote[];
  developmentGoals: DevelopmentGoal[];
  settings: AppSettings;
}
