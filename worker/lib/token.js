const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SESSION_TTL_SECONDS = 60 * 24 * 60 * 60; // ~60 days

function base64UrlEncode(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// Token = base64url(payload) + "." + base64url(HMAC-SHA256(payload, secret)).
// The client can carry this but can never mint or alter it -- the secret
// never leaves the Worker, and verify() below never re-derives trust from
// the payload alone without checking the signature first.
export async function createSessionToken(email, secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ email, iat: now, exp: now + SESSION_TTL_SECONDS });
  const payloadB64 = base64UrlEncode(encoder.encode(payload));
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${payloadB64}.${sigB64}`;
}

// Returns the decoded payload ({ email, iat, exp }) if the signature is
// valid and it hasn't expired, otherwise null.
export async function verifySessionToken(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return null;

  let signatureBytes;
  try {
    signatureBytes = base64UrlDecode(sigB64);
  } catch {
    return null;
  }

  const key = await getHmacKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(payloadB64));
  if (!valid) return null;

  let payload;
  try {
    payload = JSON.parse(decoder.decode(base64UrlDecode(payloadB64)));
  } catch {
    return null;
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
