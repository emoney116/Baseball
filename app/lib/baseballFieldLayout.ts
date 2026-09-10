import type { Position } from "../types";
export const GAME_DEFENSIVE_POSITIONS: Position[] = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
];
export const GAME_FIELD_POSITION_COORDINATES: Record<string, [number, number]> =
  {
    P: [50, 76],
    C: [50, 94],
    "1B": [67, 75],
    "2B": [63, 61],
    "3B": [33, 75],
    SS: [37, 61],
    LF: [25, 34],
    CF: [50, 20],
    RF: [75, 34],
  };
export const GAME_LIVE_FIELD_POSITION_COORDINATES: Record<
  string,
  [number, number]
> = {
  ...GAME_FIELD_POSITION_COORDINATES,
  P: [73, 82],
  C: [27, 89],
  "1B": [70, 75],
  "3B": [30, 75],
};
// Position centers on the uncropped, square canonical spray-field asset.
export const CLUBHOUSE_FIELD_POSITION_COORDINATES = {
  P: [50, 67.5],
  C: [50, 94],
  "1B": [72, 67],
  "2B": [64, 53],
  "3B": [28, 67],
  SS: [36, 53],
  LF: [25, 34],
  CF: [50, 20],
  RF: [75, 34],
} as const;
