import {BP_POSITIONS,BP_PLAY_RUNNER_REASONS,buildBpPitch,validateBpSettings,validateBpState,withBpRunners,type BpDraft,type BpSettings} from './liveBp.ts';
import {TENDEX_PITCH_TYPES} from './tendexGameAnalysis.ts';
import {buildBpRunnerMove,BP_RUNNER_REASONS,type BpRunnerMove} from './liveBpRunnerMove.ts';
import {buildBpDefenseRep,type BpDefenseRep} from './liveBpDefenseRep.ts';
import {interpretVoice,type VoiceContext} from './voiceIntent.ts';
import {parseVoiceCommand} from './voiceCommands.ts';
import {isVoicePromptEcho} from './voiceTranscriptionPrompt.ts';

type Schema={type?:string;enum?:unknown[];properties?:Record<string,Schema>;required?:string[];additionalProperties?:boolean;items?:Schema;anyOf?:Schema[];minimum?:number;maximum?:number;maxItems?:number;maxLength?:number};
const str:Schema={type:'string',maxLength:160};
const num=(minimum:number,maximum:number):Schema=>({type:'number',minimum,maximum});
const integer=(minimum:number,maximum:number):Schema=>({...num(minimum,maximum),type:'integer'});
const choice=(...values:string[]):Schema=>({type:'string',enum:values});
const nullable=(s:Schema):Schema=>({anyOf:[s,{type:'null'}]});
const object=(properties:Record<string,Schema>):Schema=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const array=(items:Schema,maxItems=12):Schema=>({type:'array',items,maxItems});
const point=nullable(object({x:num(0,1),y:num(0,1)}));
const draft=object({outcome:nullable(choice('Ball','Called Strike','Whiff','Foul','Ball in play','HBP')),pitchType:nullable(choice(...TENDEX_PITCH_TYPES)),velocity:nullable(num(20,110)),location:point,ev:nullable(num(20,130)),spray:point,battedBall:nullable(choice('Ground ball','Hard ground ball','Line drive','Fly ball','Pop up','Bunt')),contactQuality:nullable(choice('Poor','Weak','Solid','Hard','Barrel')),result:nullable(choice('Out','Single','Double','Triple','Home Run','Reached on Error','Fielders Choice','Sac Bunt','Sac Fly')),position:nullable(choice(...BP_POSITIONS)),defenseResult:nullable(choice('Clean','Error','Missed Rep','Great Play')),errorType:nullable(choice('Fielding','Throwing','Decision')),throwResult:nullable(choice('Accurate','Inaccurate','No Throw')),jobSuccess:nullable({type:'boolean'})});
const fields={
  set_hitter:{playerId:str},set_pitcher:{playerId:str},set_pitch_source:{source:choice('PLAYER','COACH','MACHINE')},
  set_pitch_program:{mode:choice('OFF','ONE','MULTI'),pitchType:nullable(choice(...TENDEX_PITCH_TYPES))},
  set_count:{balls:integer(0,3),strikes:integer(0,2)},set_outs:{outs:integer(0,2)},
  set_runners:{runners:array(object({base:integer(1,3),playerId:nullable(str)}),3)},
  set_defender:{position:choice(...BP_POSITIONS),playerId:str},start_new_pa:{},
  record_pitch:{draft},open_play:{draft},update_play:{draft},
  record_runner_action:{from:integer(1,3),to:integer(1,4),outcome:choice('safe','out'),reason:choice(...new Set([...BP_RUNNER_REASONS,...BP_PLAY_RUNNER_REASONS]))},
  record_defensive_action:{position:choice(...BP_POSITIONS),result:choice('Clean','Error','Missed Rep','Great Play'),errorType:nullable(choice('Fielding','Throwing','Decision'))},
  set_situational_job:{job:str},complete_play:{},complete_pa:{},undo_last_action:{},
  correct_recent_event:{eventId:str,draft},
} satisfies Record<string,Record<string,Schema>>;
export type V2ToolName=keyof typeof fields;
export type V2ToolAction={name:V2ToolName;args:Record<string,unknown>};
export const V2_TOOL_SCHEMAS=Object.entries(fields).map(([name,properties])=>({type:'function',name,description:`Clubhouse ${name}. Propose only explicit or uniquely contextual facts.`,strict:true,parameters:object(properties)}));
export const V2_BATCH_SCHEMA=object({decision:choice('actions','review','ignore'),reason:str,actions:array({anyOf:Object.entries(fields).map(([name,properties])=>object({name:choice(name),args:object(properties)}))},24)});

