import test from 'node:test';
import assert from 'node:assert/strict';
import {field,body} from '../lib/validation.mjs';
test('required strings and length limits reject invalid mutations',()=>{
  assert.throws(()=>field({},'name',100));
  assert.throws(()=>field(' ','name',100,true));
  assert.throws(()=>field('abcdef','name',3));
  assert.equal(field('  Ray ','name',100,true),'Ray');
});
test('same-origin writes parse while cross-site and malformed writes fail',async()=>{
  const req=(text,headers={})=>new Request('https://career.test/api/stories',{method:'POST',headers,body:text});
  assert.deepEqual(await body(req('{"title":"A story"}',{origin:'https://career.test'})),{title:'A story'});
  await assert.rejects(body(req('{}',{origin:'https://evil.test'})));
  await assert.rejects(body(req('{}',{'sec-fetch-site':'cross-site'})));
  await assert.rejects(body(req('[]')));
  await assert.rejects(body(req('broken')));
  await assert.rejects(body(req('x'.repeat(200001))));
});

