import { getAlbumsForAdmin, getAlbumsForVisitor, getFeaturedPublicPhotos } from '../lib/albums.js';
import { isAdminRequest } from '../lib/adminAuth.js';
import { getVerifiedSession } from '../lib/sessionAuth.js';
import { jsonResponse } from '../lib/http.js';

// Full album/photo data (including private albums' secretCode and photos)
// requires either Cloudflare Access admin auth or a verified visitor
// session token -- there is no unauthenticated path to this data anymore.
// Even for a verified visitor, private albums come back as a locked teaser
// only (see getAlbumsForVisitor) until /api/albums/:id/unlock succeeds.
export async function handleGetAlbums(request, env) {
  if (isAdminRequest(request, env)) {
    return jsonResponse(await getAlbumsForAdmin(env.DB));
  }

  const session = await getVerifiedSession(request, env);
  if (!session) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  return jsonResponse(await getAlbumsForVisitor(env.DB));
}

// Public, unauthenticated -- only featured public photos, for the landing
// page's "Recent Work" section, which is shown before anyone has gone
// through the email gate.
export async function handleGetFeatured(request, env) {
  const photos = await getFeaturedPublicPhotos(env.DB);
  return jsonResponse({ photos });
}
