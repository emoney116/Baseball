import { buildBpPitch, validateBpSettings, validateBpState, type BpDraft } from './liveBp.ts';
import { interpretVoice, type VoiceContext } from './voiceIntent.ts';
import { parseVoiceCommand } from './voiceCommands.ts';
import { mergeVoiceDetail, voiceFragmentRelation } from './voiceEventAssembler.ts';

export type V2Proposal = {
  sequence: number; at: number; text: string;
  intent: 'scoring' | 'context' | 'correction' | 'coaching' | 'background' | 'question';
  transcription: 'clear' | 'unclear';
  alternatives: string[];
  explicitEnd?: boolean;
};
type Pending = {text:string;at:number;startedAt:number;fragments:number;context:VoiceContext;sequence:number};
export const V2_EXPERIMENTAL_DETAIL_WINDOW_MS=12000;
export type V2Receipt = {sequence:number;status:'auto'|'review'|'ignored'|'provisional'|'waiting'|'undone';reason:string;draft?:BpDraft};

/** Isolated simulation only. No persistence dependency or production import. */
export class VoiceV2Replay {
  context: VoiceContext;
  pending: Pending | null = null;
  receipts: V2Receipt[] = [];
  committed: {sequence:number;at:number;context:VoiceContext;draft:BpDraft;result:ReturnType<typeof buildBpPitch>}[] = [];
  blocked = false;
  lastSequence = -1;
  constructor(context:VoiceContext, enabled=false) {
    if(!enabled) throw new Error('Voice V2 QA flag is disabled');
    this.context=structuredClone(context);
  }
  private receipt(sequence:number,status:V2Receipt['status'],reason:string,draft?:BpDraft) {
    const value={sequence,status,reason,draft};this.receipts.push(value);return value;
  }
  private review(sequence:number,reason:string) {
    this.blocked=true;return this.receipt(sequence,'review',reason);
  }
  private commit(pending:Pending) {
    const parsed=interpretVoice(pending.text,pending.context,`v2-${pending.sequence}`,1);
    if(parsed.unresolvedFields.length || parsed.ignoredFields.length || parsed.confidence.identity!==1)
      return this.review(pending.sequence,[...parsed.unresolvedFields,...parsed.ignoredFields].join('; ')||'Identity is ambiguous');
    try {
      const result=buildBpPitch(pending.context.settings,pending.context.state,parsed.draft);
      this.committed.push({sequence:pending.sequence,at:pending.at,context:structuredClone(pending.context),draft:parsed.draft,result});
      this.context={...this.context,state:result.stateAfter};
      return this.receipt(pending.sequence,'auto','Unique proposal passed canonical validation',parsed.draft);
    } catch(error) {return this.review(pending.sequence,error instanceof Error?error.message:'Invalid transition');}
  }
  flush() {
    if(!this.pending)return;
    const pending=this.pending;this.pending=null;return this.commit(pending);
  }
  tick(now:number) {
    if(this.pending&&(now-this.pending.at>=V2_EXPERIMENTAL_DETAIL_WINDOW_MS||now-this.pending.startedAt>=30000))return this.flush();
  }
  receive(proposal:V2Proposal) {
    if(!Number.isInteger(proposal.sequence)||proposal.sequence<=this.lastSequence||!Number.isFinite(proposal.at))throw new Error('Ordered capture sequence required');
    this.lastSequence=proposal.sequence;
    if(['coaching','background','question'].includes(proposal.intent))return this.receipt(proposal.sequence,'ignored',proposal.intent);
    if(this.blocked)return this.receipt(proposal.sequence,'waiting','Earlier review affects authoritative state; capture is retained');
    if(proposal.transcription!=='clear'||proposal.alternatives.length)return this.review(proposal.sequence,'Unclear speech or materially different interpretations');
    if(/^(undo|take that back|scratch that)[.!]?$/i.test(proposal.text)) {
      if(this.pending){this.pending=null;return this.receipt(proposal.sequence,'undone','Cancelled provisional play');}
      const last=this.committed.pop();
      if(last)this.context=structuredClone(last.context);
      return this.receipt(proposal.sequence,'undone',last?'Reverted latest simulated canonical action':'Nothing to undo');
    }
    if(this.pending) {
      const relation=voiceFragmentRelation(this.pending.text,proposal.text);
      if(relation==='detail' && proposal.at-this.pending.at<=V2_EXPERIMENTAL_DETAIL_WINDOW_MS && proposal.at-this.pending.startedAt<30000 && this.pending.fragments<8) {
        this.pending.text=mergeVoiceDetail(this.pending.text,proposal.text);this.pending.at=proposal.at;this.pending.fragments++;
        return proposal.explicitEnd?this.flush():this.receipt(proposal.sequence,'provisional','Enriched developing play');
      }
      this.flush();
      if(this.blocked)return this.receipt(proposal.sequence,'waiting','Prior play must be resolved before context changes');
      if(relation==='flush')return this.receipt(proposal.sequence,'ignored','Explicit boundary flushed play');
    }
    const command=parseVoiceCommand(proposal.text,this.context.roster,this.context.settings,this.context.state);
    if(command) {
      if(command.problems.length)return this.review(proposal.sequence,command.problems.join('; '));
      if(command.action)return this.review(proposal.sequence,'Standalone action adapter not implemented in this spike');
      if(command.kind==='context') {
        const settings={...this.context.settings,...command.patch};
        const state={...this.context.state,...command.statePatch};
        try {validateBpSettings(settings);validateBpState(state);}catch{return this.review(proposal.sequence,'Invalid context transition');}
        this.context={...this.context,settings,state,playerId:settings.hitterId};
        return this.receipt(proposal.sequence,'auto','Validated context command');
      }
      return this.review(proposal.sequence,'Compound context requires ordered tool proposals');
    }
    const pending={text:proposal.text,at:proposal.at,startedAt:proposal.at,fragments:1,sequence:proposal.sequence,context:structuredClone(this.context)};
    const parsed=interpretVoice(proposal.text,this.context,`v2-${proposal.sequence}`,1);
    if(parsed.draft.battedBall&&!proposal.explicitEnd){this.pending=pending;return this.receipt(proposal.sequence,'provisional','Developing play; not saved');}
    return this.commit(pending);
  }
}
