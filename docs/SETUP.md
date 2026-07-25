# Photo Gallery — Setup & Deployment Guide

A React/Vite photography gallery. Photos live in Cloudflare R2 (object
storage); the whole site — static frontend **and** backend — is a single
Cloudflare Worker, deployed with `wrangler deploy`. Visitors verify a real
email address (a code sent via Resend) before they can browse the gallery
section; private albums additionally require a passcode on top of that.

```
Your computer                Cloudflare R2                Cloudflare Worker
─────────────                ──────────────                ──────────────────
photos/public/…    ─upload─▶  public/…            ┐
photos/private/…   ─upload─▶  private/…            ├─ serves image bytes
                                                     ┘
generate-albums.cjs ─writes─▶ public/albums.json ─▶ committed to git ─▶ deployed

Visitor ─▶ / (landing) ─▶ "View Galleries" ─▶ email + code (Resend) ─▶
  session token (KV pending code, D1 mailing list) ─▶ /galleries ─▶
  private album? ─▶ passcode ─▶ photos
```

---

## 1. Architecture at a glance

| Piece | What it is | Where |
|---|---|---|
| UI | React SPA — landing page (`/`), gated gallery (`/galleries`, `/galleries/:albumId`) | `src/` |
| Routing | `react-router-dom` | `src/App.jsx` |
| Styling | Tailwind CSS v4, compiled via `@tailwindcss/vite` | `vite.config.js`, `src/index.css` |
| Gallery data | Album/photo metadata + R2 URLs, fetched client-side from `/albums.json` | `public/albums.json` |
| Landing page content | Booking info, testimonials, contact details | `public/content.json` |
| Backend | **One Cloudflare Worker** — serves the built static site *and* the `/api/*` endpoints from the same origin (no separate server, no CORS) | `worker/` |
| Email verification | Real 6-digit codes sent via Resend; a signed session token is issued on success | `worker/routes/verify.js`, `worker/routes/session.js`, `worker/lib/token.js` |
| Pending codes / rate limits | Cloudflare KV | `worker/lib/kv.js`, bound in `wrangler.jsonc` |
| Verified-email mailing list | Cloudflare D1 | `worker/lib/d1.js`, schema in `migrations/` |
| Image storage | Cloudflare R2 bucket, public `r2.dev` URL | Cloudflare dashboard |
| Local staging | Where you organize photos *before* uploading — never deployed, never committed | `photos/` (gitignored) |
| Manifest generator | Scans `photos/` and writes `albums.json` | `generate-albums.cjs` |
| Hosting | A Worker with static assets (`wrangler.jsonc` → `assets.directory`), deployed via `wrangler deploy` | `wrangler.jsonc` |
| Custom domain | `photography.abdulmalik.de`, attached to the Worker | Cloudflare dashboard → Worker → Domains & Routes |

**This is not classic Cloudflare Pages.** There's no `functions/` directory
and no Pages dashboard build settings — one Worker script (`worker/index.js`)
has a `fetch` handler that routes `/api/*` itself and falls through to the
static assets binding for everything else. This matters if you're ever
tempted to follow generic "Cloudflare Pages" tutorials — they don't apply
here.

---

## 2. Prerequisites

- Node.js 18+ and npm
- A Cloudflare account (free tier is enough)
- Git, and this repo pushed to GitHub
- A domain you control DNS for — required for Resend to send real
  verification emails (the test sender only delivers to your own inbox)
