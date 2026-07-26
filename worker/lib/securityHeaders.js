// Security response headers applied to every response (API + static assets)
// from the Worker's fetch handler. Previously nothing set these.
//
// CSP notes for this specific app:
//  - script-src 'self': the built index.html loads one external module
//    script (/assets/index-*.js) and has NO inline <script>, so scripts can
//    be locked to same-origin -- this is the part that actually blocks
//    injected-script XSS.
//  - style-src 'unsafe-inline': index.html ships an inline <style> block, so
//    inline styles have to be allowed. This is a much weaker concession than
//    allowing inline scripts.
//  - img-src includes the R2 public bucket (photos are served straight from
//    it) and data: for any inline/placeholder images.
// HSTS is intentionally not set here -- enable it once in the Cloudflare
// dashboard (SSL/TLS -> HSTS) rather than from code, since a bad max-age is
// painful to walk back.
function buildCsp(env) {
  const r2 = env?.R2_PUBLIC_BASE_URL || '';
  const imgSrc = ["'self'", 'data:', r2].filter(Boolean).join(' ');
  return [
    "default-src 'self'",
    `img-src ${imgSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
}

export function withSecurityHeaders(response, env) {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', buildCsp(env));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
