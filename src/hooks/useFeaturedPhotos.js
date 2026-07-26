import { useEffect, useState } from 'react';

// Public, unauthenticated -- used only by the landing page, which sits in
// front of the email gate. Deliberately separate from useAlbums(), which
// now requires a verified session and returns full album/photo data.
export const useFeaturedPhotos = () => {
  const [photos, setPhotos] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    fetch('/api/featured')
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setPhotos(data.photos || []);
        setLoadState('ready');
      })
      .catch((err) => {
        console.error('Failed to load featured photos:', err);
        setLoadState('error');
      });
  }, []);

  return { photos, loadState };
};
