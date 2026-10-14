import { owner, reply, routeError, body, field } from '@/lib/server';
import { postingApi, importedJob } from '@/lib/posting-import.mjs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    await owner(); const input = await body(request); const url = field(input.url,'Job posting URL',2048,true);
    const source = postingApi(url);
    if (!source) return reply({error:'Automatic import supports individual Greenhouse and Lever posting URLs. For this link, enter the company and role, and paste the description below.'},400);
    const response = await fetch(source.api,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'manual'});
    if (!response.ok) return reply({error: response.status===404 ? 'This posting was not found on the board. It may have closed; check the original page or paste the details manually.' : 'The board could not be reached (HTTP '+response.status+'). Paste the details manually.'},400);
    try { return reply({job:importedJob(source,await response.json(),url)}); }
    catch { return reply({error:'The board returned incomplete details. Paste the company, title and description manually.'},400); }
  } catch(error) { return routeError(error); }
}

