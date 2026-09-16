import { initialBpState, type BpSettings, type BpState, type BpPosition } from "./liveBp.ts";
import { normalizeVoiceText, type VoiceIdentity } from "./voiceVocabulary.ts";
import { correctedVoiceText } from "./voiceSession.ts";

export type VoiceContextCommand = {
  kind: "context" | "compound";
  patch: Partial<BpSettings>;
  statePatch?: Partial<BpState>;
  eventText: string;
  confirmations: string[];
  problems: string[];
  group?: { names: string[]; station: string };
};

export function parseVoiceCommand(text: string, roster: readonly VoiceIdentity[], settings: BpSettings, state: BpState = initialBpState()): VoiceContextCommand | null {
  let remaining = correctedVoiceText(text.replace(/['’]s\b/g," is"));
  const command: VoiceContextCommand = {kind:"context",patch:{},eventText:"",confirmations:[],problems:[]};
  const setting = remaining.match(/^(start tracking|stop tracking|track|dont track|do not track|enable|disable|turn on|turn off|turn) (?:pitch )?(velocity|locations?|location tracking|counts?|count tracking|defense|exit velo(?:city)?|ev|spray)(?: (on|off|now))?$/);
  if (setting) {
    const enabled = !["stop tracking", "dont track", "do not track", "disable", "turn off"].includes(setting[1]) && setting[3] !== "off";
    if (setting[1] === "turn" && !["on", "off"].includes(setting[3])) return null;
    const field = setting[2].startsWith("location") ? "location" : setting[2].startsWith("count") ? "countTracking" : setting[2].startsWith("exit") || setting[2] === "ev" ? "ev" : setting[2];
    if (field === "defense") command.patch.defense = enabled ? "ALL" : "OFF";
    else if (field === "velocity" || field === "location" || field === "countTracking" || field === "ev" || field === "spray") command.patch[field] = enabled;
    if (field === "countTracking" && !enabled) command.statePatch = { countKnown: false, balls: 0, strikes: 0 };
    command.confirmations.push(`${setting[2]} tracking ${enabled ? "on" : "off"}`);
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
  const number = (value: string) => ({zero:0,one:1,two:2,three:3,nobody:0}[value] ?? Number(value));
  for(let n=0;n<12;n++) {
    remaining = remaining.replace(/^(?:and |then )/, "").trim();
    const alignment = remaining.match(/^(?:(?:put|move) (.+?) (?:at|to)|(.+?) is (?:at|in)) (short(?:stop)?|center(?: field)?|left(?: field)?|right(?: field)?|first(?: base)?|second(?: base)?|third(?: base)?|catcher)\b/);
    if (alignment) {
      recognized = true;
      const name = alignment[1] ?? alignment[2];
      const matches = roster.filter(p=>p.aliases.some(alias=>normalizeVoiceText(alias)===name));
      if (matches.length !== 1) command.problems.push(`Which player is "${name}"?`);
      else {
        const positions: Record<string,BpPosition> = {short:'SS',shortstop:'SS',center:'CF',left:'LF',right:'RF',first:'1B',second:'2B',third:'3B',catcher:'C'};
        const position = positions[alignment[3].split(' ')[0]];
        const current = {...settings.alignment,...command.patch.alignment};
        for (const key of Object.keys(current) as BpPosition[]) if(current[key]===matches[0].id) delete current[key];
        if (settings.source==='PLAYER' && settings.pitcherId===matches[0].id) command.problems.push('Change the current pitcher before assigning that player elsewhere.');
        else command.patch.alignment = {...current,[position]:matches[0].id};
        command.confirmations.push(`${matches[0].aliases[0]}: ${position}`);
      }
      remaining = remaining.slice(alignment[0].length).trim();
      continue;
    }
    const count = remaining.match(/^(?:(?:set )?count(?: is)?|start(?: him)?) (zero|one|two|three|[0-3]) (?:and )?(zero|one|two|[0-2])\b/);
    const reset = remaining.match(/^reset (?:the )?count\b/);
    const outs = remaining.match(/^(nobody|zero|one|two|[0-2]) outs?\b/);
    const runners = remaining.match(/^(?:runners? on (first|second|third)(?: (?:base )?and (first|second|third))?(?: base)?|bases (loaded|empty))\b/);
    const another = remaining.match(/^(.+?) gets another at bat\b/);
    const source = remaining.match(/^(machine|coach) now\b/);
    const contextMatch = count ?? reset ?? outs ?? runners ?? another ?? source;
    if (contextMatch) {
      recognized = true;
      const patch: Partial<BpState> = {};
      if (count) Object.assign(patch, {balls:number(count[1]),strikes:number(count[2]),countKnown:true});
      if (reset) Object.assign(patch, {balls:0,strikes:0});
      if (outs) Object.assign(patch, {outs:number(outs[1]),situationKnown:true});
      if (runners) {
        const bases: Record<string,number> = {first:1,second:2,third:3};
        Object.assign(patch, {runners:runners[3] === "loaded" ? [1,2,3] : runners[3] === "empty" ? [] : [...new Set([runners[1],runners[2]].filter(Boolean).map(b=>bases[b]))],runnerIds:{},situationKnown:true});
      }
      if (another) {
        const matches = roster.filter(p=>p.aliases.some(alias=>normalizeVoiceText(alias)===another[1]));
        if (matches.length !== 1) command.problems.push(`Which player is "${another[1]}"?`);
        else command.patch.hitterId = matches[0].id;
        Object.assign(patch, {balls:0,strikes:0,pa:state.pa+1});
      }
      if (source) { command.patch.source = source[1] === "coach" ? "COACH" : "MACHINE"; command.patch.pitcherId = undefined; }
      command.statePatch = {...command.statePatch,...patch};
      command.confirmations.push(contextMatch[0]);
      remaining = remaining.slice(contextMatch[0].length).trim();
      continue;
    }
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
    remaining=remaining.slice(match[0].length).replace(/^(?:\s*(?:now|again|and|then))?\s*/,"");
  }
  if(!recognized)return null;
  command.eventText=remaining;
  command.kind=remaining?"compound":"context";
  return command;
}
