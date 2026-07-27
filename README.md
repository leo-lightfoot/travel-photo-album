# Photo Gallery

Photo gallery for my photography. React + Vite frontend, Cloudflare R2 for
image storage, a Cloudflare Worker for hosting and the email-verification
backend (KV + D1 + Resend). Visitors verify a real
email before viewing galleries; private albums have additional passcode.

**Full setup, deployment, and album-workflow instructions: [docs/SETUP.md](docs/SETUP.md)**

## Quick Commands
- `npm install` - Install dependencies
- `npm run dev` - Start dev server (frontend + Worker backend together)
- `npm run generate` - Resize/upload new photos in `photos/` to R2 and sync album/photo metadata to D1
- `npm run prune` - Remove albums/photos from R2 + D1 that no longer exist in `photos/` (asks for confirmation)
- `npm run build` - Build for production (`dist/`)
- `npm run preview` - Build, then preview the production build locally
- `npm run deploy` - Build, then deploy to Cloudflare



