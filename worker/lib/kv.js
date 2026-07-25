const CODE_TTL_SECONDS = 10 * 60; // 10 minutes
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour
const RATE_LIMIT_MAX_ATTEMPTS = 5;

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function generateCode() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 1000000).toString().padStart(6, '0');
}

export async function storePendingCode(kv, email, code) {
  const key = `code:${normalizeEmail(email)}`;
  await kv.put(key, JSON.stringify({ code, createdAt: Date.now() }), { expirationTtl: CODE_TTL_SECONDS });
}

export async function getPendingCode(kv, email) {
  const raw = await kv.get(`code:${normalizeEmail(email)}`);
  return raw ? JSON.parse(raw) : null;
}

export async function clearPendingCode(kv, email) {
  await kv.delete(`code:${normalizeEmail(email)}`);
}

// Best-effort fixed-window limiter, not atomic (KV has no compare-and-swap).
// A handful of requests racing at the exact same instant could squeak past
// the cap by one or two -- acceptable here since this exists to protect the
// Resend 100/day quota from abuse, not as a hard security boundary.
async function checkAndIncrement(kv, key) {
  const now = Date.now();
  const raw = await kv.get(key);
  let windowStart = now;
  let count = 0;

  if (raw) {
    const parsed = JSON.parse(raw);
    if (now - parsed.windowStart < RATE_LIMIT_WINDOW_SECONDS * 1000) {
      windowStart = parsed.windowStart;
      count = parsed.count;
    }
  }

  if (count >= RATE_LIMIT_MAX_ATTEMPTS) return false;

  await kv.put(key, JSON.stringify({ windowStart, count: count + 1 }), {
    expirationTtl: RATE_LIMIT_WINDOW_SECONDS * 2
  });
  return true;
}

export async function checkRateLimit(kv, email, ip) {
  const emailOk = await checkAndIncrement(kv, `ratelimit:email:${normalizeEmail(email)}`);
  if (!emailOk) return false;
  return checkAndIncrement(kv, `ratelimit:ip:${ip}`);
}
