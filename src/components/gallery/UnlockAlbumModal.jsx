import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';

const UnlockAlbumModal = ({ album, onUnlock, onCancel }) => {
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (codeInput.trim().toUpperCase() === album.secretCode.trim().toUpperCase()) {
      onUnlock();
    } else {
      setError('Invalid code. Please try again.');
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
            className="flex-1 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition"
          >
            Unlock
          </button>
          <button
            onClick={onCancel}
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
