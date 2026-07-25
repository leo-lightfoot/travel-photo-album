import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, Tag } from 'lucide-react';
import { useAlbums } from '../hooks/useAlbums';
import { useUnlockedAlbums } from '../hooks/useUnlockedAlbums';
import MasonryGrid from '../components/gallery/MasonryGrid';
import Lightbox from '../components/gallery/Lightbox';
import UnlockAlbumModal from '../components/gallery/UnlockAlbumModal';

const AlbumDetailPage = () => {
  const { albumId } = useParams();
  const { albums } = useAlbums();
  const { isUnlocked, unlockAlbum } = useUnlockedAlbums();
  const navigate = useNavigate();
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const isPrivateAlbum = albums.private.some(a => a.id === albumId);
  const album = [...albums.public, ...albums.private].find(a => a.id === albumId);

  if (!album) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-600 mb-4">This album doesn't exist (or was removed).</p>
        <Link to="/galleries" className="text-slate-800 underline">← Back to Albums</Link>
      </div>
    );
  }

  // A private album's detail page is directly reachable by URL (bookmark,
  // refresh, shared link) -- so the passcode gate has to be enforced here
  // too, not just from the click handler on the gallery grid.
  if (isPrivateAlbum && !isUnlocked(album.id)) {
    return (
      <UnlockAlbumModal
        album={album}
        onUnlock={() => unlockAlbum(album.id)}
        onCancel={() => navigate('/galleries')}
      />
    );
  }

  const openLightbox = (photo, index) => {
    setSelectedPhoto({ ...photo, index, total: album.photos.length });
  };

  const navigatePhoto = (direction) => {
    const newIndex = selectedPhoto.index + direction;
    if (newIndex >= 0 && newIndex < selectedPhoto.total) {
      const photo = album.photos[newIndex];
      setSelectedPhoto({ ...photo, index: newIndex, total: selectedPhoto.total });
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-light text-slate-800 mb-2">{album.name}</h2>
        {album.description && <p className="text-slate-600 mb-4">{album.description}</p>}
        <div className="flex gap-4 text-sm text-slate-500">
          {album.date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(album.date).toLocaleDateString()}
            </span>
          )}
          <span>{album.photoCount} photos</span>
          {album.tags && album.tags.length > 0 && (
            <span className="flex items-center gap-1">
              <Tag className="w-4 h-4" />
              {album.tags.join(', ')}
            </span>
          )}
        </div>
      </div>

      <MasonryGrid photos={album.photos} onPhotoClick={openLightbox} />

      {selectedPhoto && (
        <Lightbox
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onNavigate={navigatePhoto}
        />
      )}
    </div>
  );
};

export default AlbumDetailPage;
