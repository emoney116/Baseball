type ReadError = {message: string; code?: string};
type Page<T> = {data:T[] | null; error:ReadError | null};

/** Keyset paging avoids the API row cap and never returns a successful partial load. */
export async function readAllRows<T extends {id:string}>(fetchPage:(after?:string)=>PromiseLike<Page<T>>):Promise<Page<T>> {
  const rows:T[]=[];
  let after:string | undefined;
  for (;;) {
    const page=await fetchPage(after);
    if(page.error)return {data:null,error:page.error};
    if(!page.data?.length)return {data:rows,error:null};
    const next=page.data[page.data.length-1].id;
    if(!next || (after && next<=after))return {data:null,error:{message:'Practice data pagination did not advance.'}};
    rows.push(...page.data);
    after=next;
  }
}
