import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getStoredToken } from '../lib/sessionToken';

const AlbumsContext = createContext(null);

export const AlbumsProvider = ({ children }) => {
  const [albums, setAlbums] = useState({ public: [], private: [] });
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'

  // Kept re-runnable (exposed as `reload`) because this provider sits above
  // the email gate: on a first visit it mounts and fires this fetch before
  // any session token exists, so that initial call 401s. Once the visitor
  // verifies, RequireVerifiedVisitor calls reload() to load the albums with
  // the new token -- without it the gallery would stay stuck on the failed
  // initial fetch until a full page reload.
  const load = useCallback(() => {
    setLoadState('loading');
    // /api/albums requires either a verified visitor session token or
    // Cloudflare Access admin auth (checked server-side via the
    // Cf-Access-Authenticated-User-Email header, which the browser can't
    // see or set itself). Only attach this header when a token actually
    // exists -- on /admin there usually isn't one, and the request still
    // succeeds there purely on the Access header Cloudflare adds.
    const token = getStoredToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    return fetch('/api/albums', { headers })
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

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AlbumsContext.Provider value={{ albums, loadState, reload: load }}>
      {children}
    </AlbumsContext.Provider>
  );
};

export const useAlbums = () => {
  const ctx = useContext(AlbumsContext);
  if (!ctx) throw new Error('useAlbums must be used within an AlbumsProvider');
  return ctx;
};
