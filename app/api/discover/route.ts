import { owner, database, reply, routeError } from '@/lib/server';
import { BOARDS, TECH_ROLE_RE } from '@/lib/career.mjs';
import { htmlToText, DESCRIPTION_CAP } from '@/vendor/career-ops/_html-to-text.mjs';
import { postingUrl } from '@/vendor/career-ops/posting-url.mjs';
import type { Job, Diagnostic } from '@/lib/types';
export const dynamic = 'force-dynamic';
async function readBoard(board: typeof BOARDS[number]): Promise<{ jobs: Job[]; diagnostic: Diagnostic }> {
  const db = database();
  const cached = await db.prepare('SELECT data, fetched_at FROM board_cache WHERE board = ?').bind(board.id).first<{ data: string; fetched_at: number }>();
  if (cached && Date.now() - cached.fetched_at < 30 * 60 * 1000) {
    const data = JSON.parse(cached.data);
    return { ...data, diagnostic: { ...data.diagnostic, cached: true } };
  }
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch('https://boards-api.greenhouse.io/v1/boards/' + board.id + '/jobs?content=true', {
      signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' }, redirect: 'manual',
    });
    if (!response.ok) throw new Error('Board returned HTTP ' + response.status);
    const payload = await response.json() as { jobs?: Record<string, any>[] };
    if (!Array.isArray(payload.jobs)) throw new Error('Board returned an unsupported response');
    const relevant = payload.jobs.filter(j => typeof j.title === 'string' && TECH_ROLE_RE.test(j.title))
      .sort((a,b) => Number(/front.?end|full.?stack/i.test(b.title)) - Number(/front.?end|full.?stack/i.test(a.title)));
    const jobs: Job[] = relevant.slice(0, 100).map(j => ({
      id: board.id + '-' + String(j.id), title: String(j.title).slice(0,500), company: board.name,
      location: String(j.location?.name || 'Location not specified').slice(0,500), url: postingUrl(j.absolute_url) || '',
      description: htmlToText(j.content), source: 'Greenhouse', board: board.id, checkedAt,
      updatedAt: String(j.updated_at || ''), salary: '',
      descriptionTruncated: htmlToText(j.content).length >= DESCRIPTION_CAP,
    })).filter(j => !!j.url);
    const diagnostic: Diagnostic = { board: board.id, company: board.name, status: 'ok', total: payload.jobs.length,
      included: jobs.length, checkedAt, cached: false,
      message: relevant.length > 100 ? 'Showing 100 of ' + relevant.length + ' matching roles; frontend roles prioritized.' : jobs.length + ' engineering, product & data roles returned.' };
    const data = { jobs, diagnostic };
    await db.prepare('INSERT INTO board_cache (board, data, fetched_at) VALUES (?, ?, ?) ON CONFLICT(board) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at')
      .bind(board.id, JSON.stringify(data), Date.now()).run();
    return data;
  } catch (error) {
    if (cached) {
      const data = JSON.parse(cached.data);
      return { ...data, diagnostic: { ...data.diagnostic, status: 'stale', cached: true, message: 'Refresh failed. Showing older results; open each posting to confirm availability.' } };
    }
    return { jobs: [], diagnostic: { board: board.id, company: board.name, status: 'error', total: 0, included: 0,
      checkedAt, cached: false, message: error instanceof Error ? error.message : 'Board unavailable' } };
  }
}
export async function GET(request: Request) {
  try {
    await owner();
    const company = new URL(request.url).searchParams.get('company');
    const boards = company ? BOARDS.filter(b => b.id === company) : BOARDS;
    if (!boards.length) return reply({ error: 'Choose one of the supported company boards.' }, 400);
    const results = [];
    for (let i = 0; i < boards.length; i += 3) results.push(...await Promise.all(boards.slice(i, i + 3).map(readBoard)));
    return reply({ jobs: results.flatMap(r => r.jobs), diagnostics: results.map(r => r.diagnostic),
      scope: '10 selected company boards. Up to 100 engineering, product and data roles per board. Results cached for 30 minutes. Posting summaries may be truncated; confirm complete requirements on the employer site.' });
  } catch (error) { return routeError(error); }
}
