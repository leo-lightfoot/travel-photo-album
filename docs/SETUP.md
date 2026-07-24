# Photo Gallery — Setup & Deployment Guide

A React/Vite photography gallery. Photos live in Cloudflare R2 (object
storage); the built site is a static bundle served by Cloudflare Pages.
There is no server-side code — `albums.json` is the entire "database,"
fetched by the browser on page load.

```
Your computer                Cloudflare R2                Cloudflare Pages
─────────────                ──────────────                ─────────────────
photos/public/…    ─upload─▶  public/…            ┐
photos/private/…   ─upload─▶  private/…            ├─ serves image bytes
                                                     ┘
generate-albums.cjs ─writes─▶ public/albums.json ─▶ committed to git ─▶ deployed
                                                       (git push triggers
                                                        an automatic build)
```

---

## 1. Architecture at a glance

| Piece | What it is | Where |
|---|---|---|
| UI | Single React component (`PhotoGallery`) — album grid, lightbox, private-album unlock modal | [`src/App.jsx`](../src/App.jsx) |
| Styling | Tailwind CSS v4, compiled at build time via the `@tailwindcss/vite` plugin | [`vite.config.js`](../vite.config.js), [`src/index.css`](../src/index.css) |
| Data | Album/photo metadata + R2 URLs, fetched client-side from `/albums.json` | [`public/albums.json`](../public/albums.json) |
| Image storage | Cloudflare R2 bucket, served over its public `r2.dev` URL (or a custom domain) | Cloudflare dashboard |
| Local staging | Where you organize photos *before* uploading — never deployed, never committed | [`photos/`](../photos/) (gitignored) |
| Manifest generator | Interactive CLI that scans `photos/` and writes `albums.json` | [`generate-albums.cjs`](../generate-albums.cjs) |
| Hosting | Static build (`dist/`) deployed by Cloudflare Pages, connected to this git repo | Cloudflare dashboard |

Nothing here requires a backend server or Cloudflare Worker — both storage
(R2) and hosting (Pages) are on Cloudflare's free tier, and the frontend
is plain static files.

---

## 2. Prerequisites

- Node.js 18+ and npm
- A Cloudflare account (free tier is enough)
- Git, and this repo pushed to GitHub (Cloudflare Pages deploys from git)

---

## 3. One-time Cloudflare setup

### 3.1 Create the R2 bucket

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2 Object Storage** → **Create bucket**.
2. Name it whatever you like (e.g. `photo-gallery`).
3. Inside the bucket, you'll eventually have two top-level folders:
   `public/` and `private/` — this mirrors the local `photos/public` and
   `photos/private` layout (see §5).

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

> The repo currently points at a specific R2 bucket URL — replace it with
> your own bucket's public URL before generating real albums.

### 3.4 Generate API credentials (needed for uploading photos)

The dashboard's drag-and-drop upload doesn't need credentials, but
command-line tools (rclone, AWS CLI) do. Generate an R2 API token once:

1. Dashboard → **R2 Object Storage** → **Manage API tokens** → **Create API token**.
2. Permissions: **Object Read & Write**. Scope it to your bucket if you
   want (recommended), or "Apply to all buckets" if you'll have more later.
3. Create it, then copy down the three values shown **once** (they won't
   be shown again):
   - **Access Key ID**
   - **Secret Access Key**
   - **Account ID** (also visible in the dashboard's right sidebar on any
     R2 page, or in your account URL)
4. Your S3-compatible endpoint for R2 is:
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

Save these somewhere safe (password manager) — you'll use them to
configure rclone or the AWS CLI in §5.3.

### 3.5 Create the Cloudflare Pages project

1. Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Select this repository.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. **Save and Deploy.**

From now on, every `git push` to your production branch triggers a new
build and deploy automatically. Your site is live at
`https://<project-name>.pages.dev` (or a custom domain you attach in
Pages → **Custom domains**).

---

## 4. Local development

```bash
npm install
npm run dev        # http://localhost:5173, hot reload
```

```bash
npm run build       # production build → dist/
npm run preview     # serve dist/ locally to sanity-check the build
```

