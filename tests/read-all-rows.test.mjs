import test from 'node:test';
import assert from 'node:assert/strict';
import {readAllRows} from '../app/lib/readAllRows.ts';
test('reads beyond the API cap, including a short capped page',async()=>{
  const rows=Array.from({length:1503},(_,i)=>({id:String(i).padStart(6,'0')}));
  const result=await readAllRows(async after=>({data:rows.filter(r=>!after||r.id>after).slice(0,137),error:null}));
  assert.deepEqual(result.data,rows);
});
test('a later page failure never looks like successful partial data',async()=>{
  const result=await readAllRows(async after=>after?{data:null,error:{message:'denied'}}:{data:[{id:'a'}],error:null});
  assert.equal(result.data,null);assert.equal(result.error.message,'denied');
});
test('pagination fails closed when the backend repeats a page',async()=>{
  const result=await readAllRows(async()=>({data:[{id:'a'}],error:null}));
  assert.equal(result.data,null);assert.match(result.error.message,/did not advance/);
});
