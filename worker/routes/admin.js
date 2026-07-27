import { updateAlbum, updatePhoto, deletePhoto, getAlbumsForAdmin } from '../lib/albums.js';
import { listSubscribers } from '../lib/d1.js';
import { jsonResponse } from '../lib/http.js';

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Quote a CSV field only when it contains a comma, quote, or newline;
// embedded quotes are doubled per RFC 4180.
function csvField(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Caps on admin-editable free text so a stray (or abusive) request can't
// stuff arbitrarily large blobs into D1. Generous enough that real content
// never hits them; exceeding one is a 400, not a silent truncation.
const FIELD_LIMITS = { description: 2000, category: 100, caption: 500, tag: 50, tagCount: 30 };

// Full album data (private albums included, with their photos + secretCode)
// for the admin editor. Served under /api/admin/* -- and therefore Cloudflare
// Access-protected -- unlike the public /api/albums, which returns the
// visitor shape (private albums as photoless teasers). The admin page must
// read from here, or private albums show up with no photos to edit.
export async function handleGetAdminAlbums(request, env) {
  return jsonResponse(await getAlbumsForAdmin(env.DB));
}

export async function handleUpdateAlbum(request, env, albumId) {
  const body = await readJsonBody(request);
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const category = typeof body?.category === 'string' ? body.category.trim() : '';

  if (description.length > FIELD_LIMITS.description) {
    return jsonResponse({ error: `Description must be ${FIELD_LIMITS.description} characters or fewer.` }, 400);
  }
  if (category.length > FIELD_LIMITS.category) {
    return jsonResponse({ error: `Category must be ${FIELD_LIMITS.category} characters or fewer.` }, 400);
  }

  const updated = await updateAlbum(env.DB, albumId, { description, category });
  if (!updated) return jsonResponse({ error: 'Album not found' }, 404);
  return jsonResponse({ ok: true });
}

export async function handleUpdatePhoto(request, env) {
  const body = await readJsonBody(request);
  const url = typeof body?.url === 'string' ? body.url : '';
  const caption = typeof body?.caption === 'string' ? body.caption.trim() : '';
  const featured = Boolean(body?.featured);
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((t) => typeof t === 'string').map((t) => t.trim()).filter(Boolean)
    : [];
  if (!url) return jsonResponse({ error: 'url is required' }, 400);
  if (caption.length > FIELD_LIMITS.caption) {
    return jsonResponse({ error: `Caption must be ${FIELD_LIMITS.caption} characters or fewer.` }, 400);
  }
  if (tags.length > FIELD_LIMITS.tagCount) {
    return jsonResponse({ error: `No more than ${FIELD_LIMITS.tagCount} tags.` }, 400);
  }
  if (tags.some((t) => t.length > FIELD_LIMITS.tag)) {
    return jsonResponse({ error: `Each tag must be ${FIELD_LIMITS.tag} characters or fewer.` }, 400);
  }

  const updated = await updatePhoto(env.DB, url, { caption, featured, tags });
  if (!updated) return jsonResponse({ error: 'Photo not found' }, 404);
  return jsonResponse({ ok: true });
}

// Permanently deletes a single photo: removes the underlying R2 object FIRST
// (so a deleted -- especially private -- photo isn't left publicly fetchable
// by its direct URL) and only then the D1 row. If the R2 delete fails,
// nothing is removed from the database so the two stay consistent.
export async function handleDeletePhoto(request, env) {
  const body = await readJsonBody(request);
  const url = typeof body?.url === 'string' ? body.url : '';
  if (!url) return jsonResponse({ error: 'url is required' }, 400);

  const base = env.R2_PUBLIC_BASE_URL || '';
  if (base && url.startsWith(`${base}/`) && env.PHOTOS_BUCKET) {
    const key = url.slice(base.length + 1);
    try {
      await env.PHOTOS_BUCKET.delete(key);
    } catch (err) {
      console.error('Failed to delete R2 object:', key, err);
      return jsonResponse({ error: 'Could not delete the image file. Nothing was removed.' }, 502);
    }
  }

  const deleted = await deletePhoto(env.DB, url);
  if (!deleted) return jsonResponse({ error: 'Photo not found' }, 404);
  return jsonResponse({ ok: true });
}

// Exports the email subscriber list as a CSV download. Same admin gate as
// the rest of /api/admin/* (Cloudflare Access + the ADMIN_EMAILS allowlist);
// a plain <a href> from the admin page works because the Access cookie rides
// along on the same-origin navigation.
export async function handleListSubscribers(request, env) {
  const subscribers = await listSubscribers(env.DB);
  const header = ['email', 'first_verified_at', 'last_verified_at', 'verify_count'];
  const lines = [header.join(',')];
  for (const s of subscribers) {
    lines.push([s.email, s.first_verified_at, s.last_verified_at, s.verify_count].map(csvField).join(','));
  }
  // Leading ﻿ (BOM) so Excel opens UTF-8 correctly.
  const csv = `﻿${lines.join('\r\n')}`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="subscribers.csv"'
    }
  });
}
