export function field(value, name, max, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new Error('VALIDATION:' + name + ' is required.');
    return '';
  }
  if (typeof value !== 'string' || value.length > max) throw new Error('VALIDATION:' + name + ' must be text with at most ' + max + ' characters.');
  const clean = value.trim();
  if (required && !clean) throw new Error('VALIDATION:' + name + ' is required.');
  return clean;
}
export async function body(request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new Error('VALIDATION:Cross-site changes are not allowed.');
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).origin !== new URL(request.url).origin) throw new Error('VALIDATION:Please make changes from this workspace.');
  const raw = await request.text();
  if (raw.length > 200_000) throw new Error('VALIDATION:This request is too large.');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('VALIDATION:Invalid request.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('VALIDATION:Invalid request.');
  return parsed;
}

