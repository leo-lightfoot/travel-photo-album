import React, { createContext, useContext, useState } from 'react';

const UnlockedAlbumsContext = createContext(null);

// Tracks which private albums the visitor has entered a valid passcode for.
// Lives above the route tree so it survives navigation between the gallery
// grid and an album's detail page, but resets on a real page reload (React
// state only, nothing persisted) -- this matches the documented behavior in
// docs/SETUP.md before routes existed.
export const UnlockedAlbumsProvider = ({ children }) => {
  const [unlockedIds, setUnlockedIds] = useState(new Set());

  const unlockAlbum = (albumId) => {
    setUnlockedIds(prev => new Set([...prev, albumId]));
  };

  const isUnlocked = (albumId) => unlockedIds.has(albumId);

  return (
    <UnlockedAlbumsContext.Provider value={{ isUnlocked, unlockAlbum }}>
      {children}
    </UnlockedAlbumsContext.Provider>
  );
};

export const useUnlockedAlbums = () => {
  const ctx = useContext(UnlockedAlbumsContext);
  if (!ctx) throw new Error('useUnlockedAlbums must be used within an UnlockedAlbumsProvider');
  return ctx;
};
