export function workoutStationSelection(
  group: { id: string; current_station_id: string | null } | undefined,
  choices: Record<string, { stationId: string; revision: number }>,
  revision: number,
  individualStation: string,
) {
  if (!group) return individualStation;
  const choice = choices[group.id];
  return choice?.revision === revision ? choice.stationId : group.current_station_id;
}