- A [Resend](https://resend.com) account (free tier: 3,000 emails/mo, 100/day)

---

## 3. One-time Cloudflare setup

### 3.1 Create the R2 bucket

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2 Object Storage** → **Create bucket**.
2. Name it whatever you like (e.g. `photo-gallery`).
3. Inside the bucket, you'll eventually have two top-level folders:
   `public/` and `private/` — this mirrors the local `photos/public` and
   `photos/private` layout (see §6).

### 3.2 Enable public access

1. In the bucket → **Settings** → **Public access**.
2. Enable the **r2.dev** subdomain (or connect a custom domain if you
   have one you want to serve images from).
3. Copy the public URL — it looks like `https://pub-xxxxxxxx.r2.dev`.
   You'll paste this in two places (§3.3).

Images are loaded via plain `<img src="...">` tags, so R2 CORS settings
don't need to be touched for the gallery itself to work.

### 3.3 Point the project at your bucket

Update the R2 base URL in **both** places it's currently hardcoded:

- [`generate-albums.cjs`](../generate-albums.cjs) → `CONFIG.r2BaseUrl` (near the top of the file)
- Nothing else needs manual editing — once the generator has the right
  URL, every entry it writes to `albums.json` will use it automatically.

### 3.4 Generate API credentials (needed for uploading photos)

The dashboard's drag-and-drop upload doesn't need credentials, but
command-line tools (rclone, AWS CLI) do. Generate an R2 API token once:

1. Dashboard → **R2 Object Storage** → **Manage API tokens** → **Create API token**.
2. Permissions: **Object Read & Write**. Scope it to your bucket if you
   want (recommended), or "Apply to all buckets" if you'll have more later.
3. Create it, then copy down the three values shown **once** (they won't
   be shown again): **Access Key ID**, **Secret Access Key**, **Account ID**
   (also visible in the dashboard's right sidebar on any R2 page).
4. Your S3-compatible endpoint for R2 is:
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

Save these somewhere safe (password manager) — used to configure rclone
or the AWS CLI in §6.3.

### 3.5 Authenticate wrangler

```bash
npx wrangler login
```

Opens a browser for you to approve access to your Cloudflare account.
Everything from here on uses this authenticated session.

### 3.6 Create the KV namespace and D1 database

```bash
npx wrangler kv namespace create VERIFY_CODES
npx wrangler d1 create subscribers-db
```

Each command prints a snippet with an `id` (KV) or `database_id` (D1).
Add them to `wrangler.jsonc`'s `kv_namespaces` / `d1_databases` arrays
(already done for this project — only needed again if you're setting this
up fresh, e.g. on a different Cloudflare account).

Apply the schema to the **remote** (production) database:

```bash
npx wrangler d1 execute subscribers-db --remote --file=./migrations/0001_init.sql
```

### 3.7 Set up Resend

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

### 3.8 Configure secrets

Three secrets, set on the deployed Worker (never in git):

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SESSION_HMAC_SECRET   # openssl rand -hex 32
```

`ADMIN_EXPORT_SECRET` (for the mailing-list export) isn't needed yet —
that endpoint doesn't exist until the export feature is built (§7).

Also update `wrangler.jsonc`'s `vars.FROM_EMAIL` to an address on your
verified Resend domain (e.g. `verify@send.yourdomain.com`).

For **local development**, secrets come from a `.dev.vars` file at the
repo root (gitignored, never committed):

```
SESSION_HMAC_SECRET=<same value as the deployed secret, or a different one for local testing>
RESEND_API_KEY=<your Resend API key>
```

### 3.9 Deploy

```bash
npm run build
npx wrangler deploy
```

If this project is connected to Cloudflare's **Workers Builds** (git
integration), every `git push` to the production branch triggers this
automatically — check Workers & Pages → your Worker → **Settings** →
**Build** in the dashboard to confirm/configure.

### 3.10 Attach a custom domain (optional)

1. Dashboard → **Workers & Pages** → your Worker → **Settings** →
   **Domains & Routes** → **Add** → **Custom Domain**.
2. Enter the subdomain (e.g. `photography.yourdomain.com`).
3. Cloudflare creates the DNS record and provisions SSL automatically —
   requires the domain's zone to already be on Cloudflare DNS.

This only attaches the domain to whatever is *currently* deployed — it
does not trigger a new deployment, so it's safe to do at any time without
worrying about mid-flight code changes going live as a side effect.

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
data**. If you apply a new D1 migration, run it against local too:

```bash
npx wrangler d1 execute subscribers-db --local --file=./migrations/0001_init.sql
```

```bash
npm run build       # production build → dist/client (assets) + dist/<worker-name> (worker bundle)
npm run preview      # build, then preview the production build locally
npm run deploy       # build, then wrangler deploy
```

Inspecting local KV/D1 state directly is often the fastest way to debug:

```bash
npx wrangler kv key get "code:someone@example.com" --namespace-id <id> --local
npx wrangler d1 execute subscribers-db --local --command "SELECT * FROM subscribers"
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
underlying data. `/albums.json` — the file that lists every album
(public and private), every photo's direct R2 URL, and every private
album's plaintext `secretCode` — is served as a plain static asset with
no authentication at all. Anyone who requests it directly gets everything
in it, gate or no gate; the gate only governs what the React app chooses
to render for a normal visitor clicking through the site. This is a known,
accepted limitation for now — the gate's current value is the friction and
the verified-email capture, not data confidentiality. Closing this
properly (serving `albums.json` through the Worker, gated by the same
session token) is a planned follow-up, not yet built.

### The private-album passcode (on top of the gate)

Unchanged from before the email gate existed: each private album has a
`secretCode` in `albums.json`, checked client-side in the browser
(case-insensitive, trimmed). Visible in DevTools and in `albums.json`
itself — same caveat as above, just at the individual-album level instead
of the whole gallery. Unlock state lives in memory only and resets on a
real page reload. Fine for "family/friends, don't want it showing up in
casual browsing" — not real security for genuinely sensitive photos.

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
they go to R2. It is never built into the site and never deployed.

**Optional: resize/compress before uploading.** Full-resolution camera
exports (10-50MB+ each) cost more R2 storage and take longer for
visitors to load, with no visible benefit at gallery display sizes. If
you have ImageMagick installed, from inside an album folder:
```bash
# Resize so no dimension exceeds 2000px, keep good quality
for file in *.jpg; do
  convert "$file" -resize 2000x2000\> -quality 85 "$file"
done
```
This is entirely optional and has no effect on the workflow below — it
just changes what the generator and uploader see as the source files.

**Optional `album-info.json`** pre-fills metadata so the generator
doesn't prompt for it interactively:

```json
{
  "name": "Sarah & John Wedding",
  "description": "A celebration in Tuscany",
  "category": "Weddings",
  "date": "2026-06-15",
  "coverImage": "IMG_001.jpg",
  "tags": ["wedding", "tuscany"],
  "secretCode": "WEDDING2026",
  "featuredPhotos": ["IMG_001.jpg"],
  "captions": {
    "IMG_001.jpg": "The ceremony",
    "IMG_002.jpg": "First dance"
  }
}
```

`featuredPhotos` (public albums only) marks photos to appear in the
landing page's "Recent Work" section — see §8. Any field you omit, the
generator will ask for interactively. Supported image formats: `.jpg`,
`.jpeg`, `.png`, `.webp`.

### 6.2 Generate `albums.json`

```bash
npm run generate
```

This scans `photos/public/*` and `photos/private/*`, merges in any
`album-info.json`, prompts for anything missing, and rewrites
[`public/albums.json`](../public/albums.json) from scratch — covering
**all** albums, not just the new one. Review the diff before committing.

### 6.3 Upload the actual image files to R2

The generator only writes URLs — it doesn't upload anything. Get the
files into R2 with matching paths (`public/my-new-album/...` /
`private/family-reunion/...`). Three ways to do it:

**Option A — Dashboard.** Simplest for a handful of photos, no setup
required: open the bucket in the Cloudflare dashboard, create the
folder if it doesn't exist, drag files in.

**Option B — rclone (recommended for bulk uploads).** Install it first:
```bash
# macOS:   brew install rclone
# Linux:   sudo apt install rclone
# Windows: https://rclone.org/downloads/
```
Then configure it once, using the API credentials from §3.4:

```bash
rclone config
```
Answer the prompts:
```
n) New remote
name> r2
Storage> (enter the number next to "Amazon S3 Compliant Storage Provider", or search "s3")
provider> Cloudflare R2   (or "Other" on older rclone versions)
access_key_id> <your Access Key ID>
secret_access_key> <your Secret Access Key>
endpoint> https://<ACCOUNT_ID>.r2.cloudflarestorage.com
(leave the rest as defaults — Enter through them)
```
This creates a remote named `r2`. Verify it works:
```bash
rclone lsd r2:                    # should list your bucket(s)
```
Then, per album:
```bash
rclone copy ./photos/public/my-new-album r2:photo-gallery/public/my-new-album \
  --exclude "*.json" --exclude ".DS_Store" --exclude "Thumbs.db" --progress
```
Replace `photo-gallery` with your actual bucket name. For private
albums, upload to `r2:photo-gallery/private/<album-name>` instead. To
sync everything staged locally in one go:
```bash
rclone sync ./photos/public r2:photo-gallery/public \
  --exclude "*.json" --exclude ".DS_Store" --exclude "Thumbs.db" --progress
rclone sync ./photos/private r2:photo-gallery/private \
  --exclude "*.json" --exclude ".DS_Store" --exclude "Thumbs.db" --progress
```
(`sync` makes the remote match local exactly, including deletions —
use `copy` instead if you don't want that.)

> **Always exclude `*.json`.** Every album folder's `album-info.json`
> stays local — it's an input to the generator, not something visitors
> should ever see. For private albums it also holds the plaintext
> `secretCode`; if it gets uploaded, the code becomes directly fetchable
> at a public, guessable URL (`.../private/<album>/album-info.json`).
> The `--exclude` flags above are not optional.

**Option C — AWS CLI.** R2 is S3-compatible, so the AWS CLI works too if
you already have it installed (`brew install awscli` / `sudo apt install
awscli` / [Windows installer](https://aws.amazon.com/cli/)):
```bash
aws configure --profile r2
# AWS Access Key ID: <your Access Key ID>
# AWS Secret Access Key: <your Secret Access Key>
# Default region: auto

aws s3 sync ./photos/public/my-new-album \
  s3://photo-gallery/public/my-new-album \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
  --exclude "*.json" --exclude ".DS_Store" --exclude "Thumbs.db" \
  --profile r2
```

### 6.4 Test, then deploy

```bash
npm run dev      # confirm the new album shows up and images load
```
```bash
git add public/albums.json
git commit -m "Add album: my-new-album"
git push          # triggers an automatic build/deploy, if Workers Builds is connected
```

---

## 7. `albums.json` reference

```json
{
  "public": [
    {
      "id": "wedding-2026",
      "name": "Sarah & John Wedding",
      "description": "A celebration in Tuscany",
      "coverImage": "https://pub-xxxxx.r2.dev/public/wedding-2026/IMG_001.jpg",
      "date": "2026-06-15",
      "category": "Weddings",
      "photoCount": 156,
      "photos": [
        { "url": "https://pub-xxxxx.r2.dev/public/wedding-2026/IMG_001.jpg", "caption": "The ceremony", "date": "2026-06-15", "featured": true }
      ]
    }
  ],
  "private": [
    {
      "id": "family-reunion",
      "name": "Family Reunion",
      "description": "Private family gathering",
      "coverImage": "https://pub-xxxxx.r2.dev/private/family-reunion/IMG_001.jpg",
      "date": "2026-07-04",
      "category": "Family",
      "photoCount": 42,
      "tags": ["family", "reunion"],
      "secretCode": "MILLER2026",
      "photos": [
        { "url": "https://pub-xxxxx.r2.dev/private/family-reunion/IMG_001.jpg", "caption": "Family portrait", "date": "2026-07-04" }
      ]
    }
  ]
}
```

You normally won't hand-edit this — `npm run generate` produces it. A
photo's `featured: true` flag (public albums only) is what surfaces it in
the landing page's "Recent Work" section (`src/pages/LandingPage.jsx`) —
set via `featuredPhotos` in `album-info.json` (§6.1).

---

## 8. Editing the landing page (`content.json`)

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

---

## 9. Mailing list

Every verified email is upserted into D1's `subscribers` table
(`email`, `first_verified_at`, `last_verified_at`, `verify_count`).

**Exporting the list**: not built yet — planned as an admin-only
`GET /api/admin/export` endpoint returning CSV, gated by a bearer-token
secret. Until then, pull it directly:

```bash
npx wrangler d1 execute subscribers-db --remote --command "SELECT * FROM subscribers"
```

**Removing someone** (e.g. on request): no UI for this either — direct
SQL is the current path:

```bash
npx wrangler d1 execute subscribers-db --remote --command "DELETE FROM subscribers WHERE email = 'someone@example.com'"
```

---

## 10. Troubleshooting

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
  check for a typo in `secretCode` in `albums.json` itself.

**Images don't load**
- Confirm R2 public access is enabled on the bucket (§3.2).
- Compare a URL from `albums.json` against the actual object path in the
  R2 dashboard — the folder structure must match exactly.
- Check the browser console for a 403/404 on the image request.

**Site fails to deploy**
- Confirm `npm run build` succeeds locally first.
- Check `npx wrangler deploy` output directly — Workers Builds' CI log
  shows the same errors if it's git-connected.
- A `_redirects` file will break the deploy outright (Workers Assets'
  `not_found_handling: "single-page-application"` in `wrangler.jsonc`
  already handles SPA routing — don't add a Pages-style `_redirects` file
  on top of it, they conflict).

**Local dev: D1 errors like "no such table"**
- The local D1 emulation is separate from production — migrations need
  running against `--local` too (§4), not just `--remote`.

---

## 11. Cost (Cloudflare + Resend free tiers)

- R2 storage: free up to 10 GB
- R2 reads (Class B): 10M/month free; writes (Class A): 1M/month free
- R2 egress via Cloudflare's network: free (no bandwidth charges)
- Workers: 100,000 requests/day free
- KV: 100,000 reads/day, 1,000 writes/day free
- D1: 5GB storage, 5M reads/day, 100k writes/day free
- Resend: 3,000 emails/month, 100/day free (the tighter limit — why
  `/api/verify/start` is rate-limited)

A typical portfolio (dozens of albums, a few thousand photos, a modest
trickle of verified visitors) stays comfortably inside all of these.
