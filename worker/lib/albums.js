import { timingSafeEqual } from './timingSafe.js';

function rowToAlbum(row, photos) {
  const album = {
    id: row.id,
    name: row.name,
    coverImage: row.cover_image,
    photoCount: photos.length,
    photos: photos.map((p) => ({
      url: p.url,
      caption: p.caption,
      tags: JSON.parse(p.tags || '[]'),
      ...(p.date && { date: p.date }),
      ...(p.featured ? { featured: true } : {})
    }))
  };
  if (row.description) album.description = row.description;
  if (row.date) album.date = row.date;
  if (row.category) album.category = row.category;
  if (row.is_private) {
    album.secretCode = row.secret_code;
    album.tags = JSON.parse(row.tags || '[]');
  }
  return album;
}

// The teaser shown for a locked private album in the gallery grid -- name,
// description, category, tags and photo count are fine as a preview, but NO
// imagery at all: not even the cover is sent, since the cover is itself one
// of the album's photos and a private album should show no photography until
// its passcode is entered. secretCode and the photos array are likewise
// withheld -- verifyAlbumUnlock() hands those over only after the code checks
// out server-side.
function rowToLockedAlbum(row, photoCount) {
  const album = {
    id: row.id,
    name: row.name,
    photoCount,
    tags: JSON.parse(row.tags || '[]')
  };
  if (row.description) album.description = row.description;
  if (row.date) album.date = row.date;
  if (row.category) album.category = row.category;
  return album;
}

function groupPhotosByAlbum(photoRows) {
  const photosByAlbum = new Map();
  for (const photo of photoRows) {
    if (!photosByAlbum.has(photo.album_id)) photosByAlbum.set(photo.album_id, []);
    photosByAlbum.get(photo.album_id).push(photo);
  }
  return photosByAlbum;
}

// Full data, including private albums' secretCode and photos -- only for
// Cloudflare Access-authenticated admin requests (see worker/lib/adminAuth.js).
export async function getAlbumsForAdmin(db) {
  const [{ results: albumRows }, { results: photoRows }] = await Promise.all([
    db.prepare('SELECT * FROM albums ORDER BY created_at').all(),
    db.prepare('SELECT * FROM photos ORDER BY album_id, sort_order').all()
  ]);

  const photosByAlbum = groupPhotosByAlbum(photoRows);
  const result = { public: [], private: [] };
  for (const row of albumRows) {
    const album = rowToAlbum(row, photosByAlbum.get(row.id) || []);
    result[row.is_private ? 'private' : 'public'].push(album);
  }
  return result;
}

// What a session-token-verified visitor gets: public albums in full, private
// albums as a locked teaser only (no secretCode, no photo URLs) until
// verifyAlbumUnlock() succeeds for that specific album.
export async function getAlbumsForVisitor(db) {
  const [{ results: albumRows }, { results: photoRows }] = await Promise.all([
    db.prepare('SELECT * FROM albums ORDER BY created_at').all(),
    db.prepare('SELECT * FROM photos ORDER BY album_id, sort_order').all()
  ]);

  const photosByAlbum = groupPhotosByAlbum(photoRows);
  const result = { public: [], private: [] };
  for (const row of albumRows) {
    const photos = photosByAlbum.get(row.id) || [];
    if (row.is_private) {
      result.private.push(rowToLockedAlbum(row, photos.length));
    } else {
      result.public.push(rowToAlbum(row, photos));
    }
  }
  return result;
}

// Public, unauthenticated -- exactly what the pre-gate landing page's
// "Recent Work" section needs and nothing else.
export async function getFeaturedPublicPhotos(db) {
  const { results } = await db.prepare(
    `SELECT p.url, p.caption FROM photos p
     JOIN albums a ON a.id = p.album_id
     WHERE a.is_private = 0 AND p.featured = 1
     ORDER BY p.album_id, p.sort_order`
  ).all();
  return results.map((p) => ({ url: p.url, caption: p.caption }));
}

// Checks a submitted passcode against the album's stored secret_code
// server-side (case-insensitive, trimmed -- same normalization the old
// client-side check used) and only returns the real photo list on a match.
// Returns null for: album not found, not private, no code set, or a wrong
// guess -- callers shouldn't distinguish these to avoid leaking which case
// applies.
export async function verifyAlbumUnlock(db, albumId, submittedCode) {
  const row = await db.prepare(
    'SELECT * FROM albums WHERE id = ?1 AND is_private = 1'
  ).bind(albumId).first();
  if (!row || !row.secret_code || typeof submittedCode !== 'string') return null;

  const normalizedSubmitted = submittedCode.trim().toUpperCase();
  const normalizedStored = row.secret_code.trim().toUpperCase();
  if (!timingSafeEqual(normalizedSubmitted, normalizedStored)) return null;

  const { results: photoRows } = await db.prepare(
    'SELECT * FROM photos WHERE album_id = ?1 ORDER BY sort_order'
  ).bind(albumId).all();

  // The caller already knows the code -- they just typed it correctly --
  // so there's no reason to echo it back in the response.
  const album = rowToAlbum(row, photoRows);
  delete album.secretCode;
  return album;
}

export async function updateAlbum(db, id, { description, category }) {
  const { meta } = await db.prepare(
    'UPDATE albums SET description = ?1, category = ?2 WHERE id = ?3'
  ).bind(description ?? '', category ?? '', id).run();
  return meta.changes > 0;
}

export async function updatePhoto(db, url, { caption, featured, tags }) {
  const { meta } = await db.prepare(
    'UPDATE photos SET caption = ?1, featured = ?2, tags = ?3 WHERE url = ?4'
  ).bind(caption ?? '', featured ? 1 : 0, JSON.stringify(tags ?? []), url).run();
  return meta.changes > 0;
}

// Deletes a photo row. If it was its album's cover image, repoint the cover
// at the next remaining photo (by sort order) so the album card doesn't
// render a broken image. Returns false if the photo didn't exist.
// NOTE: the R2 object itself is deleted by the caller (handleDeletePhoto) --
// this only touches D1.
export async function deletePhoto(db, url) {
  const photo = await db.prepare('SELECT album_id FROM photos WHERE url = ?1').bind(url).first();
  if (!photo) return false;

  await db.prepare('DELETE FROM photos WHERE url = ?1').bind(url).run();

  const album = await db.prepare('SELECT cover_image FROM albums WHERE id = ?1').bind(photo.album_id).first();
  if (album && album.cover_image === url) {
    const next = await db.prepare(
      'SELECT url FROM photos WHERE album_id = ?1 ORDER BY sort_order LIMIT 1'
    ).bind(photo.album_id).first();
    if (next) {
      await db.prepare('UPDATE albums SET cover_image = ?1 WHERE id = ?2').bind(next.url, photo.album_id).run();
    }
  }
  return true;
}
