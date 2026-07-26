import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useAlbums } from '../hooks/useAlbums';
import { useUnlockedAlbums } from '../hooks/useUnlockedAlbums';
import AlbumCard from '../components/gallery/AlbumCard';
import UnlockAlbumModal from '../components/gallery/UnlockAlbumModal';

const GalleriesPage = () => {
  const { albums } = useAlbums();
  const { isUnlocked, unlockAlbum } = useUnlockedAlbums();
  const navigate = useNavigate();

  const [attemptingUnlock, setAttemptingUnlock] = useState(null);
  const [showPrivate, setShowPrivate] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [filterCategory, setFilterCategory] = useState('all');

  const categories = ['all', ...new Set([
    ...albums.public.map(a => a.category),
    ...albums.private.map(a => a.category)
  ].filter(Boolean))];

  const getFilteredAlbums = (albumList) => {
    let filtered = [...albumList];

    if (filterCategory !== 'all') {
      filtered = filtered.filter(a => a.category === filterCategory);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.date || 0) - new Date(a.date || 0);
      if (sortBy === 'oldest') return new Date(a.date || 0) - new Date(b.date || 0);
      return a.name.localeCompare(b.name);
    });

    return filtered;
  };

  const handleAlbumClick = (album, isPrivate) => {
    if (isPrivate && !isUnlocked(album.id)) {
      setAttemptingUnlock(album);
    } else {
      navigate(`/galleries/${album.id}`);
    }
  };

  const handleUnlock = (unlockedAlbum) => {
    unlockAlbum(attemptingUnlock.id, unlockedAlbum);
    const album = attemptingUnlock;
    setAttemptingUnlock(null);
    navigate(`/galleries/${album.id}`);
  };

  return (
    <>
      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-8 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm transition ${
                filterCategory === cat
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="alphabetical">A-Z</option>
          </select>

          <button
            onClick={() => setShowPrivate(!showPrivate)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
              showPrivate
                ? 'bg-amber-100 text-amber-800'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {showPrivate ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Private Albums
          </button>
        </div>
      </div>

      {/* Public Albums */}
      <section className="mb-12">
        <h2 className="text-2xl font-light text-slate-800 mb-6">Public Albums</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getFilteredAlbums(albums.public).map(album => (
            <AlbumCard
              key={album.id}
              album={album}
              onClick={() => handleAlbumClick(album, false)}
            />
          ))}
        </div>
      </section>

      {/* Private Albums */}
      {showPrivate && (
        <section>
          <h2 className="text-2xl font-light text-slate-800 mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-600" />
            Private Albums
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFilteredAlbums(albums.private).map(album => (
              <AlbumCard
                key={album.id}
                album={album}
                isPrivate={true}
                isUnlocked={isUnlocked(album.id)}
                onClick={() => handleAlbumClick(album, true)}
              />
            ))}
          </div>
        </section>
      )}

      {attemptingUnlock && (
        <UnlockAlbumModal
          album={attemptingUnlock}
          onUnlock={handleUnlock}
          onCancel={() => setAttemptingUnlock(null)}
        />
      )}
    </>
  );
};

export default GalleriesPage;
