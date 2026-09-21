import {TypedVoiceV2} from '../../../lib/voiceV2Tools';
import {reasonVoiceV2} from '../../../lib/voiceV2Reasoning';
import {validateBpSettings,validateBpState} from '../../../lib/liveBp';

/** Local simulation only. This route has no persistence adapter. */
export async function POST(request:Request) {
  const url=new URL(request.url);
  let origin:URL;
  try{origin=new URL(request.headers.get('origin')??'');}catch{return new Response(null,{status:404});}
  const loopback=(host:string)=>['localhost','127.0.0.1'].includes(host);
  if(process.env.NODE_ENV!=='development'||process.env.CLUBHOUSE_VOICE_V2_QA!=='true'||!loopback(url.hostname)||!loopback(origin.hostname)||origin.host!==request.headers.get('host')||origin.port!==url.port)return new Response(null,{status:404});
  try {
    const raw=await request.text();
    if(raw.length>60000)return new Response(null,{status:413});
    const body=JSON.parse(raw);
    if(typeof body.text!=='string'||body.text.length>2000||!Array.isArray(body.context?.roster)||body.context.roster.length>60)throw new Error('Invalid bounded QA context');
    validateBpSettings(body.context.settings);validateBpState(body.context.state);
    const session=new TypedVoiceV2(body.context,true);
    // These are simulation snapshots, never authority for a database write.
    session.openPlay=body.openPlay??null;
    session.commits=Array.isArray(body.commits)?body.commits.slice(-3):[];
    return Response.json(await reasonVoiceV2(body.text,session,process.env.OPENAI_VOICE_API_KEY??process.env.OPENAI_API_KEY??'',request.signal));
  }catch{return Response.json({error:'QA interpretation unavailable; transcript retained for Review.'},{status:422});}
}