---

## 5. Adding a new album (the recurring workflow)

### 5.1 Organize photos locally

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
  "captions": {
    "IMG_001.jpg": "The ceremony",
    "IMG_002.jpg": "First dance"
  }
}
```

Any field you omit, the generator will ask for interactively. Supported
image formats: `.jpg`, `.jpeg`, `.png`, `.webp`.

### 5.2 Generate `albums.json`

```bash
npm run generate
```

This scans `photos/public/*` and `photos/private/*`, merges in any
`album-info.json`, prompts for anything missing, and rewrites
[`public/albums.json`](../public/albums.json) from scratch — covering
**all** albums, not just the new one. Review the diff before committing.

### 5.3 Upload the actual image files to R2

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
> at a public, guessable URL (`.../private/<album>/album-info.json`),
> which undermines even the casual protection described in §7. The
> `--exclude` flags above are not optional.

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

### 5.4 Test, then deploy

```bash
npm run dev      # confirm the new album shows up and images load
```
```bash
git add public/albums.json
git commit -m "Add album: my-new-album"
git push          # Cloudflare Pages builds and deploys automatically
```

---

## 6. `albums.json` reference

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
        { "url": "https://pub-xxxxx.r2.dev/public/wedding-2026/IMG_001.jpg", "caption": "The ceremony", "date": "2026-06-15" }
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

You normally won't hand-edit this — `npm run generate` produces it. It's
documented here so a manual tweak (fixing a typo, reordering photos) is
safe to make directly.

---

## 7. Private albums — what the protection actually is

Private albums are gated by a `secretCode` string compared **in the
browser**. This is a courtesy lock, not real access control:

- The code is visible in `albums.json` (a publicly fetchable file) and in
  browser DevTools.
- The check is case-insensitive and trims whitespace, but there is no
  rate limiting, no server-side validation, and no encryption.
- An unlocked album's state lives in React state only — it resets on
  every page reload/navigation, by design.

This is fine for "family/friends, don't want it showing up in casual
browsing" privacy. It is **not** sufficient if the photos are genuinely
sensitive. If that need ever comes up, the right fix is a Cloudflare
Worker that validates the code server-side and issues a signed,
time-limited URL — that's a separate project, not a config toggle.

---

## 8. Troubleshooting

**rclone/AWS CLI: "Unable to locate credentials" or auth errors**
- Re-run `rclone config` (or `aws configure --profile r2`) — the Access
  Key ID/Secret Access Key from §3.4 were likely mistyped or not saved.

**rclone/AWS CLI: "Access Denied" on upload**
- Check the R2 API token's permission is **Object Read & Write** (§3.4),
  not read-only.
- Confirm the bucket name in your command matches the actual bucket.
- Confirm the endpoint URL has the right Account ID.

**Images don't load**
- Confirm R2 public access is enabled on the bucket (§3.2).
- Compare a URL from `albums.json` against the actual object path in the
  R2 dashboard — the folder structure must match exactly (`public/<album>/<file>`).
- Check the browser console for a 403/404 on the image request.

**Private album code doesn't unlock**
- Codes are compared case-insensitively and trimmed, so casing/whitespace
  shouldn't matter — if it still fails, check for a typo in `secretCode`
  in `albums.json` itself.

**Site fails to deploy on Cloudflare Pages**
- Confirm `npm run build` succeeds locally first.
- Check the build log in the Pages dashboard — build command must be
  `npm run build`, output directory `dist`.

**Blank page / "Couldn't load the gallery" message**
- Open DevTools → Network tab, check the response for `/albums.json` —
  a 404 usually means the file wasn't committed, or the fetch path
  doesn't match where Pages is serving it from.

---

## 9. Cost (Cloudflare free tier)

- R2 storage: free up to 10 GB
- R2 reads (Class B): 10M/month free; writes (Class A): 1M/month free
- R2 egress via Cloudflare's network: free (no bandwidth charges)
- Pages: 500 builds/month free, unlimited bandwidth

A typical portfolio (dozens of albums, a few thousand photos at a few MB
each) stays comfortably inside these limits.
