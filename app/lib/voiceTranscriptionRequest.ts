type TranscriptionResult = { transcript:string; confidence:number|null };
type Dependencies = { request:()=>Promise<Response>; wait:(ms:number)=>Promise<void>; renewRequest:()=>void };

/** Retry only explicit rate rejection; uncertain network failures remain reviewable. */
export async function requestVoiceTranscription({request,wait,renewRequest}:Dependencies):Promise<TranscriptionResult> {
  for(let attempt=0;attempt<3;attempt++) {
    const response=await request();
    if(response.status===429 && attempt<2) {
      await wait(1000*2**attempt);
      renewRequest();
      continue;
    }
    const result=await response.json();
    if(!response.ok)throw new Error(result.message||'Transcription failed. Audio retained; retry or discard.');
    if(typeof result.transcript!=='string'||!result.transcript.trim())throw new Error('No speech was returned. Audio retained; retry or discard.');
    return {transcript:result.transcript,confidence:typeof result.confidence==='number'?result.confidence:null};
  }
  throw new Error('Voice rate limited. Audio retained; retry or discard.');
}
