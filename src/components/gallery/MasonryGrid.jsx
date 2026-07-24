import React from 'react';

const MasonryGrid = ({ photos, onPhotoClick }) => {
  return (
    <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
      {photos.map((photo, idx) => (
        <div
          key={idx}
          className="break-inside-avoid cursor-pointer group relative overflow-hidden rounded-lg bg-slate-200"
          onClick={() => onPhotoClick(photo, idx)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={photo.url}
            alt={photo.caption || `Photo ${idx + 1}`}
            className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
            draggable="false"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              {photo.caption && <p className="text-sm font-light">{photo.caption}</p>}
              {photo.date && <p className="text-xs text-slate-300 mt-1">{new Date(photo.date).toLocaleDateString()}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MasonryGrid;
