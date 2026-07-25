# Photo Gallery — Setup & Deployment Guide

A React/Vite photography gallery. Photos live in Cloudflare R2 (object
storage); album/photo metadata (name, description, category, captions,
tags) lives in Cloudflare D1; the whole site — static frontend **and**
backend — is a single Cloudflare Worker, deployed with `wrangler deploy`.
Visitors verify a real email address (a code sent via Resend) before they
can browse the gallery section; private albums additionally require a
passcode on top of that. A Cloudflare Access-protected `/admin` page lets
you add descriptions, categories, captions, and tags to albums/photos after
they're uploaded, without touching any files or redeploying.

```
Your computer                                  Cloudflare
─────────────                                  ──────────
photos/public/…    ─┐
photos/private/…    ├─ npm run generate ──┬──▶ R2 (resized photos, auto-uploaded)
album-info.json*    ┘                      └──▶ D1 (album + photo rows, upserted)

*album-info.json seeds name/description/category once -- after that,
 edit those (plus captions/tags/featured) on the live /admin page instead.

Visitor ─▶ / (landing) ─▶ "View Galleries" ─▶ email + code (Resend) ─▶
  session token (KV pending code, D1 mailing list) ─▶ /galleries ─▶
  private album? ─▶ passcode ─▶ photos (fetched live from D1 via /api/albums)

You ─▶ /admin (Cloudflare Access login) ─▶ pick an album ─▶ edit
  description/category/captions/tags ─▶ saved straight to D1, live immediately
```

---

## 1. Architecture at a glance

| Piece | What it is | Where |
|---|---|---|
| UI | React SPA — landing page (`/`), gated gallery (`/galleries`, `/galleries/:albumId`), admin (`/admin`) | `src/` |
| Routing | `react-router-dom` | `src/App.jsx` |
| Styling | Tailwind CSS v4, compiled via `@tailwindcss/vite` | `vite.config.js`, `src/index.css` |
| Gallery data | Album/photo metadata + R2 URLs, fetched client-side from `/api/albums` | `worker/lib/albums.js`, D1 `albums`/`photos` tables |
| Landing page content | Booking info, testimonials, contact details | `public/content.json` |
| Backend | **One Cloudflare Worker** — serves the built static site *and* the `/api/*` endpoints from the same origin (no separate server, no CORS) | `worker/` |
| Email verification | Real 6-digit codes sent via Resend; a signed session token is issued on success | `worker/routes/verify.js`, `worker/routes/session.js`, `worker/lib/token.js` |
| Pending codes / rate limits | Cloudflare KV | `worker/lib/kv.js`, bound in `wrangler.jsonc` |
| Verified-email mailing list | Cloudflare D1 | `worker/lib/d1.js`, schema in `migrations/0001_init.sql` |
| Album/photo metadata | Cloudflare D1 (`albums`, `photos` tables) | `worker/lib/albums.js`, schema in `migrations/0002_*.sql` and `0003_*.sql` |
| Image storage | Cloudflare R2 bucket, public `r2.dev` URL | Cloudflare dashboard |
| Local staging | Where you organize photos *before* they're auto-uploaded — never deployed, never committed | `photos/` (gitignored) |
| Pipeline script | Scans `photos/`, resizes oversized images, uploads to R2, upserts D1 rows | `generate-albums.cjs` |
| Admin editing | `/admin` page — edit description/category/caption/tags/featured live, no redeploy needed | `src/pages/AdminPage.jsx`, `worker/routes/admin.js`, gated by Cloudflare Access |
| Hosting | A Worker with static assets (`wrangler.jsonc` → `assets.directory`), deployed via `wrangler deploy` | `wrangler.jsonc` |
| Custom domain | `photography.abdulmalik.de`, attached to the Worker | Cloudflare dashboard → Worker → Domains & Routes |

**This is not classic Cloudflare Pages.** There's no `functions/` directory
and no Pages dashboard build settings — one Worker script (`worker/index.js`)
has a `fetch` handler that routes `/api/*` itself and falls through to the
static assets binding for everything else. This matters if you're ever
tempted to follow generic "Cloudflare Pages" tutorials — they don't apply
here.

**The `*.workers.dev` subdomain is intentionally disabled** (`workers_dev:
false` in `wrangler.jsonc`) — the custom domain is the only entry point.
This matters because Cloudflare Access (§3.10) only protects `/admin` on the
custom domain; if the `workers.dev` URL were still live, it would bypass
Access entirely.

