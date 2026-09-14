import type { BpSettings } from "./liveBp.ts";
import { normalizeVoiceText, type VoiceIdentity } from "./voiceVocabulary.ts";

export type VoiceContextCommand = {
  kind: "context" | "compound";
  patch: Partial<Pick<BpSettings, "hitterId" | "pitcherId" | "source" | "alignment" | "defense" | "positions" | "velocity">>;
  eventText: string;
  confirmations: string[];
  problems: string[];
  group?: { names: string[]; station: string };
};

export function parseVoiceCommand(text: string, roster: readonly VoiceIdentity[], settings: BpSettings): VoiceContextCommand | null {
  let remaining = normalizeVoiceText(text.replace(/['’]s\b/g," is"));
  const command: VoiceContextCommand = {kind:"context",patch:{},eventText:"",confirmations:[],problems:[]};
  if (/^(?:enable|track|turn on) (?:pitch )?velocity$/.test(remaining)) {
    command.patch.velocity = true;
    command.confirmations.push('Velocity tracking on');
    return command;
  }
  let recognized = false;
  const group = remaining.match(/^(teams? .+?) (?:is |are )?(?:on |in )?(defense|hitting|cages)$/);
  if (group || remaining === "next rotation") {
    command.group = {names: group ? group[1].split(/\s+and\s+/) : [], station:group?.[2] ?? "next rotation"};
    if(group?.[2] === "defense") {
      const presets = (settings.defensePresets ?? []).filter(p=>normalizeVoiceText(p.name) === group[1]);
      if(presets.length===1){const p=presets[0];command.patch={alignment:p.alignment,defense:p.defense,positions:p.positions};command.confirmations.push(`Defense: ${p.name}`);return command;}
    }
    command.problems.push(`Practice groups are not available yet: ${remaining}. Choose an existing defense preset manually.`);
    return command;
  }
  for(let n=0;n<4;n++) {
    const match=remaining.match(/^(?:put (.+?) in|(.+?) (?:is (?:now )?|now )(hitting|pitching|up)|(.+?) (hitting|pitching))\b/);
    if(!match)break;
    recognized=true;
    const name=(match[1]??match[2]??match[4]).trim(), role=match[3]??match[5]??"hitting";
    const pitching=role==="pitching";
    if(pitching && ["coach","machine"].includes(name)) {
      command.patch.source=name==="coach"?"COACH":"MACHINE";
      command.patch.pitcherId=undefined;
      command.confirmations.push(`Source: ${name === "coach" ? "Coach" : "Machine"}`);
    } else {
      const matches=roster.filter(p=>p.aliases.some(alias=>normalizeVoiceText(alias)===name));
      if(matches.length!==1)command.problems.push(matches.length?`Which player is "${name}"?`:`Couldn't match player "${name}".`);
      else {
        const p=matches[0];
        if(pitching){command.patch.pitcherId=p.id;command.patch.source="PLAYER";}
        else command.patch.hitterId=p.id;
        command.confirmations.push(`${pitching?"Pitcher":"Hitter"}: ${p.aliases[0]}`);
      }
    }
    remaining=remaining.slice(match[0].length).replace(/^(?:\s*(?:and|then))?\s*/,"");
  }
  if(!recognized)return null;
  command.eventText=remaining;
  command.kind=remaining?"compound":"context";
  return command;
}
