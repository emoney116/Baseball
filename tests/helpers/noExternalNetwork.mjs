// Default tests must never consume a shared Supabase/provider quota.
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('External network blocked in automated tests: '+url.hostname);
  return nativeFetch(input,init);
};
