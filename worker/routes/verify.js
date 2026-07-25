import {
  generateCode,
  storePendingCode,
  getPendingCode,
  clearPendingCode,
  checkRateLimit,
  recordFailedAttempt,
  normalizeEmail
} from '../lib/kv.js';
import { sendVerificationEmail } from '../lib/email.js';
import { upsertSubscriber } from '../lib/d1.js';
import { createSessionToken } from '../lib/token.js';
import { jsonResponse } from '../lib/http.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Fixed-length codes, so a simple XOR-accumulate comparison is safe and
// avoids leaking how many leading digits matched via string-compare timing.
function codesMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function handleVerifyStart(request, env) {
  const body = await readJsonBody(request);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_REGEX.test(email)) {
    return jsonResponse({ error: 'Please enter a valid email address.' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(env.VERIFY_CODES, email, ip);
  if (!allowed) {
    return jsonResponse({ error: 'Too many attempts. Please try again later.' }, 429);
  }

  const code = generateCode();
  await storePendingCode(env.VERIFY_CODES, email, code);

  try {
    await sendVerificationEmail({
      apiKey: env.RESEND_API_KEY,
      fromAddress: env.FROM_EMAIL,
      toEmail: email,
      code
    });
  } catch (err) {
    console.error('Failed to send verification email:', err);
    return jsonResponse({ error: 'Could not send verification email. Please try again shortly.' }, 502);
  }

  return jsonResponse({ ok: true });
}

export async function handleVerifyConfirm(request, env) {
  const body = await readJsonBody(request);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!EMAIL_REGEX.test(email) || !code) {
    return jsonResponse({ error: 'Email and code are required.' }, 400);
  }

  const pending = await getPendingCode(env.VERIFY_CODES, email);
  if (!pending) {
    return jsonResponse({ error: 'Invalid or expired code.' }, 401);
  }

  if (!codesMatch(pending.code, code)) {
    const { locked } = await recordFailedAttempt(env.VERIFY_CODES, email, pending);
    return jsonResponse(
      { error: locked ? 'Too many incorrect attempts. Please request a new code.' : 'Invalid or expired code.' },
      401
    );
  }

  const normalized = normalizeEmail(email);
  // Only invalidate the code once everything downstream has actually
  // succeeded -- if D1 or token creation throws, the code stays valid so
  // the same confirm request can just be retried instead of forcing the
  // visitor to request a whole new code.
  await upsertSubscriber(env.DB, normalized);
  const token = await createSessionToken(normalized, env.SESSION_HMAC_SECRET);
  await clearPendingCode(env.VERIFY_CODES, normalized);

  return jsonResponse({ token });
}