---

## 2. Prerequisites

- Node.js 18+ and npm
- A Cloudflare account (free tier is enough)
- Git, and this repo pushed to GitHub
- A domain you control DNS for — required for Resend to send real
  verification emails (the test sender only delivers to your own inbox),
  and for Cloudflare Access to protect `/admin`
- A [Resend](https://resend.com) account (free tier: 3,000 emails/mo, 100/day)

---

## 3. One-time Cloudflare setup

### 3.1 Create the R2 bucket

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2 Object Storage** → **Create bucket**.
2. Name it whatever you like (e.g. `photo-gallery` — this project's bucket
   name is set in `generate-albums.cjs`'s `CONFIG.r2BucketName`).
3. Photos end up organized as `public/<album-name>/…` and
   `private/<album-name>/…` inside the bucket — the pipeline script creates
   this structure automatically, you never need to create folders by hand.

### 3.2 Enable public access

1. In the bucket → **Settings** → **Public access**.
2. Enable the **r2.dev** subdomain (or connect a custom domain if you
   have one you want to serve images from).
3. Copy the public URL — it looks like `https://pub-xxxxxxxx.r2.dev`.
   You'll paste this in `generate-albums.cjs` (§3.3).

Images are loaded via plain `<img src="...">` tags, so R2 CORS settings
don't need to be touched for the gallery itself to work.

### 3.3 Point the project at your bucket

Update these in `generate-albums.cjs`'s `CONFIG` object:
- `r2BaseUrl` → your bucket's public URL from §3.2
- `r2BucketName` → your actual bucket name from §3.1
- `d1DatabaseName` → your D1 database name (see §3.6)

Every URL the pipeline writes to D1 (cover images, photo URLs) is built
from `r2BaseUrl`, so once these are right, everything else follows
automatically.

### 3.4 Authenticate wrangler

```bash
npx wrangler login
```

Opens a browser for you to approve access to your Cloudflare account.
Everything from here on — deploying, the R2 uploads and D1 syncs
`generate-albums.cjs` does on your behalf, `wrangler d1 execute` — uses this
authenticated session. No separate R2 API keys or D1 credentials are
needed anywhere in this project.

### 3.5 Create the KV namespace and D1 database

```bash
npx wrangler kv namespace create VERIFY_CODES
npx wrangler d1 create subscribers-db
```

Each command prints a snippet with an `id` (KV) or `database_id` (D1).
Add them to `wrangler.jsonc`'s `kv_namespaces` / `d1_databases` arrays
(already done for this project — only needed again if you're setting this
up fresh, e.g. on a different Cloudflare account).

Apply **all three** migrations to the **remote** (production) database, in order:

```bash
npx wrangler d1 execute subscribers-db --remote --file=./migrations/0001_init.sql
npx wrangler d1 execute subscribers-db --remote --file=./migrations/0002_album_metadata.sql
npx wrangler d1 execute subscribers-db --remote --file=./migrations/0003_photo_tags.sql
```

- `0001` — the `subscribers` mailing-list table
- `0002` — `albums` and `photos` tables (the album/photo metadata store)
- `0003` — adds the per-photo `tags` column

If you add more migrations later, list them here too and apply them to
both `--remote` and `--local` (§4).

### 3.6 Set up Resend

1. Sign up at [resend.com](https://resend.com).
2. **Domains** → **Add Domain** → enter your domain (or a dedicated
   sending subdomain — Resend adds its own `send` prefix on top of
   whatever you give it, so if you add `send.yourdomain.com` the actual
   DNS records end up needing to live at `send.send.yourdomain.com`;
   simplest to just add your root domain and let Resend manage its own
   subdomain naming).
3. Add the DKIM, SPF (TXT), and MX records Resend gives you, at whatever
   host actually manages your domain's DNS **right now** — check this
   isn't a stale/inactive DNS provider left over from before the domain
   moved to Cloudflare (see Troubleshooting if verification won't pass).
4. Wait for all three records to show **Verified** in Resend (DNS
   propagation — minutes to a few hours, occasionally up to 24-48h).
5. **API Keys** → **Create API Key** → Sending access → copy it.

### 3.7 Configure secrets

Two secrets, set on the deployed Worker (never in git):

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SESSION_HMAC_SECRET   # openssl rand -hex 32
```

Also update `wrangler.jsonc`'s `vars.FROM_EMAIL` to an address on your
verified Resend domain (e.g. `verify@send.yourdomain.com`).

For **local development**, secrets come from a `.dev.vars` file at the
repo root (gitignored, never committed):

```
SESSION_HMAC_SECRET=<same value as the deployed secret, or a different one for local testing>
RESEND_API_KEY=<your Resend API key>
```

### 3.8 Deploy

```bash
npm run build
npx wrangler deploy
```

If this project is connected to Cloudflare's **Workers Builds** (git
integration), every `git push` to the production branch triggers this
automatically — check Workers & Pages → your Worker → **Settings** →
**Build** in the dashboard to confirm/configure.

### 3.9 Attach a custom domain

1. Dashboard → **Workers & Pages** → your Worker → **Settings** →
   **Domains & Routes** → **Add** → **Custom Domain**.
2. Enter the subdomain (e.g. `photography.yourdomain.com`).
3. Cloudflare creates the DNS record and provisions SSL automatically —
   requires the domain's zone to already be on Cloudflare DNS.

This only attaches the domain to whatever is *currently* deployed — it
does not trigger a new deployment, so it's safe to do at any time without
worrying about mid-flight code changes going live as a side effect.

### 3.10 Protect `/admin` with Cloudflare Access

`/admin` and `/api/admin/*` are gated at the edge by Cloudflare Access
(Zero Trust) — there's no password or login code anywhere in this app.
The Worker only checks for a `Cf-Access-Authenticated-User-Email` header,
which Access adds to requests it has authenticated; unauthenticated
requests never reach the Worker at all (see `worker/lib/adminAuth.js`).

1. Go to **one.dash.cloudflare.com** (Zero Trust dashboard) — pick a team
   name if this is your first time there.
2. **Access → Applications → Add an application.**
3. On the destination-type screen, click the **"Public DNS"** tab (not
   "Private destinations", which is pre-selected by default and is the
   wrong option for this — this app protects a normal public hostname, not
   an internal/private network resource).
4. Choose **Self-hosted**. Set the application domain to your custom
   domain (e.g. `photography.abdulmalik.de`), path `admin*`.
5. Under **Destinations**, click **"+ Add public hostname"** and add a
   *second* destination on the **same application**: same domain, path
   `api/admin*`. **Both paths must be on the same application** — two
   separate applications means two separate login sessions, and a
   browser session that's authenticated for `/admin` won't cover
   `/api/admin/*` calls made from that page's JavaScript (those calls
   can't complete an interactive login, so they'll just silently fail —
   this is exactly what "Save doesn't work" on `/admin` looks like if this
   is set up as two apps instead of one).
6. Under **Access policies**, add a policy: **Allow**, rule **Emails** →
   your own email address. Leave the default **One-Time PIN** authentication
   method — no identity provider setup needed.
7. Save.

Verify it worked: visiting `/admin` should redirect to a Cloudflare login
page (email + one-time code) before showing the page at all.

**If you hit `use_clientless_isolation_app_launcher_url can only be
enabled for apps with private destinations`** when saving: this means the
application got created under "Private destinations" instead of "Public
DNS" (step 3 above) — delete it and recreate choosing Public DNS. If
that's not it, check that both **"Allow clientless access"** and **"Show
application in App Launcher"** (under the app's Experience settings tab)
are switched off; these are private-network-only features that shouldn't
apply here.

---

## 4. Local development

```bash
npm install
npm run dev
```

This runs **both** the frontend and the Worker together via
[`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/) —
`/api/*` requests are handled by the real Worker code running in `workerd`
(the actual Workers runtime), not a mock. It auto-detects `wrangler.jsonc`,
so local KV/D1 bindings work out of the box, backed by a local emulation
on disk (`.wrangler/state/`, gitignored) — **separate from production
data**. Apply all three migrations locally too, if you haven't already:

```bash
npx wrangler d1 execute subscribers-db --local --file=./migrations/0001_init.sql
npx wrangler d1 execute subscribers-db --local --file=./migrations/0002_album_metadata.sql
npx wrangler d1 execute subscribers-db --local --file=./migrations/0003_photo_tags.sql
```

`/admin` has no Cloudflare Access in front of it locally (Access only
protects the deployed custom domain) — the page and its API routes are
reachable unauthenticated on `localhost`. That's expected, not a bug.

`generate-albums.cjs` writes to **production** R2/D1 by default (via
`--remote`, since that's what actually gets uploaded/served). Pass
`--local` to target the local D1 emulation instead, for testing the
pipeline itself without touching real data — R2 uploads still go to the
real bucket either way, since there's no meaningful "local R2".

```bash
npm run build       # production build → dist/client (assets) + dist/<worker-name> (worker bundle)
npm run preview      # build, then preview the production build locally
npm run deploy       # build, then wrangler deploy
```

Inspecting local KV/D1 state directly is often the fastest way to debug:

```bash
npx wrangler kv key get "code:someone@example.com" --namespace-id <id> --local
npx wrangler d1 execute subscribers-db --local --command "SELECT * FROM albums"
```

---

## 5. The email gate + private albums — what the protection actually is

There are **two separate layers**, and it's worth being precise about
what each one does and doesn't guarantee.

### The email gate (`/galleries` and below)

Real server-side verification: a 6-digit code is generated, stored in KV
with a 10-minute TTL, and emailed via Resend. Confirming it issues a
signed session token (HMAC, ~60-day expiry) stored in the visitor's
`localStorage`. A wrong code fails; after 5 wrong attempts on the same
code it's invalidated outright (`worker/lib/kv.js`). The visitor's email
is also upserted into the D1 `subscribers` table.

**What this is, currently:** a genuine "you provided a real, working
email address" check, with friction proportional to actually receiving
and typing a code. **What this is not, yet:** access control on the
underlying data. `GET /api/albums` — the endpoint that returns every
album (public and private), every photo's direct R2 URL, and every
private album's plaintext `secretCode` — has no authentication at all.
Anyone who requests it directly gets everything in it, gate or no gate;
the gate only governs what the React app chooses to render for a normal
visitor clicking through the site. This is a known, accepted limitation
for now — the gate's current value is the friction and the verified-email
capture, not data confidentiality. Closing this properly (gating
`/api/albums` by the same session token, while still letting the public
landing page's featured photos through unauthenticated) is a planned
follow-up, not yet built.

### The private-album passcode (on top of the gate)

Each private album has a `secretCode` (set via `album-info.json` when the
album is created — see §6), checked client-side in the browser
(case-insensitive, trimmed). Visible in DevTools and in the `/api/albums`
response itself — same caveat as above, just at the individual-album
level instead of the whole gallery. Unlock state lives in memory only and
resets on a real page reload. Fine for "family/friends, don't want it
showing up in casual browsing" — not real security for genuinely
sensitive photos.

### Admin editing (`/admin`)

Unlike the visitor-facing gate, `/admin` and `/api/admin/*` are protected
by Cloudflare Access at the edge (§3.10) — a real login (email + one-time
code), enforced before the request ever reaches the Worker. This is
separate from, and stronger than, the email/passcode gate above.

### Rate limiting

`/api/verify/start` (requesting a code): max 5 per hour, tracked per
email **and** per IP in KV — protects Resend's 100/day cap from abuse.
`/api/verify/confirm` (submitting a code): max 5 wrong guesses per issued
code before it's invalidated — protects against brute-forcing the 6-digit
space. Both are best-effort (KV has no atomic compare-and-swap), which is
an acceptable tradeoff for what they're protecting against.

---

## 6. Adding a new album (the recurring workflow)

### 6.1 Organize photos locally

```
photos/
  public/
    my-new-album/
      IMG_001.jpg
      IMG_002.jpg
      album-info.json     ← optional, see below
  private/
    family-reunion/
      IMG_001.jpg
      album-info.json     ← required: must include a secretCode
```

`photos/` is gitignored — it's scratch space for organizing files before
the pipeline uploads them. It is never built into the site and never
deployed, and originals are resized/compressed **in place** here (see 6.2).

**Optional `album-info.json`** seeds the album's initial name, category,
date, and (private albums only) `secretCode`/`tags`/`featuredPhotos` —
run `node generate-albums.cjs --example` to print a sample. Everything
else (description, category, captions, per-photo tags, featured) is
better set afterward on `/admin` (§6.3) — once an album/photo exists,
`generate-albums.cjs` never overwrites those fields again, so admin edits
are always safe across re-runs. The one thing `album-info.json` is
*required* for is a private album's `secretCode` — there's no prompt for
it anymore, and an album without one is skipped entirely (with a warning)
rather than created with no passcode.

### 6.2 Run the pipeline

```bash
npm run generate
```

For every album folder under `photos/public/` and `photos/private/`,
this:
1. Resizes/recompresses any image over ~1.5MB or wider than 2000px,
   **in place** (overwrites the file in `photos/`) — skips ones that are
   already small enough, so re-running doesn't re-encode everything.
2. Uploads new/changed photos straight to R2 via the wrangler CLI (already
   authenticated from §3.4 — no separate R2 credentials needed). A local
   manifest (`.r2-upload-manifest.json`, gitignored) tracks what's already
   uploaded, so this only uploads what's actually new or changed.
3. Upserts an `albums` row and one `photos` row per image into D1. New
   albums/photos get blank description/default `"Photo N"` caption; if
   they already exist, those admin-owned fields are left untouched — only
   things still owned by `album-info.json` (name, date, privacy, secret
   code, tags, cover image) refresh.

There's no interactive prompt for anything anymore — the only mandatory
input is the folder name itself.

### 6.3 Fill in the details

Visit `/admin` (Cloudflare Access login required on the deployed site),
pick the album from the dropdown, and fill in its description/category,
then each photo's caption/tags and whether it should show up in the
landing page's "Recent Work" section. Saves are immediate — no commit, no
deploy, live on the site as soon as you click Save.

### 6.4 Removing an album or photo

Delete the local folder (for a whole album) or the local file (for one
photo) from `photos/`, then run:

```bash
npm run prune
```

This compares what's currently under `photos/` against what's in R2/D1,
shows you exactly what it's about to permanently delete, and asks for a
typed `yes` confirmation before deleting anything. It refuses outright
(rather than deleting everything) if it finds zero albums locally but
some still exist in the database — the usual sign that `photos/` wasn't
restored on this machine yet rather than a real "delete everything"
intent, since `photos/` is gitignored and doesn't travel with the repo.

A plain `npm run generate` (without `--prune`) never deletes anything —
it only adds/updates.

### 6.5 Test, then you're done

```bash
npm run dev      # confirm the new album shows up and images load
```

There's nothing to commit or push for a plain new album — `photos/`,
`album-info.json`, and the upload manifest are all gitignored, and the
album/photo data lives in D1, not in a file in this repo. You only need
to `git commit`/push when you've changed actual code (this script, a
migration, a component, etc.).

---

## 7. Editing the landing page (`content.json`)

`public/content.json` is hand-edited directly — small enough not to need
a generator. Shape:

```json
{
  "site": { "photographerName": "...", "tagline": "..." },
  "contact": { "email": "...", "phone": "...", "instagram": "...", "location": "..." },
  "booking": { "headline": "...", "body": "...", "availabilityNote": "..." },
  "testimonials": [ { "id": "t1", "name": "...", "quote": "...", "context": "..." } ]
}
```

Currently populated with placeholder copy ("Your Name", `you@example.com`,
etc.) — replace with real content before treating the site as launched.

A photo's `featured` flag (public albums only, set on `/admin`) is what
surfaces it in the landing page's "Recent Work" section
(`src/pages/LandingPage.jsx`).

---

## 8. Mailing list

Every verified email is upserted into D1's `subscribers` table
(`email`, `first_verified_at`, `last_verified_at`, `verify_count`).

**Exporting the list**: not built yet — planned as an admin-only
`GET /api/admin/export` endpoint returning CSV (would reuse the same
Cloudflare Access protection as the rest of `/api/admin/*`). Until then,
pull it directly:

```bash
npx wrangler d1 execute subscribers-db --remote --command "SELECT * FROM subscribers"
```

**Removing someone** (e.g. on request): no UI for this either — direct
SQL is the current path:

```bash
npx wrangler d1 execute subscribers-db --remote --command "DELETE FROM subscribers WHERE email = 'someone@example.com'"
```

---

## 9. Troubleshooting

**Verification email never arrives**
- Check the Resend dashboard's **Logs** for the send attempt — bounced,
  blocked, or never sent all show up there.
- Confirm the sending domain shows fully **Verified** in Resend (all of
  DKIM, SPF, MX) — a partially-verified domain will fail sends silently
  from the visitor's perspective (they just get a "could not send" error).
- If DNS records were added somewhere that turned out not to be your
  domain's actual authoritative DNS host (e.g. added at a registrar's
  panel after the zone had already moved to Cloudflare), they're inert —
  check `nslookup -type=NS yourdomain.com` matches where you actually
  added the records.
- Check spam/junk, especially for the very first email from a newly
  verified domain.

**"Too many attempts" / gate won't let me request a new code**
- Rate limit is 5 code requests per hour, per email and per IP (§5).
  Wait, or check `wrangler kv key get "ratelimit:email:<email>" --namespace-id <id> --remote`
  to see the current window.

**"Too many incorrect attempts"**
- 5 wrong guesses invalidates that code (§5) — request a fresh one.

**Verified, but the gate reappears on next visit**
- The session token lives in `localStorage`, not a cookie — private
  browsing / browser settings that clear storage on close will lose it.
- Check the browser console for `/api/session/check` failures.

**Private album code doesn't unlock**
- Codes are compared case-insensitively and trimmed — if it still fails,
  check for a typo in the album's `secretCode`, e.g.
  `npx wrangler d1 execute subscribers-db --remote --command "SELECT id, secret_code FROM albums WHERE is_private = 1"`.

**Images don't load**
- Confirm R2 public access is enabled on the bucket (§3.2).
- `npm run generate` builds each photo's URL from the local folder name,
  and uploads to that exact same path — a name mismatch between local and
  R2 shouldn't happen anymore since the same run does both. It can still
  happen if you ever upload something to R2 by hand (dashboard) instead
  of through the pipeline; if so, compare the URL in the browser's network
  tab against the actual object path in the R2 dashboard.
- Check the browser console for a 403/404 on the image request.

**`npm run generate` fails with `EPERM ... rename ... .tmp -> ...`**
- Windows occasionally holds a brief lock on a just-resized file
  (antivirus scan, thumbnail generation, OneDrive sync). The script
  already retries this a few times with a short backoff and usually
  self-heals; if it still fails, just re-run `npm run generate` — the
  upload manifest means anything already done won't be repeated.

**`npm run prune` refuses with "no albums were found locally"**
- This is the safety guard working as intended — it means `photos/`
  is empty or missing on this machine (it's gitignored, so a fresh clone
  never has it). Restore your local `photos/` folder before pruning;
  don't work around this check.

**Save doesn't work on `/admin`**
- Most likely cause: `/admin` and `/api/admin/*` were set up as **two
  separate** Cloudflare Access applications instead of one application
  with two destinations (§3.10). Check the Zero Trust dashboard — there
  should be exactly one self-hosted application covering both paths.
- Also confirm you're testing this on the deployed custom domain, not
  `localhost` — there's no Access (and no auth check at all) in local dev,
  so `/admin` saves there always succeed regardless of this.

**Site fails to deploy**
- Confirm `npm run build` succeeds locally first.
- Check `npx wrangler deploy` output directly — Workers Builds' CI log
  shows the same errors if it's git-connected.
- A `_redirects` file will break the deploy outright (Workers Assets'
  `not_found_handling: "single-page-application"` in `wrangler.jsonc`
  already handles SPA routing — don't add a Pages-style `_redirects` file
  on top of it, they conflict).

**Local dev: D1 errors like "no such table"**
- The local D1 emulation is separate from production — all three
  migrations need running against `--local` too (§4), not just `--remote`.

---

## 10. Cost (Cloudflare + Resend free tiers)

- R2 storage: free up to 10 GB
- R2 reads (Class B): 10M/month free; writes (Class A): 1M/month free
- R2 egress via Cloudflare's network: free (no bandwidth charges)
- Workers: 100,000 requests/day free
- KV: 100,000 reads/day, 1,000 writes/day free
- D1: 5GB storage, 5M reads/day, 100k writes/day free
- Resend: 3,000 emails/month, 100/day free (the tighter limit — why
  `/api/verify/start` is rate-limited)
- Cloudflare Access: free for up to 50 users — comfortably covers a
  single admin

A typical portfolio (dozens of albums, a few thousand photos, a modest
trickle of verified visitors) stays comfortably inside all of these.
