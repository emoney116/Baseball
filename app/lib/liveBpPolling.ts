export function startLiveBpPolling(read:(signal:AbortSignal)=>Promise<void>, host:{
  visible:()=>boolean;
  interval:(fn:()=>void,ms:number)=>()=>void;
  focus:(fn:()=>void)=>()=>void;
}) {
  const controller=new AbortController();
  let reading=false;
  const refresh=async()=>{
    if(reading||controller.signal.aborted||!host.visible())return;
    reading=true;
    try{await read(controller.signal);}catch{/* A later poll retries; manual capture remains available. */}
    finally{reading=false;}
  };
  const tick=()=>{void refresh();};
  const stopTimer=host.interval(tick,5000),stopFocus=host.focus(tick);
  return()=>{controller.abort();stopTimer();stopFocus();};
}
