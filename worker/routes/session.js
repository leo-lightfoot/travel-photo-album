import { verifySessionToken } from '../lib/token.js';
import { checkSessionCheckRateLimit } from '../lib/kv.js';
import { jsonResponse } from '../lib/http.js';

export async function handleSessionCheck(request, env) {
  // Previously the one unthrottled endpoint. Per-IP limited now like the
  // rest -- rejected with 429 (not 401), and the client deliberately keeps
  // its token on a 429 so a real visitor tripping the limit isn't logged
  // out. NOTE: this bounds abuse but does not by itself protect the Workers
  // request quota, since a request is already counted once it reaches the
  // Worker -- a Cloudflare edge rate-limiting rule is the real DoS guard.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkSessionCheckRateLimit(env.VERIFY_CODES, ip);
  if (!allowed) {
    return jsonResponse({ error: 'Too many requests. Please try again later.' }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ valid: false }, 400);
  }

  const token = typeof body?.token === 'string' ? body.token : '';
  const payload = await verifySessionToken(token, env.SESSION_HMAC_SECRET);

  if (!payload) {
    return jsonResponse({ valid: false }, 401);
  }

  return jsonResponse({ valid: true, email: payload.email });
}
