import React, { useEffect, useState } from 'react';

// No client-side auth check here on purpose -- this route (and /api/admin/*)
// is protected at the edge by Cloudflare Access on the deployed domain. In
// local dev there's no Access in front of it, so this page is reachable
// unauthenticated on localhost; that's expected, not a bug.
const AdminPage = () => {
  const [albums, setAlbums] = useState(null);
  const [status, setStatus] = useState({});

  useEffect(() => {
    fetch('/api/albums')
      .then((res) => res.json())
      .then((data) => setAlbums([...data.public, ...data.private]));
  }, []);

  const updateAlbumField = (albumId, field, value) => {
    setAlbums((prev) => prev.map((a) => (a.id === albumId ? { ...a, [field]: value } : a)));
  };

  const updatePhotoField = (albumId, photoUrl, field, value) => {
    setAlbums((prev) => prev.map((a) => (
      a.id !== albumId ? a : { ...a, photos: a.photos.map((p) => (p.url === photoUrl ? { ...p, [field]: value } : p)) }
    )));
  };

  const saveAlbum = async (album) => {
    setStatus((s) => ({ ...s, [album.id]: 'saving' }));
    const res = await fetch(`/api/admin/albums/${album.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: album.description || '', category: album.category || '' })
    });
    setStatus((s) => ({ ...s, [album.id]: res.ok ? 'saved' : 'error' }));
  };

  const savePhoto = async (photo) => {
    setStatus((s) => ({ ...s, [photo.url]: 'saving' }));
    const res = await fetch('/api/admin/photos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: photo.url, caption: photo.caption || '', featured: Boolean(photo.featured) })
    });
    setStatus((s) => ({ ...s, [photo.url]: res.ok ? 'saved' : 'error' }));
  };

  const statusMark = (key) => {
    if (status[key] === 'saving') return '…';
    if (status[key] === 'saved') return '✓';
    if (status[key] === 'error') return '✗';
    return '';
  };

  if (!albums) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-light text-slate-800 mb-8">Admin — Edit Albums</h1>

      {albums.map((album) => (
        <div key={album.id} className="mb-12 pb-8 border-b border-slate-200">
          <h2 className="text-xl text-slate-800 mb-3">
            {album.name} <span className="text-sm text-slate-400">({album.photoCount} photos)</span>
          </h2>

          <label className="block text-sm text-slate-600 mb-1">Description</label>
          <textarea
            className="w-full border border-slate-300 rounded p-2 mb-3"
            rows={2}
            value={album.description || ''}
            onChange={(e) => updateAlbumField(album.id, 'description', e.target.value)}
          />

          <label className="block text-sm text-slate-600 mb-1">Category</label>
          <input
            className="w-full border border-slate-300 rounded p-2 mb-3"
            value={album.category || ''}
            onChange={(e) => updateAlbumField(album.id, 'category', e.target.value)}
          />

          <button
            onClick={() => saveAlbum(album)}
            className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition"
          >
            Save album details {statusMark(album.id)}
          </button>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {album.photos.map((photo) => (
              <div key={photo.url} className="border border-slate-200 rounded p-2">
                <img src={photo.url} alt="" className="w-full h-32 object-cover rounded mb-2" />
                <input
                  className="w-full border border-slate-300 rounded p-1 text-sm mb-2"
                  placeholder="Caption"
                  value={photo.caption || ''}
                  onChange={(e) => updatePhotoField(album.id, photo.url, 'caption', e.target.value)}
                />
                <label className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                  <input
                    type="checkbox"
                    checked={Boolean(photo.featured)}
                    onChange={(e) => updatePhotoField(album.id, photo.url, 'featured', e.target.checked)}
                  />
                  Featured on landing page
                </label>
                <button
                  onClick={() => savePhoto(photo)}
                  className="px-2 py-1 bg-slate-700 text-white rounded text-xs hover:bg-slate-600 transition"
                >
                  Save {statusMark(photo.url)}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminPage;
