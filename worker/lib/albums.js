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

export async function getAlbums(db) {
  const [{ results: albumRows }, { results: photoRows }] = await Promise.all([
    db.prepare('SELECT * FROM albums ORDER BY created_at').all(),
    db.prepare('SELECT * FROM photos ORDER BY album_id, sort_order').all()
  ]);

  const photosByAlbum = new Map();
  for (const photo of photoRows) {
    if (!photosByAlbum.has(photo.album_id)) photosByAlbum.set(photo.album_id, []);
    photosByAlbum.get(photo.album_id).push(photo);
  }

  const result = { public: [], private: [] };
  for (const row of albumRows) {
    const album = rowToAlbum(row, photosByAlbum.get(row.id) || []);
    result[row.is_private ? 'private' : 'public'].push(album);
  }
  return result;
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
