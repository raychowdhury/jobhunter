import test from 'node:test';
import assert from 'node:assert/strict';
import {identityFromHeaders} from '../lib/identity.mjs';
const config={ownerRecordKey:'confirmed-private-owner',privateBoundary:'owner-private',dispatchService:'confirmed-site-service'};
test('authorized private dispatch with an email alias uses the stable owner scope',()=>{
 const headers=new Headers({'x-dispatched-app':'confirmed-site-service','oai-authenticated-user-email':'render-alias@example.test'});
 assert.equal(identityFromHeaders(headers,config).userId,'confirmed-private-owner');
});
test('scoped service access can read the owner-only workspace without fabricating user headers',()=>{
 const headers=new Headers({'x-dispatched-app':'confirmed-site-service'});
 assert.equal(identityFromHeaders(headers,config).userId,'confirmed-private-owner');
});
test('missing grant or different dispatch target cannot access private owner records',()=>{
 const headers=new Headers({'x-dispatched-app':'different-service','oai-authenticated-user-email':'other@example.test'});
 assert.equal(identityFromHeaders(headers,config),null);
 headers.set('x-dispatched-app','confirmed-site-service');
 assert.equal(identityFromHeaders(headers,{...config,privateBoundary:undefined}),null);
 assert.equal(identityFromHeaders(new Headers(),config),null);
});

