import { verifyAlbumUnlock } from '../lib/albums.js';
import { getVerifiedSession } from '../lib/sessionAuth.js';
import { checkUnlockRateLimit } from '../lib/kv.js';
import { jsonResponse } from '../lib/http.js';

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Requires a verified visitor session (same email gate as everything else
// under /galleries) on top of the passcode itself -- an anonymous caller
// can't even attempt a guess without first going through the email gate.
export async function handleUnlockAlbum(request, env, albumId) {
  const session = await getVerifiedSession(request, env);
  if (!session) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkUnlockRateLimit(env.VERIFY_CODES, albumId, ip);
  if (!allowed) {
    return jsonResponse({ error: 'Too many attempts. Please try again later.' }, 429);
  }

  const body = await readJsonBody(request);
  const code = typeof body?.code === 'string' ? body.code : '';

  const album = await verifyAlbumUnlock(env.DB, albumId, code);
  if (!album) {
    return jsonResponse({ error: 'Invalid code.' }, 401);
  }

  return jsonResponse({ album });
}
