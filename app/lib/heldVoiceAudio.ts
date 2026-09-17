import { VOICE_MAX_SECONDS } from './voiceAudio.ts';

/** Silence is data in a held rep. Only release/cancel/cap closes this buffer. */
export class HeldVoiceAudio {
  private chunks:Float32Array[]=[];
  private count=0;
  private closed=false;
  readonly sampleRate:number;
  constructor(sampleRate:number) {
    if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('Unsupported microphone sample rate.');
    this.sampleRate=sampleRate;
  }
  get seconds(){return this.count/this.sampleRate;}
  get atLimit(){return this.count>=this.sampleRate*VOICE_MAX_SECONDS;}
  append(samples:Float32Array) {
    if(this.closed)throw new Error('Rep capture has ended.');
    const chunk=samples.slice(0,Math.max(0,Math.floor(this.sampleRate*VOICE_MAX_SECONDS)-this.count));
    if(chunk.length){this.chunks.push(chunk);this.count+=chunk.length;}
    return this.atLimit;
  }
  finish(cancel=false) {
    if(this.closed)return null;
    this.closed=true;
    const result=cancel?null:new Float32Array(this.count);
    if(result){let offset=0;for(const chunk of this.chunks){result.set(chunk,offset);offset+=chunk.length;}}
    this.chunks=[];return result;
  }
}
