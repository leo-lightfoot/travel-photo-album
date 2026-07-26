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
import { timingSafeEqual } from '../lib/timingSafe.js';

// Stricter than the old /^[^\s@]+@[^\s@]+\.[^\s@]+$/ -- that allowed commas
// and other odd characters in the local/domain parts. This sticks to the
// characters real addresses actually use and requires a >=2-letter TLD.
// Deliberately not trying to be RFC-5322 complete (that regex is monstrous
// and rejecting a few exotic-but-valid addresses is an acceptable trade for
// rejecting obvious junk).
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleVerifyStart(request, env) {
  const body = await readJsonBody(request);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!isValidEmail(email)) {
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
  if (!isValidEmail(email) || !code) {
    return jsonResponse({ error: 'Email and code are required.' }, 400);
  }

  const pending = await getPendingCode(env.VERIFY_CODES, email);
  if (!pending) {
    return jsonResponse({ error: 'Invalid or expired code.' }, 401);
  }

  if (!timingSafeEqual(pending.code, code)) {
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
