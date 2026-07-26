// Fixed-length values only, so a simple XOR-accumulate comparison is safe
// and avoids leaking how many leading characters matched via string-compare
// timing. Different-length inputs return false immediately -- an
// acceptable, low-stakes side channel (length isn't the secret part).
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
