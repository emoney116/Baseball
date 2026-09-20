import {test} from 'node:test';
import assert from 'node:assert/strict';
import './helpers/noExternalNetwork.mjs';
test('default automated fetch cannot reach a shared database or AI provider',()=>{
  for(const url of ['https://fixture.supabase.co/rest/v1/practices','https://api.openai.com/v1/responses'])assert.throws(()=>fetch(url),/External network blocked/);
});
