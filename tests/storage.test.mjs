import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { readWorkspace,saveProfile,saveApplication,updateApplication,deleteApplication,saveStory,deleteStory } from '../lib/store.mjs';
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../drizzle/0000_wild_mongu.sql',import.meta.url),'utf8'));
const db={prepare(sql){return {bind(...values){return {
  async first(){return sqlite.prepare(sql).get(...values)||null;},
  async all(){return {results:sqlite.prepare(sql).all(...values)};},
  async run(){return sqlite.prepare(sql).run(...values);},
};}};}};
test('profiles and applications persist and cannot be read by a different account',async()=>{
  await saveProfile(db,'alice',{fullName:'Alice',resumeText:'Private resume'});
  const app={recordId:'alice-job',title:'Engineer',company:'Example',stage:'saved',appliedAt:''};
  const result=await saveApplication(db,'alice','job-key',app);
  assert.equal(result.duplicate,false);
  const alice=await readWorkspace(db,'alice',{fullName:'Default'});
  assert.equal(alice.profile.resumeText,'Private resume');
  assert.equal(alice.applications.length,1);
  const bob=await readWorkspace(db,'bob',{fullName:'Default'});
  assert.equal(bob.applications.length,0);
  assert.equal(bob.profile.resumeText,undefined);
});
test('duplicate job save keeps its original notes and identity',async()=>{
  await updateApplication(db,'alice','alice-job',{notes:'Keep this note'});
  const result=await saveApplication(db,'alice','job-key',{recordId:'different-id',stage:'saved'});
  assert.equal(result.duplicate,true);
  assert.equal(result.application.recordId,'alice-job');
  assert.equal(result.application.notes,'Keep this note');
  await saveApplication(db,'bob','job-key',{recordId:'bob-job',title:'Engineer'});
  assert.equal((await readWorkspace(db,'bob',{})).applications.length,1);
});
test('cross-account update and delete cannot mutate another account application',async()=>{
  assert.equal(await updateApplication(db,'bob','alice-job',{notes:'Tampered'}),null);
  await deleteApplication(db,'bob','alice-job');
  const alice=await readWorkspace(db,'alice',{});
  assert.equal(alice.applications[0].notes,'Keep this note');
});
test('first applied timestamp survives subsequent stage changes',async()=>{
  const applied=await updateApplication(db,'alice','alice-job',{stage:'applied'});
  assert.ok(applied.appliedAt);
  const moved=await updateApplication(db,'alice','alice-job',{stage:'interview'});
  assert.equal(moved.appliedAt,applied.appliedAt);
});
test('story ownership is enforced for insert collisions, updates and deletes',async()=>{
  await saveStory(db,'alice',{id:'story-a',title:'Private story',action:'Actual action'});
  assert.equal(await saveStory(db,'bob',{id:'story-a',title:'Tampered'}),null);
  await deleteStory(db,'bob','story-a');
  assert.equal((await readWorkspace(db,'alice',{})).stories[0].title,'Private story');
  assert.equal((await readWorkspace(db,'bob',{})).stories.length,0);
  await saveStory(db,'alice',{id:'story-a',title:'Edited story',action:'Actual action'});
  assert.equal((await readWorkspace(db,'alice',{})).stories[0].title,'Edited story');
});

