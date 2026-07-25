const CODE_TTL_SECONDS = 10 * 60; // 10 minutes
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const MAX_CONFIRM_ATTEMPTS = 5;

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
  await kv.put(key, JSON.stringify({ code, createdAt: Date.now(), attempts: 0 }), { expirationTtl: CODE_TTL_SECONDS });
}

export async function getPendingCode(kv, email) {
  const raw = await kv.get(`code:${normalizeEmail(email)}`);
  return raw ? JSON.parse(raw) : null;
}

export async function clearPendingCode(kv, email) {
  await kv.delete(`code:${normalizeEmail(email)}`);
}

// A 6-digit code is only ~1M possibilities -- with no cap on confirm
// attempts, it's brute-forceable well within its 10-minute TTL. This caps
// guesses per issued code (separate from the per-hour send limiter above,
// which only throttles how often new codes go out). Once exceeded, the
// code is invalidated outright so the visitor has to request a fresh one.
export async function recordFailedAttempt(kv, email, pending) {
  const key = `code:${normalizeEmail(email)}`;
  const attempts = (pending.attempts || 0) + 1;
  if (attempts >= MAX_CONFIRM_ATTEMPTS) {
    await kv.delete(key);
    return { locked: true };
  }
  await kv.put(key, JSON.stringify({ ...pending, attempts }), { expirationTtl: CODE_TTL_SECONDS });
  return { locked: false };
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
