import React, { useState, useEffect } from 'react';
import { Lock, Calendar, Tag, X, Eye, EyeOff, AlertCircle } from 'lucide-react';

const PhotoGallery = () => {
  const [albums, setAlbums] = useState({ public: [], private: [] });
  const [view, setView] = useState('albums'); // 'albums' | 'album-detail'
  const [currentAlbum, setCurrentAlbum] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [unlockedAlbums, setUnlockedAlbums] = useState(new Set());
  const [codeInput, setCodeInput] = useState('');
  const [attemptingUnlock, setAttemptingUnlock] = useState(null);
  const [showPrivate, setShowPrivate] = useState(false);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filterCategory, setFilterCategory] = useState('all');

  // Load albums from albums.json (in production)
  useEffect(() => {
    fetch('/albums.json')
      .then(res => res.json())
      .then(data => setAlbums(data))
      .catch(err => console.error('Failed to load albums:', err));
  }, []);

  // Get all categories
  const categories = ['all', ...new Set([
    ...albums.public.map(a => a.category),
    ...albums.private.map(a => a.category)
  ].filter(Boolean))];

  // Sort and filter albums
  const getFilteredAlbums = (albumList) => {
    let filtered = [...albumList];
    
    if (filterCategory !== 'all') {
      filtered = filtered.filter(a => a.category === filterCategory);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date);
      return a.name.localeCompare(b.name);
    });

    return filtered;
  };

  const handleUnlockAlbum = (album) => {
    if (codeInput.trim().toUpperCase() === album.secretCode) {
      setUnlockedAlbums(new Set([...unlockedAlbums, album.id]));
      setAttemptingUnlock(null);
      setCodeInput('');
      setError('');
      openAlbum(album);
    } else {
      setError('Invalid code. Please try again.');
    }
  };

  const openAlbum = (album) => {
    setCurrentAlbum(album);
    setView('album-detail');
  };

  const handleAlbumClick = (album, isPrivate) => {
    if (isPrivate && !unlockedAlbums.has(album.id)) {
      setAttemptingUnlock(album);
    } else {
      openAlbum(album);
    }
  };

  const openLightbox = (photo, index) => {
    setSelectedPhoto({ ...photo, index, total: currentAlbum.photos.length });
  };

  const navigatePhoto = (direction) => {
    const newIndex = selectedPhoto.index + direction;
    if (newIndex >= 0 && newIndex < selectedPhoto.total) {
      const photo = currentAlbum.photos[newIndex];
      setSelectedPhoto({ ...photo, index: newIndex, total: selectedPhoto.total });
    }
  };

  const handleDownloadAttempt = (e) => {
    e.preventDefault();
    alert('📸 Please contact the photographer for high-resolution downloads and licensing.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-light text-slate-800">Photo Gallery</h1>
              <p className="text-slate-500 text-sm mt-1">Professional Photography Collection</p>
            </div>
            {view === 'album-detail' && (
              <button
                onClick={() => setView('albums')}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 transition"
              >
                ← Back to Albums
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'albums' && (
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
                      isUnlocked={unlockedAlbums.has(album.id)}
                      onClick={() => handleAlbumClick(album, true)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Album Detail View */}
        {view === 'album-detail' && currentAlbum && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-light text-slate-800 mb-2">{currentAlbum.name}</h2>
              <p className="text-slate-600 mb-4">{currentAlbum.description}</p>
              <div className="flex gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(currentAlbum.date).toLocaleDateString()}
                </span>
                <span>{currentAlbum.photoCount} photos</span>
                {currentAlbum.tags && (
                  <span className="flex items-center gap-1">
                    <Tag className="w-4 h-4" />
                    {currentAlbum.tags.join(', ')}
                  </span>
                )}
              </div>
            </div>

            {/* Masonry Grid */}
            <MasonryGrid photos={currentAlbum.photos} onPhotoClick={openLightbox} />
          </div>
        )}
      </main>

      {/* Unlock Modal */}
      {attemptingUnlock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-amber-600" />
              <h3 className="text-xl font-light text-slate-800">Enter Album Code</h3>
            </div>
            <p className="text-slate-600 mb-4">
              This album is private. Please enter the access code to view.
            </p>
            <input
              type="text"
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlockAlbum(attemptingUnlock)}
              placeholder="Enter code..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-3 focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none"
              autoFocus
            />
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm mb-3">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => handleUnlockAlbum(attemptingUnlock)}
                className="flex-1 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition"
              >
                Unlock
              </button>
              <button
                onClick={() => {
                  setAttemptingUnlock(null);
                  setCodeInput('');
                  setError('');
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <Lightbox
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onNavigate={navigatePhoto}
          onDownloadAttempt={handleDownloadAttempt}
        />
      )}
    </div>
  );
};

const AlbumCard = ({ album, isPrivate, isUnlocked, onClick }) => (
  <div
    onClick={onClick}
    className="group cursor-pointer bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
    onContextMenu={(e) => e.preventDefault()}
  >
    <div className="relative h-64 overflow-hidden bg-slate-200">
      <img
        src={album.coverImage}
        alt={album.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        draggable="false"
        onContextMenu={(e) => e.preventDefault()}
      />
      {isPrivate && (
        <div className={`absolute top-3 right-3 p-2 rounded-full ${isUnlocked ? 'bg-green-500' : 'bg-amber-500'}`}>
          <Lock className="w-4 h-4 text-white" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
    <div className="p-5">
      <h3 className="text-xl font-light text-slate-800 mb-2">{album.name}</h3>
      <p className="text-slate-600 text-sm mb-3 line-clamp-2">{album.description}</p>
      <div className="flex justify-between items-center text-sm text-slate-500">
        <span className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {new Date(album.date).toLocaleDateString()}
        </span>
        <span>{album.photoCount} photos</span>
      </div>
      {album.category && (
        <div className="mt-3">
          <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs">
            {album.category}
          </span>
        </div>
      )}
    </div>
  </div>
);

const MasonryGrid = ({ photos, onPhotoClick }) => {
  return (
    <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
      {photos.map((photo, idx) => (
        <div
          key={idx}
          className="break-inside-avoid cursor-pointer group relative overflow-hidden rounded-lg bg-slate-200"
          onClick={() => onPhotoClick(photo, idx)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={photo.url}
            alt={photo.caption || `Photo ${idx + 1}`}
            className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
            draggable="false"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              {photo.caption && <p className="text-sm font-light">{photo.caption}</p>}
              {photo.date && <p className="text-xs text-slate-300 mt-1">{new Date(photo.date).toLocaleDateString()}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const Lightbox = ({ photo, onClose, onNavigate, onDownloadAttempt }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNavigate(-1);
      if (e.key === 'ArrowRight') onNavigate(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-slate-300 transition z-10"
      >
        <X className="w-8 h-8" />
      </button>

      {photo.index > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(-1);
          }}
          className="absolute left-4 text-white hover:text-slate-300 transition text-4xl"
        >
          ‹
        </button>
      )}

      {photo.index < photo.total - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(1);
          }}
          className="absolute right-4 text-white hover:text-slate-300 transition text-4xl"
        >
          ›
        </button>
      )}

      <div className="max-w-5xl max-h-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo.url}
          alt={photo.caption || 'Photo'}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
          draggable="false"
          onContextMenu={onDownloadAttempt}
        />
        {(photo.caption || photo.date) && (
          <div className="mt-4 text-center text-white">
            {photo.caption && <p className="text-lg font-light">{photo.caption}</p>}
            {photo.date && <p className="text-sm text-slate-400 mt-1">{new Date(photo.date).toLocaleDateString()}</p>}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Photo {photo.index + 1} of {photo.total}
        </p>
      </div>
    </div>
  );
};

export default PhotoGallery;