import {createClient} from '../../../lib/supabase/server';
import {createAdminClient} from '../../../lib/supabase/admin';
import {assertPlayerLinkTeamManager,PlayerLinkError} from '../../../lib/playerAccountLinks';
import {voiceDeploymentEnabled} from '../../../lib/voiceAvailability';
import {OpenAIProvider} from '../../../lib/askClubhouse/provider';
import {VOICE_PROPOSAL_SCHEMA,VOICE_PROPOSAL_INSTRUCTIONS,validateVoiceProposal} from '../../../lib/voiceInterpretationProposal';

export const runtime='nodejs';
export const maxDuration=30;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
  if(!voiceDeploymentEnabled(process.env.VERCEL_ENV,process.env.NODE_ENV,process.env.VOICE_ENABLED))return reply({message:'Voice unavailable.'},503);
  try{
    if(request.headers.get('origin')!==new URL(request.url).origin)return reply({message:'Request unavailable.'},403);
    const {data,error}=await(await createClient()).auth.getUser();
    if(error||!data.user)return reply({message:'Sign in to use Voice.'},401);
    const text=await request.text();if(text.length>3000)return reply({message:'Interpretation request too large.'},413);
    const body=JSON.parse(text);
    if(typeof body.transcript!=='string'||body.transcript.length>700||!body.transcript.trim()||![body.practiceId,body.requestId].every(v=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v)))return reply({message:'Invalid interpretation request.'},400);
    const db=createAdminClient();
    const practice=await db.from('practices').select('id,team_id,status,ended_at,starts_at').eq('id',body.practiceId).maybeSingle();
    if(practice.error||!practice.data)return reply({message:'Practice unavailable.'},404);
    await assertPlayerLinkTeamManager(db,data.user.id,practice.data.team_id);
    if(practice.data.ended_at||practice.data.status!=='active'||Date.parse(practice.data.starts_at)>Date.now())return reply({message:'Practice is not active.'},409);
    // One bounded fallback per successful authorized transcription, not an unrestricted AI endpoint.
    const claim=await db.from('voice_usage').update({interpretation_ms:0}).eq('request_id',body.requestId).eq('actor_id',data.user.id).eq('practice_id',body.practiceId).eq('status','completed').is('interpretation_ms',null).select('request_id').maybeSingle();
    if(claim.error||!claim.data)return reply({message:'Interpretation already requested or transcription unavailable. Use manual review.'},429);
    const provider=new OpenAIProvider({apiKey:process.env.OPENAI_VOICE_API_KEY,model:'gpt-5-mini'});
    const started=Date.now();
    const result=await provider.generate({system:VOICE_PROPOSAL_INSTRUCTIONS,prompt:body.transcript,maxOutputTokens:1800,structured:{name:'voice_language_proposal',schema:VOICE_PROPOSAL_SCHEMA},signal:AbortSignal.timeout(20000)});
    const proposal=validateVoiceProposal(JSON.parse(result.text),body.transcript);
    await db.from('voice_usage').update({interpretation_ms:Math.min(30000,Date.now()-started)}).eq('request_id',body.requestId);
    return reply({...proposal,requiresReview:true});
  }catch(error){return reply({message:error instanceof PlayerLinkError?error.message:'Interpretation unavailable. Transcript retained; manual entry remains available.'},error instanceof PlayerLinkError?error.status:503);}
}
