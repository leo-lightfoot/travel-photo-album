import { updateAlbum, updatePhoto } from '../lib/albums.js';
import { jsonResponse } from '../lib/http.js';

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleUpdateAlbum(request, env, albumId) {
  const body = await readJsonBody(request);
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const category = typeof body?.category === 'string' ? body.category.trim() : '';

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

  const updated = await updatePhoto(env.DB, url, { caption, featured, tags });
  if (!updated) return jsonResponse({ error: 'Photo not found' }, 404);
  return jsonResponse({ ok: true });
}
