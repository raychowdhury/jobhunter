import test from 'node:test';
import assert from 'node:assert/strict';
import { identityFromHeaders } from '../lib/identity.mjs';
const config={ownerEmail:'owner@example.test',ownerRecordKey:'private-owner-scope'};
test('observed authenticated owner email without ID resolves instead of redirecting',()=>{
  const headers=new Headers({'oai-authenticated-user-email':'owner@example.test'});
  assert.equal(identityFromHeaders(headers,config).userId,'private-owner-scope');
});
test('owner has one stable record scope across requests with and without visitor IDs',()=>{
  const without=new Headers({'oai-authenticated-user-email':'owner@example.test'});
  const withId=new Headers({'oai-authenticated-user-email':'owner@example.test','oai-authenticated-user-id':'visitor-site-id'});
  assert.equal(identityFromHeaders(without,config).userId,identityFromHeaders(withId,config).userId);
});
test('missing identity or unrecognized email cannot select the private owner scope',()=>{
  assert.equal(identityFromHeaders(new Headers(),config),null);
  assert.equal(identityFromHeaders(new Headers({'oai-authenticated-user-email':'other@example.test'}),config),null);
  assert.equal(identityFromHeaders(new Headers({'oai-authenticated-user-id':'visitor-site-id'}),config),null);
  assert.equal(identityFromHeaders(new Headers({'oai-authenticated-user-email':'owner@example.test'}),{}),null);
});
test('a different native visitor remains isolated and cannot become the owner',()=>{
  const headers=new Headers({'oai-authenticated-user-email':'other@example.test','oai-authenticated-user-id':'other-visitor'});
  assert.equal(identityFromHeaders(headers,config).userId,'other-visitor');
  assert.notEqual(identityFromHeaders(headers,config).userId,config.ownerRecordKey);
});
test('display-name decoding cannot break otherwise valid identity',()=>{
  const headers=new Headers({'oai-authenticated-user-email':'owner@example.test',
    'oai-authenticated-user-full-name':'Ray%20Chowdhury','oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'});
  assert.equal(identityFromHeaders(headers,config).fullName,'Ray Chowdhury');
  headers.set('oai-authenticated-user-full-name','%broken');
  assert.equal(identityFromHeaders(headers,config).fullName,null);
});

