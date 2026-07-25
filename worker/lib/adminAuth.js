// Admin routes are protected at the edge by Cloudflare Access (Zero Trust),
// not by any password/token logic in this app -- Access is configured in the
// Cloudflare dashboard to sit in front of /admin and /api/admin/* on the
// custom domain, and only forwards a request here once the visitor has
// authenticated. Access adds this header to every request it forwards.
//
// This check is a second line of defense, not the primary gate: it only
// holds up as long as (a) Access policies actually cover every /api/admin/*
// path, and (b) the workers.dev subdomain stays disabled (see
// wrangler.jsonc's `workers_dev: false`) -- otherwise the Worker is directly
// reachable and this header is just something any caller can set themselves.
export function isAdminRequest(request) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  return typeof email === 'string' && email.trim().length > 0;
}
