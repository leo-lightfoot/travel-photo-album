import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getStoredToken, setStoredToken, clearStoredToken } from '../../lib/sessionToken';
import { useAlbums } from '../../hooks/useAlbums';
import EmailGate from './EmailGate';

const RequireVerifiedVisitor = ({ children }) => {
  const [status, setStatus] = useState('checking'); // 'checking' | 'verified' | 'unverified'
  const { reload: reloadAlbums } = useAlbums();

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setStatus('unverified');
      return;
    }

    fetch('/api/session/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            setStatus('verified');
            return;
          }
        } else if (res.status === 401) {
          // Token is genuinely invalid/expired -- drop it so the gate
          // starts clean rather than re-checking a dead token every load.
          clearStoredToken();
        }
        // 401 (handled above), 429 (rate limited), or a 5xx: fall back to
        // the gate but keep any token, so a real visitor who trips the
        // rate limit isn't forced to re-verify -- a later load can succeed.
        setStatus('unverified');
      })
      .catch(() => {
        // Network error -- don't silently let them in or lock them out
        // permanently, just show the gate so they can retry.
        setStatus('unverified');
      });
  }, []);

  const handleVerified = (token) => {
    setStoredToken(token);
    // The AlbumsProvider above us already fired its initial /api/albums
    // fetch (unauthenticated, so it 401'd) before this token existed --
    // kick off a fresh authenticated load now so the gallery is populated
    // the moment we flip to 'verified', instead of showing that failure.
    reloadAlbums();
    setStatus('verified');
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (status === 'unverified') {
    return <EmailGate onVerified={handleVerified} />;
  }

  return children;
};

export default RequireVerifiedVisitor;