function validate(value:unknown,schema:Schema,path='batch'):void {
  if(schema.anyOf){if(schema.anyOf.some(s=>{try{validate(value,s,path);return true;}catch{return false;}}))return;throw new Error(`${path}: unsupported shape`);}
  if(schema.enum&&!schema.enum.includes(value))throw new Error(`${path}: unsupported value`);
  if(schema.type==='null'){if(value!==null)throw new Error(`${path}: expected null`);return;}
  if(schema.type==='object') {
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${path}: expected object`);
    const record=value as Record<string,unknown>;
    if(Object.keys(record).some(k=>!Object.hasOwn(schema.properties??{},k)))throw new Error(`${path}: unknown field`);
    for(const key of schema.required??[])if(!Object.hasOwn(record,key))throw new Error(`${path}.${key}: required`);
    for(const [key,item] of Object.entries(record))validate(item,schema.properties![key],`${path}.${key}`);
  } else if(schema.type==='array') {
    if(!Array.isArray(value)||value.length>(schema.maxItems??24))throw new Error(`${path}: bounded array required`);
    value.forEach((item,i)=>validate(item,schema.items!,`${path}[${i}]`));
  } else if(schema.type==='number'||schema.type==='integer') {
    if(typeof value!=='number'||!Number.isFinite(value)||(schema.type==='integer'&&!Number.isInteger(value))||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity))throw new Error(`${path}: invalid number`);
  } else if(typeof value!==schema.type||(typeof value==='string'&&value.length>(schema.maxLength??160)))throw new Error(`${path}: invalid ${schema.type}`);
}
export function parseV2Batch(value:unknown) {
  validate(value,V2_BATCH_SCHEMA);
  const batch=value as {decision:'actions'|'review'|'ignore';reason:string;actions:V2ToolAction[]};
  if((batch.decision==='actions')!==Boolean(batch.actions.length))throw new Error('Action decision and payload disagree');
  return batch;
}
export function v2Action(name:V2ToolName,args:Record<string,unknown>={}):V2ToolAction {
  const properties=fields[name] as Record<string,Schema>;
  if(args.draft)args={...args,draft:Object.fromEntries(Object.keys(draft.properties!).map(key=>[key,(args.draft as Record<string,unknown>)[key]??null]))};
  const normalized=Object.fromEntries(Object.keys(properties).map(k=>[k,args[k]??(properties[k].anyOf?null:undefined)]));
  validate(normalized,object(properties),name);return {name,args:normalized};
}
const cleanDraft=(value:unknown)=>Object.fromEntries(Object.entries(value as Record<string,unknown>).filter(([,v])=>v!==null)) as Partial<BpDraft>;
type Commit={id:string;at:number;before:VoiceContext;draft?:BpDraft;kind:string};

/** QA-only, atomic in-memory adapter. No database client or arbitrary write tool. */
export class TypedVoiceV2 {
  context:VoiceContext;
  openPlay:{draft:BpDraft;context:VoiceContext;at:number}|null=null;
  commits:Commit[]=[];
  reviews:{sequence:number;text:string;reason:string}[]=[];
  waiting:{sequence:number;text:string}[]=[];
  sequence=-1;
  version=0;
  corrections:{eventId:string;at:number;before:BpDraft;after:BpDraft}[]=[];
  async receive(text:string,sequence:number,at:number,reason:(text:string,session:TypedVoiceV2)=>Promise<{batch:ReturnType<typeof parseV2Batch>;latencyMs:number}>) {
    if(text.length>2000||this.waiting.length>=64||this.reviews.length>=64)throw new Error('QA capture buffer limit reached');
    if(isVoicePromptEcho(text))return {status:'ignored',route:'prompt-echo-guard',latencyMs:0};
    if(this.reviews.length){this.waiting.push({sequence,text});return {status:'waiting',route:'blocked',latencyMs:0};}
    const began=performance.now(),version=this.version;
    let route='fast';
    try {
      const fast=v2FastPath(text,this.context);
      const batch=fast?{decision:'actions' as const,reason:'Deterministic command',actions:fast}:(route='reasoning',(await reason(text,this)).batch);
      if(batch.decision==='ignore')return {status:'ignored',route,latencyMs:performance.now()-began};
      if(batch.decision==='review')throw new Error(batch.reason);
      const result=this.apply(batch.actions,sequence,at,version);
      return {...result,route,latencyMs:performance.now()-began};
    }catch(error){
      const message=error instanceof Error?error.message:'Interpretation failed';
      this.reviews.push({sequence,text,reason:message});
      return {status:'review',route,latencyMs:performance.now()-began};
    }
  }
  /** Explicit release/context boundary, or bounded idle expiration; never a speech-silence detector. */
  flush(sequence:number,at:number,explicit=false) {
    if(!this.openPlay||(!explicit&&at-this.openPlay.at<30000))return null;
    try{return this.apply([v2Action('complete_play')],sequence,at);}
    catch(error){this.reviews.push({sequence,text:'Developing play',reason:error instanceof Error?error.message:'Invalid play'});return {status:'review'};}
  }
  constructor(context:VoiceContext,qa=false){if(!qa)throw new Error('Voice V2 QA flag disabled');this.context=structuredClone(context);}
  get openPa(){return {...this.context.state,settings:this.context.settings,pitchHistory:this.commits.filter(c=>c.kind==='pitch'&&c.before.state.pa===this.context.state.pa).map(c=>({id:c.id,draft:c.draft}))};}
  apply(actions:V2ToolAction[],sequence:number,at:number,expectedVersion=this.version) {
    if(sequence<=this.sequence||expectedVersion!==this.version||!Number.isFinite(at))throw new Error('Stale capture/version');
    const staged=new TypedVoiceV2(this.context,true);
    staged.openPlay=structuredClone(this.openPlay);staged.commits=structuredClone(this.commits);
    staged.corrections=structuredClone(this.corrections);
    for(const action of actions){validate(action.args,object(fields[action.name]),action.name);staged.execute(action,at,sequence);}
    this.context=staged.context;this.openPlay=staged.openPlay;this.commits=staged.commits.slice(-32);this.sequence=sequence;this.version++;
    this.corrections=staged.corrections.slice(-32);
    return {status:this.openPlay?'provisional':'auto',version:this.version,actions:actions.length};
  }
  private player(id:unknown){if(typeof id!=='string'||!this.context.roster.some(p=>p.id===id))throw new Error('Player is not uniquely identified in active roster');return id;}
  private finish(at:number,sequence:number){
    if(!this.openPlay)throw new Error('No developing play');
    const {draft,context}=this.openPlay;
    const built=buildBpPitch(context.settings,context.state,draft);
    this.commits.push({id:`v2-${sequence}-${this.commits.length}`,at,before:structuredClone(context),draft,kind:'pitch'});
    this.context={...this.context,state:built.stateAfter};this.openPlay=null;
  }
  private execute(action:V2ToolAction,at:number,sequence:number) {
    const a=action.args,s=this.context.settings,state=this.context.state;
    const patch=()=>cleanDraft(a.draft);
    if(action.name.startsWith('set_')||action.name==='start_new_pa'){
      if(this.openPlay)this.finish(at,sequence);
      // Context transitions must use the state resulting from the prior play.
      const settings=this.context.settings,next=this.context.state,before=structuredClone(this.context);
      switch(action.name){
        case 'set_hitter':settings.hitterId=this.player(a.playerId);this.context.playerId=settings.hitterId;next.balls=0;next.strikes=0;next.pa++;break;
        case 'set_pitcher':settings.pitcherId=this.player(a.playerId);settings.source='PLAYER';settings.alignment={...settings.alignment,P:settings.pitcherId};break;
        case 'set_pitch_source':settings.source=a.source as BpSettings['source'];break;
        case 'set_pitch_program':settings.pitchMode=a.mode as BpSettings['pitchMode'];settings.pitchType=a.pitchType as BpSettings['pitchType']??undefined;break;
        case 'set_count':next.balls=Number(a.balls);next.strikes=Number(a.strikes);next.countKnown=true;break;
        case 'set_outs':next.outs=Number(a.outs);next.situationKnown=true;break;
        case 'set_runners':{
          const runners=a.runners as {base:number;playerId:string|null}[];
          if(new Set(runners.map(r=>r.base)).size!==runners.length)throw new Error('Base collision');
          this.context.state={...withBpRunners(next,runners.map(r=>r.base)),situationKnown:true,runnerIds:Object.fromEntries(runners.filter(r=>r.playerId!==null).map(r=>[r.base,this.player(r.playerId)]))};break;
        }
        case 'set_defender':settings.alignment={...settings.alignment,[String(a.position)]:this.player(a.playerId)};break;
        case 'set_situational_job':next.job=String(a.job);break;
        case 'start_new_pa':next.balls=0;next.strikes=0;next.pa++;break;
      }
      validateBpSettings(settings);validateBpState(this.context.state);
      this.commits.push({id:`v2-${sequence}-${this.commits.length}`,at,before,kind:'context'});return;
    }
    switch(action.name){
      case 'record_pitch':
        if(this.openPlay)this.finish(at,sequence);
        this.openPlay={draft:patch() as BpDraft,context:structuredClone(this.context),at};this.finish(at,sequence);break;
      case 'open_play':
        if(this.openPlay)throw new Error('Developing play already exists');
        this.openPlay={draft:{outcome:'Ball in play',...patch()},context:structuredClone(this.context),at};break;
      case 'update_play':
        if(!this.openPlay||at-this.openPlay.at>30000)throw new Error('No compatible open play in window');
        this.openPlay.draft={...this.openPlay.draft,...patch()};break;
      case 'record_runner_action':{
        const move=a as BpRunnerMove;
        if(this.openPlay){
          if(!this.openPlay.context.state.runners.includes(move.from))throw new Error('Runner not on starting base');
          if(!BP_PLAY_RUNNER_REASONS.includes(move.reason as typeof BP_PLAY_RUNNER_REASONS[number]))throw new Error('Runner reason unsupported within this play; Review required');
          this.openPlay.draft.runnerOutcomes={...this.openPlay.draft.runnerOutcomes,[move.from]:move.outcome==='out'?'out':move.to===4?'score':String(move.to)};
          this.openPlay.draft.runnerReasons={...this.openPlay.draft.runnerReasons,[move.from]:move.reason};
        }else{const built=buildBpRunnerMove(s,state,move);this.commits.push({id:`v2-${sequence}-${this.commits.length}`,at,before:structuredClone(this.context),kind:'runner'});this.context.state=built.stateAfter;}break;
      }
      case 'record_defensive_action':{
        const rep=Object.fromEntries(Object.entries(a).filter(([,v])=>v!==null)) as BpDefenseRep;
        buildBpDefenseRep(s,state,rep);
        if(this.openPlay){
          if(this.openPlay.draft.position&&this.openPlay.draft.position!==rep.position)throw new Error('Multiple defensive actors require Review');
          Object.assign(this.openPlay.draft,{position:rep.position,defenseResult:rep.result,errorType:rep.errorType});
        }else this.commits.push({id:`v2-${sequence}-${this.commits.length}`,at,before:structuredClone(this.context),kind:'defense'});
        break;
      }
      case 'complete_play':this.finish(at,sequence);break;
      case 'complete_pa':
        if(this.openPlay)this.finish(at,sequence);
        if(!this.commits.at(-1)?.draft?.result||this.context.state.pa===this.commits.at(-1)?.before.state.pa)throw new Error('Canonical state does not establish PA completion');
        break;
      case 'undo_last_action':
        if(this.openPlay)this.openPlay=null;
        else{const last=this.commits.pop();if(last)this.context=last.before;}break;
      case 'correct_recent_event':{
        const last=this.commits.at(-1);
        if(this.openPlay||!last?.draft||last.id!==a.eventId||at-last.at>30000||at<last.at)throw new Error('Correction must target exact latest compatible event within 30 seconds');
        const corrected={...last.draft,...patch()};const built=buildBpPitch(last.before.settings,last.before.state,corrected);
        this.corrections.push({eventId:last.id,at,before:structuredClone(last.draft),after:structuredClone(corrected)});
        last.draft=corrected;this.context.state=built.stateAfter;break;
      }
    }
  }
}

export function v2FastPath(text:string,context:VoiceContext):V2ToolAction[]|null {
  if(text.includes('?')||/^(?:was|is|did|does|do|can|could|would|should|who|what|why|how)\b/i.test(text.trim())||isVoicePromptEcho(text))return null;
  if(/^(undo|take that back|scratch that)[.!]?$/i.test(text.trim()))return [v2Action('undo_last_action')];
  const command=parseVoiceCommand(text,context.roster,context.settings,context.state);
  if(command){
    if(command.problems.length||command.kind!=='context'||command.eventText)return null;
    if(command.action?.kind==='runner')return [v2Action('record_runner_action',{...command.action.move,outcome:command.action.move.outcome??'safe'})];
    if(command.action?.kind==='defense')return [v2Action('record_defensive_action',{...command.action.rep,errorType:command.action.rep.errorType??null})];
    if(command.action)return null;
    const p=command.patch,st=command.statePatch??{},actions:V2ToolAction[]=[];
    if(Object.keys(p).some(k=>!['hitterId','pitcherId','source','pitchMode','pitchType','alignment'].includes(k))||Object.keys(st).some(k=>!['balls','strikes','outs','runners','runnerIds','countKnown','situationKnown','pa'].includes(k)))return null;
    if(p.hitterId)actions.push(v2Action('set_hitter',{playerId:p.hitterId}));
    if(p.pitcherId)actions.push(v2Action('set_pitcher',{playerId:p.pitcherId}));
    if(p.source)actions.push(v2Action('set_pitch_source',{source:p.source}));
    if(p.pitchMode||p.pitchType)actions.push(v2Action('set_pitch_program',{mode:p.pitchMode??context.settings.pitchMode,pitchType:p.pitchType??context.settings.pitchType??null}));
    if(p.alignment)for(const [position,playerId] of Object.entries(p.alignment))if(playerId&&context.settings.alignment[position as keyof typeof p.alignment]!==playerId)actions.push(v2Action('set_defender',{position,playerId}));
    if(st.pa!==undefined&&!p.hitterId)actions.push(v2Action('start_new_pa'));
    if(st.balls!==undefined||st.strikes!==undefined)actions.push(v2Action('set_count',{balls:st.balls??context.state.balls,strikes:st.strikes??context.state.strikes}));
    if(st.outs!==undefined)actions.push(v2Action('set_outs',{outs:st.outs}));
    if(st.runners)actions.push(v2Action('set_runners',{runners:st.runners.map(base=>({base,playerId:st.runnerIds?.[base]??null}))}));
    return actions.length?actions:null;
  }
  const parsed=interpretVoice(text,context,'v2-fast',1);
  if(parsed.unresolvedFields.length||parsed.ignoredFields.length||parsed.confidence.identity!==1||parsed.draft.battedBall)return null;
  if(!['Ball','Called Strike','Whiff','Foul'].includes(parsed.draft.outcome))return null;
  return [v2Action('record_pitch',{draft:parsed.draft})];
}
