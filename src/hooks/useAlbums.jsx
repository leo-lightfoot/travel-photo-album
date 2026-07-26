import React, { createContext, useContext, useEffect, useState } from 'react';
import { getStoredToken } from '../lib/sessionToken';

const AlbumsContext = createContext(null);

export const AlbumsProvider = ({ children }) => {
  const [albums, setAlbums] = useState({ public: [], private: [] });
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    // /api/albums requires either a verified visitor session token or
    // Cloudflare Access admin auth (checked server-side via the
    // Cf-Access-Authenticated-User-Email header, which the browser can't
    // see or set itself). Only attach this header when a token actually
    // exists -- on /admin there usually isn't one, and the request still
    // succeeds there purely on the Access header Cloudflare adds.
    const token = getStoredToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch('/api/albums', { headers })
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
