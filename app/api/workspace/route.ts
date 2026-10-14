import { owner, database, reply, routeError, body, field } from '@/lib/server';
import { readWorkspace, saveProfile } from '@/lib/store.mjs';
import { DEFAULT_PROFILE } from '@/lib/career.mjs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { const user = await owner(); return reply(await readWorkspace(database(), user.userId, DEFAULT_PROFILE)); }
  catch (error) { return routeError(error); }
}
export async function PUT(request: Request) {
  try {
    const user = await owner(); const input = await body(request);
    const limits: Record<string, number> = { fullName: 200, headline: 300, location: 200, email: 300,
      links: 1200, targetRoles: 1500, skills: 3000, resumeText: 100000, minSalary: 30, workPreference: 20, excludedCompanies: 3000 };
    const profile: Record<string, string> = {};
    for (const [key, max] of Object.entries(limits)) profile[key] = field(input[key], key, max);
    if (!['any','remote','hybrid','onsite'].includes(profile.workPreference)) throw new Error('VALIDATION:Choose a valid work preference.');
    return reply({ profile: await saveProfile(database(), user.userId, profile) });
  } catch (error) { return routeError(error); }
}
