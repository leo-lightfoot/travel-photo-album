import { verifySessionToken } from './token.js';

// Extracts the visitor's session token from "Authorization: Bearer <token>"
// and verifies it the same way /api/session/check does. Returns the
// decoded payload ({ email, iat, exp }) or null.
export async function getVerifiedSession(request, env) {
  const header = request.headers.get('Authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return verifySessionToken(token, env.SESSION_HMAC_SECRET);
}
