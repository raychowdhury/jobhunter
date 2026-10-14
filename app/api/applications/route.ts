import { owner, database, reply, routeError, body, field } from '@/lib/server';
import { saveApplication, updateApplication, deleteApplication } from '@/lib/store.mjs';
import { canonicalJobKey, STAGES, CHECKLIST } from '@/lib/career.mjs';
import { postingUrl } from '@/vendor/career-ops/posting-url.mjs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const user = await owner(); const input = await body(request);
    const now = new Date().toISOString();
    const job = {
      id: field(input.id, 'Job ID', 300) || crypto.randomUUID(),
      title: field(input.title, 'Role', 500, true), company: field(input.company, 'Company', 300, true),
      location: field(input.location, 'Location', 500), url: field(input.url, 'Posting URL', 2048),
      description: field(input.description, 'Job description', 80000), source: field(input.source, 'Source', 100) || 'Added by you',
      board: field(input.board, 'Board', 150), checkedAt: field(input.checkedAt, 'Checked at', 50),
      updatedAt: now, salary: field(input.salary, 'Salary', 300), descriptionTruncated: input.descriptionTruncated === true,
    };
    if (job.url && !postingUrl(job.url)) throw new Error('VALIDATION:Use a complete http or https job URL without credentials.');
    const application = { ...job, recordId: crypto.randomUUID(), stage: 'saved', notes: '', dueDate: '',
      createdAt: now, appliedAt: '', checklist: [], coverLetter: '', resumeDraft: '' };
    return reply(await saveApplication(database(), user.userId, canonicalJobKey(job), application), 201);
  } catch (error) { return routeError(error); }
}
export async function PATCH(request: Request) {
  try {
    const user = await owner(); const input = await body(request); const id = field(input.recordId, 'Record ID', 100, true);
    const changes: Record<string, unknown> = {};
    const limits: Record<string, number> = { notes: 30000, dueDate: 10, coverLetter: 50000, resumeDraft: 100000, description: 80000 };
    for (const [key, max] of Object.entries(limits)) if (key in input) changes[key] = field(input[key], key, max);
    if ('description' in changes) changes.descriptionTruncated = false;
    if (changes.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(String(changes.dueDate)) || !Number.isFinite(Date.parse(String(changes.dueDate))))) throw new Error('VALIDATION:Choose a valid follow-up date.');
    if ('stage' in input) {
      if (!STAGES.some(s => s.id === input.stage)) throw new Error('VALIDATION:Choose a valid application stage.');
      changes.stage = input.stage;
    }
    if ('checklist' in input) {
      if (!Array.isArray(input.checklist) || !input.checklist.every((x: unknown) => typeof x === 'string' && CHECKLIST.includes(x))) throw new Error('VALIDATION:Invalid checklist.');
      changes.checklist = [...new Set(input.checklist)];
    }
    const application = await updateApplication(database(), user.userId, id, changes);
    if (!application) return reply({ error: 'Application not found.' }, 404);
    return reply({ application });
  } catch (error) { return routeError(error); }
}
export async function DELETE(request: Request) {
  try { const user = await owner(); const input = await body(request);
    await deleteApplication(database(), user.userId, field(input.recordId, 'Record ID', 100, true)); return reply({ ok: true });
  } catch (error) { return routeError(error); }
}
