import { owner, database, reply, routeError, body, field } from '@/lib/server';
import { saveStory, deleteStory } from '@/lib/store.mjs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const user = await owner(); const input = await body(request);
    const story: Record<string, string> = { id: field(input.id, 'Story ID', 100) || crypto.randomUUID() };
    for (const key of ['title','situation','task','action','result','reflection','tags'])
      story[key] = field(input[key], key, key === 'title' ? 250 : 8000, ['title','action'].includes(key));
    const saved = await saveStory(database(), user.userId, story);
    if (!saved) return reply({ error: 'Story not found.' }, 404);
    return reply({ story: saved });
  } catch (error) { return routeError(error); }
}
export async function DELETE(request: Request) {
  try { const user = await owner(); const input = await body(request);
    await deleteStory(database(), user.userId, field(input.id, 'Story ID', 100, true)); return reply({ ok: true });
  } catch (error) { return routeError(error); }
}
