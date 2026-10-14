/**
 * Resolve dispatch-owned visitor identity.
 * Some authenticated Sites requests carry verified email but omit the visitor ID.
 * This confirmed owner-private Site uses an explicit runtime grant and exact
 * dispatch target to select its private owner workspace. Without that grant,
 * native visitor identity or an exact owner-email match is required. Email is
 * never used as a database key.
 *
 * @param {{get: (name:string) => string|null}} headers
 * @param {{ownerEmail?:string,ownerRecordKey?:string,privateBoundary?:string,dispatchService?:string}} [config]
 */
export function identityFromHeaders(headers, config = {}) {
  const email = headers.get('oai-authenticated-user-email');
  const visitorId = headers.get('oai-authenticated-user-id');
  // A confirmed owner-only Site is a shared private workspace. Sites dispatch
  // authorizes both its owner and scoped service access before invoking this
  // Worker. An explicit runtime grant and exact dispatch target are required;
  // no email or caller-supplied visitor ID is used to impersonate the owner.
  const privateOwnerScope = config.privateBoundary === 'owner-private' &&
    !!config.ownerRecordKey && !!config.dispatchService &&
    headers.get('x-dispatched-app') === config.dispatchService;
  if ((!email || !email.trim()) && !privateOwnerScope) return null;
  const ownerMatches = !!config.ownerEmail && !!config.ownerRecordKey &&
    !!email && email.trim().toLowerCase() === config.ownerEmail.trim().toLowerCase();
  const userId = privateOwnerScope || ownerMatches ? config.ownerRecordKey : visitorId;
  if (!userId) return null;
  const encoded = headers.get('oai-authenticated-user-full-name');
  let fullName = null;
  if (encoded && headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { fullName = decodeURIComponent(encoded); } catch { /* Optional display field. */ }
  }
  return { userId, email: email || '', fullName, displayName:fullName || email || 'Private workspace owner' };
}

