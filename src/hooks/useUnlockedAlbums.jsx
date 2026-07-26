import React, { createContext, useContext, useState } from 'react';

const UnlockedAlbumsContext = createContext(null);

// Holds the real album data (photos included) for private albums the
// visitor has successfully unlocked via POST /api/albums/:id/unlock --
// the passcode is now checked server-side, so the photo list for a locked
// album genuinely isn't available anywhere on the client until this fires.
// Lives above the route tree so it survives navigation between the gallery
// grid and an album's detail page, but resets on a real page reload (React
// state only, nothing persisted) -- this matches the documented behavior in
// docs/SETUP.md before routes existed.
export const UnlockedAlbumsProvider = ({ children }) => {
  const [unlockedAlbums, setUnlockedAlbums] = useState(new Map());

  const unlockAlbum = (albumId, albumData) => {
    setUnlockedAlbums(prev => new Map(prev).set(albumId, albumData));
  };

  const isUnlocked = (albumId) => unlockedAlbums.has(albumId);
  const getUnlockedAlbum = (albumId) => unlockedAlbums.get(albumId);

  return (
    <UnlockedAlbumsContext.Provider value={{ isUnlocked, unlockAlbum, getUnlockedAlbum }}>
      {children}
    </UnlockedAlbumsContext.Provider>
  );
};

export const useUnlockedAlbums = () => {
  const ctx = useContext(UnlockedAlbumsContext);
  if (!ctx) throw new Error('useUnlockedAlbums must be used within an UnlockedAlbumsProvider');
  return ctx;
};
