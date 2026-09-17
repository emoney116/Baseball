import { initialBpState, type BpSettings, type BpState, type BpPosition } from "./liveBp.ts";
import { normalizeVoiceText, voiceIdentityMatches, VOICE_PITCH_ALIASES, type VoiceIdentity } from "./voiceVocabulary.ts";
import { correctedVoiceText } from "./voiceSession.ts";
import { matchAlignmentLanguage, normalizeCountLanguage, VOICE_POSITIONS } from './voiceBaseballLanguage.ts';

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
  let remaining = normalizeCountLanguage(correctedVoiceText(text.replace(/['’]s\b/g," is")))
    .replace(/\b(?:is )?batting\b/g,'is hitting')
    .replace(/\bis at the plate\b/g,'is hitting')
    .replace(/\banother ab\b/g,'another at bat')
    .replace(/\bis still pitching\b/g,'is pitching')
    .replace(/\b(?:is taking defense|are defending|is defending)\b/g,'on defense')
    .replace(/^dont /,'do not ')
    .replace(/^don't /,'do not ')
    .replace(/^(track|start tracking|stop tracking|do not track) velo$/,'$1 velocity')
    .replace(/^(track|start tracking|stop tracking) exit$/,'$1 exit velo')
    .replace(/^stop locations$/,'stop tracking locations')
    .replace(/^the (machine|coach)\b/, '$1')
    .replace(/\bbase is (loaded|empty)\b/g, 'bases $1')
    .replace(/\brunners? at (first|second|third)\b/g, 'runner on $1')
    .replace(/\bthere is (?:a |one )?(?:guy|runner) on\b/g, 'runner on');
  const command: VoiceContextCommand = {kind:"context",patch:{},eventText:"",confirmations:[],problems:[]};
  const substitution=remaining.match(/^(?:put )?(.+?) (?:in for|replaces) (.+?) at (.+)$/);
  if(substitution){
    const position=VOICE_POSITIONS[substitution[3]];
    const replaced=roster.filter(player=>voiceIdentityMatches(player,substitution[2]));
    if(!position||replaced.length!==1||settings.alignment?.[position]!==replaced[0].id){command.problems.push('Substitution needs a known player at the spoken position.');return command;}
    remaining=`${substitution[1]} at ${substitution[3]}`;
  }
  const swap=remaining.match(/^swap (.+?) and (.+)$/);
  if(swap){
    const identities=swap.slice(1).map(name=>roster.filter(player=>voiceIdentityMatches(player,name)));
    const positions=identities.map(matches=>matches.length===1?Object.entries(settings.alignment??{}).filter(([,id])=>id===matches[0].id):[]);
    if(positions.some(found=>found.length!==1)||identities[0][0]?.id===identities[1][0]?.id||positions.some(found=>found[0]?.[0]==='P'))command.problems.push('Swap needs two distinct, assigned fielders; change the pitcher using pitcher controls.');
    else {command.patch.alignment={...settings.alignment,[positions[0][0][0]]:identities[1][0].id,[positions[1][0][0]]:identities[0][0].id};command.confirmations.push(`Swap ${swap[1]} and ${swap[2]}`);}
    return command;
  }
  if(/^(?:same hitter|new at bat|start a new ab)$/.test(remaining)){
    command.statePatch={balls:0,strikes:0,pa:state.pa+1};command.confirmations.push('Same hitter: new at-bat');return command;
  }
  const combinedSettings = remaining.match(/^(start tracking|stop tracking|track|turn) (.+?) and (.+?)(?: (on|off))?$/);
  if (combinedSettings) {
    const suffix = combinedSettings[4] ? ` ${combinedSettings[4]}` : '';
    const parts = [combinedSettings[2],combinedSettings[3]].map(field => parseVoiceCommand(`${combinedSettings[1]} ${field}${suffix}`,roster,settings,state));
    if (parts.every(part => part?.kind === 'context' && !part.problems.length && part.confirmations.some(value=>value.includes('tracking')))) {
      for (const part of parts) {
        Object.assign(command.patch,part!.patch);
        if (part!.statePatch) command.statePatch={...command.statePatch,...part!.statePatch};
        command.confirmations.push(...part!.confirmations);
      }
      return command;
    }
    command.problems.push('Choose the tracking settings to change.');
    return command;
  }
  remaining = remaining.replace(/\b(defense|velocity|spray|exit velo(?:city)?) tracking\b/g, '$1');
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
    remaining = remaining.replace(/^(?:and |then |with )/, "").trim();
    if (/^(?:(?:we are|we're) (?:now )?in )?multi(?:ple)? pitch(?:es| mode)?(?: now)?$|^(?:mix pitches|we're mixing(?: pitches)?|we are mixing pitches|pitchers can throw anything|throw anything)(?: now)?$/.test(remaining)) {
      recognized = true;
      command.patch.pitchMode = "MULTI";
      command.confirmations.push("Pitch mode: Multi");
      remaining = "";
      break;
    }
    remaining=remaining.replace(/^(?:all|back to) (fastballs|sliders|changeups|curveballs|cutters)$/,'$1 only');
    const program = remaining.match(/^(?:(.+?) (?:is (?:pitching|throwing)|(?:are|we're) throwing) |(?:we're|we are) throwing )?(.+?)(?: only)(?: now)?$/)
      ?? remaining.match(/^(machine|coach) is throwing (.+?)(?: now)?$/);
    if (program) {
      const shortMachine = !program[1] && program[2].startsWith("machine ");
      const pitch = VOICE_PITCH_ALIASES[program[2].replace(/^machine /, "").replace(/s$/, "")];
      if (pitch) {
        recognized = true;
        const name = shortMachine ? "machine" : program[1];
        if (name && name !== "we") {
          if (name === "coach" || name === "machine") {
            command.patch.source = name === "coach" ? "COACH" : "MACHINE";
            command.patch.pitcherId = undefined;
          } else {
            const matches = roster.filter(p => voiceIdentityMatches(p, name));
            if (matches.length !== 1) command.problems.push(`Which player is "${name}"?`);
            else { command.patch.source = "PLAYER"; command.patch.pitcherId = matches[0].id; }
          }
        }
        command.patch.pitchMode = "ONE";
        command.patch.pitchType = pitch;
        command.confirmations.push(`Pitch mode: Single ${pitch}`);
        remaining = "";
        break;
      }
    }
    const alignment = matchAlignmentLanguage(remaining);
    if (alignment) {
      recognized = true;
      const name = alignment.name;
      const matches = roster.filter(p=>voiceIdentityMatches(p,name));
      if (matches.length !== 1) command.problems.push(`Which player is "${name}"?`);
      else {
        const position = alignment.position;
        const current = {...settings.alignment,...command.patch.alignment};
        for (const key of Object.keys(current) as BpPosition[]) if(current[key]===matches[0].id) delete current[key];
        if (position==='P') {
          command.patch.source='PLAYER';command.patch.pitcherId=matches[0].id;
          command.patch.alignment={...current,P:matches[0].id};
        } else if (settings.source==='PLAYER' && settings.pitcherId===matches[0].id) command.problems.push('Change the current pitcher before assigning that player elsewhere.');
        else command.patch.alignment = {...current,[position]:matches[0].id};
        command.confirmations.push(`${matches[0].aliases[0]}: ${position}`);
      }
      remaining = remaining.slice(alignment.length).trim();
      continue;
    }
    if (/^ball (?:four|4)$/.test(remaining)) {
      recognized = true;
      command.statePatch = {...command.statePatch, balls:3, countKnown:true};
      command.confirmations.push('Ball four: walk');
      remaining = 'ball';
      break;
    }
    const job = remaining.match(/^job (?:is )?(?:to )?(score (?:the )?runner|move (?:the )?runner|sacrifice bunt)\b/);
    if (job) {
      recognized = true;
      command.statePatch = {...command.statePatch, job:job[1], situationKnown:true};
      command.confirmations.push(`Job: ${job[1]}`);
      remaining = remaining.slice(job[0].length).trim();
      continue;
    }
    const count = remaining.match(/^(?:(?:set )?count(?: is)?|start(?: him| the count)?) (zero|one|two|three|[0-3]) (?:and )?(zero|one|two|[0-2])\b/);
    const reset = remaining.match(/^reset (?:the )?count\b/);
    const outs = remaining.match(/^(nobody|zero|one|two|[0-2]) outs?\b/);
    const runners = remaining.match(/^(?:runners? on (first|second|third)(?: base)?(?: and (first|second|third))?(?: base)?|bases (loaded|empty))\b/);
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
        const matches = roster.filter(p=>voiceIdentityMatches(p,another[1]));
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
    if(pitching && (name === "machine" || /^coach(?: |$)/.test(name))) {
      command.patch.source=name==="machine"?"MACHINE":"COACH";
      command.patch.pitcherId=undefined;
      command.confirmations.push(`Source: ${name === "machine" ? "Machine" : "Coach"}`);
    } else {
      const matches=roster.filter(p=>voiceIdentityMatches(p,name));
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
