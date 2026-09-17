export type PracticeActionTicket = { sequence:number; capturedAt:number; context:unknown };
type Slot = { ticket:PracticeActionTicket; run?:()=>Promise<unknown>; resolve?:(value:unknown)=>void; reject?:(reason:unknown)=>void };

/** Reserve order when input begins, not when a provider/network response finishes. */
export class PracticeActionQueue {
  private slots: Slot[] = [];
  private sequence = 0;
  private running = false;
  private listeners = new Set<()=>void>();
  get pending() { return this.slots.length; }
  subscribe(listener:()=>void) { this.listeners.add(listener); return ()=>{this.listeners.delete(listener);}; }
  private notify() { for(const listener of this.listeners) listener(); }
  reserve(context:unknown): PracticeActionTicket {
    if(this.slots.length >= 32) throw new Error('32 actions pending. Resolve Voice review before capturing more.');
    const ticket={sequence:++this.sequence,capturedAt:Date.now(),context:structuredClone(context)};
    this.slots.push({ticket}); this.notify(); return ticket;
  }
  execute<T>(ticket:PracticeActionTicket,run:()=>Promise<T>):Promise<T> {
    const slot=this.slots.find(s=>s.ticket===ticket);
    if(!slot || slot.run) return Promise.reject(new Error('Action is no longer pending.'));
    return new Promise<T>((resolve,reject)=>{
      slot.run=run;slot.resolve=value=>resolve(value as T);slot.reject=reject;
      void this.drain();
    });
  }
  enqueue<T>(context:unknown,run:()=>Promise<T>) { return this.execute(this.reserve(context),run); }
  discard(ticket:PracticeActionTicket) {
    const slot=this.slots.find(s=>s.ticket===ticket);
    if(slot && !slot.run) void this.execute(ticket,async()=>undefined);
  }
  private async drain() {
    if(this.running) return;
    this.running=true;
    try {
      while(this.slots[0]?.run) {
        const slot=this.slots[0];
        try { slot.resolve?.(await slot.run!()); } catch(error) { slot.reject?.(error); }
        this.slots.shift();this.notify();
      }
    } finally { this.running=false; }
  }
}

const queues=new Map<string,PracticeActionQueue>();
export function practiceActionQueue(practiceId:string) {
  let queue=queues.get(practiceId);
  if(!queue){queue=new PracticeActionQueue();queues.set(practiceId,queue);}
  return queue;
}

/** Apply only the user's edited fields, preserving earlier queued state transitions. */
export function rebasePracticeEdit<T extends object>(base:T, edited:T, current:T):T {
  const result={...current};
  for(const key of new Set([...Object.keys(base),...Object.keys(edited)]) as Set<keyof T>) {
    if(JSON.stringify(base[key])!==JSON.stringify(edited[key])) result[key]=edited[key];
  }
  return result;
}
