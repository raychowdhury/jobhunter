import { postingUrl } from '../vendor/career-ops/posting-url.mjs';
import { htmlToText, DESCRIPTION_CAP } from '../vendor/career-ops/_html-to-text.mjs';
import { BOARDS } from './career.mjs';
const GH_HOSTS = new Set(['boards.greenhouse.io','boards.eu.greenhouse.io','job-boards.greenhouse.io','job-boards.eu.greenhouse.io']);
export function postingApi(raw) {
  const safe = postingUrl(raw);
  if (!safe) return null;
  const u = new URL(safe);
  if (u.protocol !== 'https:' || (u.port && u.port !== '443')) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  if (GH_HOSTS.has(u.hostname)) {
    const board = parts[0] === 'embed' ? u.searchParams.get('for') : parts[0];
    const id = parts[0] === 'embed' ? u.searchParams.get('token') : parts.at(-1);
    if (!board || !/^[a-zA-Z0-9_-]{1,100}$/.test(board) || !/^\d+$/.test(id || '')) return null;
    return { provider:'Greenhouse', board, id, api:'https://boards-api.greenhouse.io/v1/boards/' + board + '/jobs/' + id };
  }
  if (u.hostname === 'jobs.lever.co' || u.hostname === 'jobs.eu.lever.co') {
    const [board,id] = parts;
    if (!board || !/^[a-zA-Z0-9_-]{1,100}$/.test(board) || !/^[a-fA-F0-9-]{30,40}$/.test(id || '')) return null;
    return { provider:'Lever', board, id, api:'https://api.' + (u.hostname.includes('.eu.') ? 'eu.' : '') + 'lever.co/v0/postings/' + board + '/' + id + '?mode=json' };
  }
  return null;
}
export function importedJob(source, payload, originalUrl) {
  if (!payload || typeof payload !== 'object') throw new Error('Posting returned an unsupported response.');
  if (String(payload.id) !== String(source.id)) throw new Error('Posting identity could not be confirmed.');
  const board = BOARDS.find(b => b.id === source.board);
  const company = board?.name || source.board;
  let title, location, rawText, url;
  if (source.provider === 'Greenhouse') {
    title = payload.title;
    location = [payload.location?.name, ...(Array.isArray(payload.offices) ? payload.offices.map(o => o?.name) : [])].filter(Boolean).join(' · ');
    rawText = htmlToText(payload.content);
    url = payload.absolute_url;
  } else {
    title = payload.text;
    location = [...new Set([payload.categories?.location, ...(Array.isArray(payload.categories?.allLocations) ? payload.categories.allLocations : [])].filter(v => typeof v === 'string' && v.trim()))].join('; ');
    // Same intro/lists/additional normalization as upstream providers/lever.mjs.
    rawText = [payload.descriptionPlain || htmlToText(payload.description),
      ...(Array.isArray(payload.lists) ? payload.lists.map(l => [l?.text, htmlToText(l?.content)].filter(Boolean).join('\n')) : []),
      payload.additionalPlain || htmlToText(payload.additional)].filter(Boolean).join('\n\n');
    url = payload.hostedUrl;
  }
  if (typeof title !== 'string' || !title.trim()) throw new Error('The posting has no usable title.');
  return { id:source.board+'-'+source.id, title:title.slice(0,500), company,
    location:String(location || 'Location not specified').slice(0,500), url:postingUrl(url) || originalUrl,
    description:rawText.slice(0,80000), source:source.provider, board:source.board,
    checkedAt:new Date().toISOString(), updatedAt:String(payload.updated_at || ''), salary:'',
    descriptionTruncated: source.provider === 'Greenhouse' ? rawText.length >= DESCRIPTION_CAP : rawText.length >= 80000 };
}

