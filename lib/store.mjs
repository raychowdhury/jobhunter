// Every private SQL query includes the visitor's stable ID.
export async function readWorkspace(db, userId, defaults) {
  const [profile, apps, stories] = await Promise.all([
    db.prepare('SELECT data FROM profiles WHERE user_id = ?').bind(userId).first(),
    db.prepare('SELECT data FROM applications WHERE user_id = ? ORDER BY updated_at DESC').bind(userId).all(),
    db.prepare('SELECT data FROM stories WHERE user_id = ? ORDER BY updated_at DESC').bind(userId).all(),
  ]);
  return { profile: profile ? { ...defaults, ...JSON.parse(profile.data) } : defaults,
    applications: apps.results.map(r => JSON.parse(r.data)), stories: stories.results.map(r => JSON.parse(r.data)) };
}
export async function saveProfile(db, userId, profile) {
  await db.prepare('INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
    .bind(userId, JSON.stringify(profile), Date.now()).run();
  return profile;
}
export async function saveApplication(db, userId, key, application) {
  const existing = await db.prepare('SELECT data FROM applications WHERE user_id = ? AND job_key = ?').bind(userId, key).first();
  if (existing) return { application: JSON.parse(existing.data), duplicate: true };
  await db.prepare('INSERT INTO applications (id, user_id, job_key, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, job_key) DO NOTHING')
    .bind(application.recordId, userId, key, JSON.stringify(application), Date.now(), Date.now()).run();
  const saved = await db.prepare('SELECT data FROM applications WHERE user_id = ? AND job_key = ?').bind(userId, key).first();
  return { application: JSON.parse(saved.data), duplicate: JSON.parse(saved.data).recordId !== application.recordId };
}
export async function updateApplication(db, userId, id, changes) {
  const row = await db.prepare('SELECT data FROM applications WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!row) return null;
  const current = JSON.parse(row.data);
  const now = new Date().toISOString();
  const next = { ...current, ...changes, updatedAt: now };
  if (changes.stage === 'applied' && !current.appliedAt) next.appliedAt = now;
  await db.prepare('UPDATE applications SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(JSON.stringify(next), Date.now(), id, userId).run();
  return next;
}
export async function deleteApplication(db, userId, id) {
  return db.prepare('DELETE FROM applications WHERE id = ? AND user_id = ?').bind(id, userId).run();
}
export async function saveStory(db, userId, story) {
  const existing = await db.prepare('SELECT user_id FROM stories WHERE id = ?').bind(story.id).first();
  if (existing && existing.user_id !== userId) return null;
  await db.prepare('INSERT INTO stories (id, user_id, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at WHERE stories.user_id = excluded.user_id')
    .bind(story.id, userId, JSON.stringify(story), Date.now()).run();
  return story;
}
export async function deleteStory(db, userId, id) {
  return db.prepare('DELETE FROM stories WHERE id = ? AND user_id = ?').bind(id, userId).run();
}
