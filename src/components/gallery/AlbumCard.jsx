import React from 'react';
import { Lock, Calendar } from 'lucide-react';

const AlbumCard = ({ album, isPrivate, isUnlocked, onClick }) => (
  <div
    onClick={onClick}
    className="group cursor-pointer bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
    onContextMenu={(e) => e.preventDefault()}
  >
    <div className="relative h-64 overflow-hidden bg-slate-200">
      {isPrivate ? (
        // Private albums never show any photography in the grid -- the cover
        // is just the album name on a neutral backdrop. The cover image isn't
        // even sent to the client for these (see getAlbumsForVisitor); photos
        // become visible only on the detail page after the code is entered.
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-6 text-center bg-gradient-to-br from-slate-700 to-slate-900">
          <Lock className={`w-7 h-7 ${isUnlocked ? 'text-green-300' : 'text-white/70'}`} />
          <h3 className="text-2xl font-light text-white">{album.name}</h3>
          <span className="text-xs uppercase tracking-wider text-white/50">
            {isUnlocked ? 'Unlocked — click to view' : 'Private — enter code to view'}
          </span>
        </div>
      ) : (
        <img
          src={album.coverImage}
          alt={album.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          draggable="false"
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      {/* Photo count -- overlay, top-right corner */}
      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-medium">
        {album.photoCount} photos
      </div>

      {!isPrivate && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>

    <div className="p-5">
      <h3 className="text-xl font-light text-slate-800 mb-2">{album.name}</h3>
      {album.description && (
        <p className="text-slate-600 text-sm mb-3 line-clamp-2">{album.description}</p>
      )}
      {album.date && (
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <Calendar className="w-4 h-4" />
          {new Date(album.date).toLocaleDateString()}
        </div>
      )}
      {album.category && (
        <div className="mt-3">
          <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs">
            {album.category}
          </span>
        </div>
      )}
    </div>
  </div>
);

export default AlbumCard;
