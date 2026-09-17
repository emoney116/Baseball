import type { BpPosition } from './liveBp.ts';

export const VOICE_POSITIONS: Readonly<Record<string, BpPosition>> = {
  pitcher:'P', p:'P', catcher:'C', c:'C',
  first:'1B', 'first base':'1B', 'first baseman':'1B', '1b':'1B',
  second:'2B', 'second base':'2B', 'second baseman':'2B', '2b':'2B',
  third:'3B', 'third base':'3B', 'third baseman':'3B', '3b':'3B',
  short:'SS', shortstop:'SS', ss:'SS',
  left:'LF', 'left field':'LF', 'left fielder':'LF', lf:'LF',
  center:'CF', 'center field':'CF', 'center fielder':'CF', cf:'CF',
  right:'RF', 'right field':'RF', 'right fielder':'RF', rf:'RF',
};

// Spoken quality is a coach tag, not a calculated EV/launch-angle Barrel.
export const VOICE_QUALITY = {
  hard:'Hard', 'hard hit':'Hard', 'hard contact':'Hard', smoked:'Hard',
  crushed:'Hard', hammered:'Hard', barreled:'Hard', barrel:'Hard',
  'squared up':'Hard', flush:'Hard', medium:'Solid', 'average contact':'Solid',
  soft:'Weak', 'soft contact':'Weak', weak:'Weak', 'weak contact':'Weak',
  jammed:'Weak', 'off the end':'Weak', bleeder:'Weak',
} as const;

export function normalizeBaseballLanguage(text: string): string {
  return text
    .replace(/\bball (?:one|two|three|[1-3])\b/g, 'ball')
    .replace(/\b(left|center|right) field (?:made|makes) (?:an? )?error\b/g, '$1 fielder fielding error error')
    .replace(/\b(left|center|right) fielder (?:made|makes) (?:an? )?error\b/g, '$1 fielder fielding error error')
    .replace(/^fowl(?: ball)?$/, 'foul')
    .replace(/\b(hard|soft|weak)(line|ground|fly)\b/g, '$1 $2')
    .replace(/\b(?:liner|lined it)\b/g, 'line drive')
    .replace(/\b(?:grounder|grounded it)\b/g, 'ground ball')
    .replace(/\b(?:popup|popped it up)\b/g, 'pop up')
    .replace(/\blaid down a bunt\b/g, 'bunt')
    .replace(/\b(?:he )?(?:swung through it|missed it)\b/g, 'whiff')
    .replace(/\b(?:he )?took a strike\b/g, 'called strike')
    .replace(/\b(?:he )?took a ball\b/g, 'ball')
    .replace(/\b(?:he )?fouled (?:it )?(?:off|back)\b/g, 'foul')
    .replace(/\bfoul ball\b/g, 'foul')
    .replace(/\b(?:he )?put it in play\b/g, 'in play')
    .replace(/\b(?:got him swinging)\b/g, 'swing and miss strikeout')
    .replace(/\b(?:got him looking|he watched strike three)\b/g, 'called strike strikeout')
    .replace(/\b(?:top of the zone|top)\b/g, 'high')
    .replace(/\b(?:bottom of the zone|bottom)\b/g, 'low')
    .replace(/\binner half\b/g, 'inside')
    .replace(/\bouter half\b/g, 'away')
    .replace(/\bheart of the plate\b/g, 'middle')
    .replace(/\bhigh and tight\b/g, 'up and in')
    .replace(/\bhigh and in\b/g, 'up and in')
    .replace(/\bhigh and away\b/g, 'up and away')
    .replace(/\blow and in\b/g, 'down and in')
    .replace(/\bstraightaway center\b/g, 'center field')
    .replace(/\bgap in (left|right) center\b/g, '$1 center')
    .replace(/\b(?:man|guy) (?:on|at) (first|second|third)\b/g, 'runner on $1')
    .replace(/\brunners at the corners\b/g, 'runners on first and third')
    .replace(/\b(?:base hit)\b/g, 'single')
    .replace(/\btwo bagger\b/g, 'double')
    .replace(/\b(?:fielded it clean|made the play)\b/g, 'clean play')
    .replace(/\b(?:good throw|on target)\b/g, 'accurate throw')
    .replace(/\b(?:bad throw|offline throw)\b/g, 'inaccurate throw')
    .replace(/\bscratch that\b/g, 'undo that');
}

/** An unlabeled measurement attached to contact is EV, not a late pitch speed. */
export function anchorContactMeasurements(text:string):string {
  const contact=/\b(?:line drive|ground ball|fly ball|pop up|bunt)\b/.exec(text);
  if(!contact)return text;
  const head=text.slice(0,contact.index),tail=text.slice(contact.index);
  // A later explicit pitch anchor starts a new measurement scope. Never label
  // pitch speed or launch angle as EV merely because contact appeared earlier.
  const pitch = /\b(?:fastball|four seam|two seam|slider|curve(?:ball)?|changeup|cutter|sinker|pitch)\b/.exec(tail);
  const contactTail = pitch ? tail.slice(0, pitch.index) : tail;
  const rest = pitch ? tail.slice(pitch.index) : '';
  return head+contactTail.replace(/\b(?:at )?(\d{2,3})\b(?: mph)?/g,(match, number:string, offset:number)=>{
    const before=contactTail.slice(0,offset),after=contactTail.slice(offset+match.length);
    if (/(?:exit(?: velo(?:city)?)?|ev|came off at|hit it|launch angle)\s*$/.test(before)
      || /^\s*(?:(?:miles? (?:per|an?) hour)\s*)?(?:exit|ev|off the bat|degrees?)\b/.test(after)) return match;
    return `${number} exit`;
  })+rest;
}

export function normalizeCountLanguage(text: string): string {
  if (/^(?:full count|(?:the )?count is full)$/.test(text)) return 'count 3 2';
  if (/^new count$/.test(text)) return 'reset count';
  const number = '(zero|oh|nothing|no|one|two|three|[0-3])';
  const explicit = text.match(new RegExp(`^${number} balls? (?:and )?${number} strikes?$`));
  const pair = explicit ?? text.match(new RegExp(`^(?:(?:it is|it's|he is|he's|count(?: is| as)?|start him) )?${number} (?:and )?${number}$`));
  if (!pair) return text;
  const value = (word: string) => ({zero:0,oh:0,nothing:0,no:0,one:1,two:2,three:3}[word] ?? Number(word));
  const balls = value(pair[1]), strikes = value(pair[2]);
  return balls <= 3 && strikes <= 2 ? `count ${balls} ${strikes}` : text;
}

export function matchAlignmentLanguage(text: string): {name:string; position:BpPosition; length:number} | null {
  const positions = Object.keys(VOICE_POSITIONS).sort((a,b)=>b.length-a.length).join('|');
  const pattern = new RegExp(`^(?:(?:put|move) (.+?) (?:from (?:${positions}) )?(?:over )?(?:at|to|in)|(.+?) (?:(?:is )?(?:now )?playing|is (?:our|at|in)|(?:goes|moves) to|at|to|in)) (${positions})(?: now)?(?=$| and | then | )`);
  const match = text.match(pattern);
  if (match && /\b(?:runner|runners|ball|single|double|triple|fly|line|ground|bunt|throw|throws|threw|pitch|fastball|slider|changeup|curveball|cutter|sinker)\b|\d{2,3}/.test(match[1] ?? match[2])) return null;
  return match ? {name:match[1] ?? match[2], position:VOICE_POSITIONS[match[3]], length:match[0].length} : null;
}
