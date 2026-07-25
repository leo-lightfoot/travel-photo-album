import { verifySessionToken } from '../lib/token.js';
import { jsonResponse } from '../lib/http.js';

export async function handleSessionCheck(request, env) {
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
