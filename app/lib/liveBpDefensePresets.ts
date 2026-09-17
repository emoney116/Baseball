import {
  withBpPitcherAlignment,
  type BpSettings,
  type BpDefensePreset,
} from "./liveBp.ts";

export function defensePresetNameKey(name:string):string {
  const numbers:Record<string,string>={one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12'};
  return name.toLowerCase().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,word=>numbers[word]).replace(/[^a-z0-9]/g,'');
}

export function defensePresetIsActive(settings:BpSettings,preset:BpDefensePreset):boolean {
  return activeDefensePresetId(settings) === preset.id;
}

export function activeDefensePresetId(settings:BpSettings):string {
  const matches=(settings.defensePresets??[]).filter(preset=>defensePresetMatches(settings,preset));
  // Equal layouts need the explicit selection, not the first matching name.
  return matches.find(preset=>preset.id===settings.activeDefensePresetId)?.id ?? (matches.length===1?matches[0].id:'');
}

function defensePresetMatches(settings:BpSettings,preset:BpDefensePreset):boolean {
  const current=captureDefensePreset(settings,'','');
  const entries=(value:BpDefensePreset)=>JSON.stringify(Object.entries(value.alignment).sort(([a],[b])=>a.localeCompare(b)));
  return entries(current)===entries(preset) && current.defense===preset.defense && [...current.positions].sort().join() === [...preset.positions].sort().join();
}

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
    activeDefensePresetId: preset.id,
    alignment,
    defense: preset.defense,
    positions: [...preset.positions],
  });
}
