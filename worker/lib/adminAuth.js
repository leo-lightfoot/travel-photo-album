// Admin routes are protected at the edge by Cloudflare Access (Zero Trust),
// not by any password/token logic in this app -- Access is configured in the
// Cloudflare dashboard to sit in front of /admin and /api/admin/* on the
// custom domain, and only forwards a request here once the visitor has
// authenticated. Access adds the authenticated email header to every request
// it forwards.
//
// This check is a second line of defense, not the primary gate: it only
// holds up as long as (a) Access policies actually cover every /api/admin/*
// path, and (b) the workers.dev subdomain stays disabled (see
// wrangler.jsonc's `workers_dev: false`) -- otherwise the Worker is directly
// reachable and this header is just something any caller can set themselves.
//
// On top of "is this an authenticated Access user", we also require the
// email to be on the ADMIN_EMAILS allowlist. This is deliberately
// FAIL-CLOSED: if ADMIN_EMAILS is unset or blank, nobody is treated as
// admin. That way an Access policy that's accidentally too broad (e.g. "any
// authenticated Google account" left over from testing) can't silently hand
// out admin here -- the app enforces the specific identity itself.
export function isAdminRequest(request, env) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (typeof email !== 'string' || email.trim().length === 0) return false;

  const allowlist = (env?.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0) return false;

  return allowlist.includes(email.trim().toLowerCase());
}
