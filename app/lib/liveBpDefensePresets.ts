import {
  withBpPitcherAlignment,
  type BpSettings,
  type BpDefensePreset,
} from "./liveBp.ts";

export function captureDefensePreset(
  settings: BpSettings,
  id: string,
  name: string,
): BpDefensePreset {
  const alignment = { ...settings.alignment };
  delete alignment.P;
  return {
    id,
    name: name.trim(),
    alignment,
    defense: settings.defense,
    positions: [...settings.positions],
  };
}

export function applyDefensePreset(
  settings: BpSettings,
  preset: BpDefensePreset,
  availablePlayerIds: string[],
): BpSettings {
  const alignment = Object.fromEntries(
    Object.entries(preset.alignment).filter(([, id]) =>
      availablePlayerIds.includes(id!),
    ),
  );
  return withBpPitcherAlignment({
    ...settings,
    alignment,
    defense: preset.defense,
    positions: [...preset.positions],
  });
}
