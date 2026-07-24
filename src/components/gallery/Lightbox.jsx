import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const handleDownloadAttempt = (e) => {
  e.preventDefault();
  alert('📸 Please contact the photographer for high-resolution downloads and licensing.');
};

const Lightbox = ({ photo, onClose, onNavigate }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNavigate(-1);
      if (e.key === 'ArrowRight') onNavigate(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate]);

  return (
    <div
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-slate-300 transition z-10"
      >
        <X className="w-8 h-8" />
      </button>

      {photo.index > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(-1);
          }}
          className="absolute left-4 text-white hover:text-slate-300 transition text-4xl"
        >
          ‹
        </button>
      )}

      {photo.index < photo.total - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(1);
          }}
          className="absolute right-4 text-white hover:text-slate-300 transition text-4xl"
        >
          ›
        </button>
      )}

      <div className="max-w-5xl max-h-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo.url}
          alt={photo.caption || 'Photo'}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
          draggable="false"
          onContextMenu={handleDownloadAttempt}
        />
        {(photo.caption || photo.date) && (
          <div className="mt-4 text-center text-white">
            {photo.caption && <p className="text-lg font-light">{photo.caption}</p>}
            {photo.date && <p className="text-sm text-slate-400 mt-1">{new Date(photo.date).toLocaleDateString()}</p>}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Photo {photo.index + 1} of {photo.total}
        </p>
      </div>
    </div>
  );
};

export default Lightbox;
