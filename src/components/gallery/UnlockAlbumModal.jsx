import React, { useState } from 'react';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import { getStoredToken } from '../../lib/sessionToken';

// The passcode is checked server-side now (POST /api/albums/:id/unlock) --
// album.secretCode no longer exists on the client at all until this
// succeeds, so there's nothing to compare locally anymore.
const UnlockAlbumModal = ({ album, onUnlock, onCancel }) => {
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/albums/${album.id}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`
        },
        body: JSON.stringify({ code: codeInput })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid code. Please try again.');
        return;
      }
      onUnlock(data.album);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
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
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
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
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Unlock
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnlockAlbumModal;
