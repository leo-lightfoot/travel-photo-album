import React, { createContext, useContext, useEffect, useState } from 'react';

const AlbumsContext = createContext(null);

export const AlbumsProvider = ({ children }) => {
  const [albums, setAlbums] = useState({ public: [], private: [] });
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    fetch('/api/albums')
      .then(res => {
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return res.json();
      })
      .then(data => {
        setAlbums(data);
        setLoadState('ready');
      })
      .catch(err => {
        console.error('Failed to load albums:', err);
        setLoadState('error');
      });
  }, []);

  return (
    <AlbumsContext.Provider value={{ albums, loadState }}>
      {children}
    </AlbumsContext.Provider>
  );
};

export const useAlbums = () => {
  const ctx = useContext(AlbumsContext);
  if (!ctx) throw new Error('useAlbums must be used within an AlbumsProvider');
  return ctx;
};
