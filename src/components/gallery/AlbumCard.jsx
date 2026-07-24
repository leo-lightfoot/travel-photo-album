import React from 'react';
import { Lock, Calendar } from 'lucide-react';

const AlbumCard = ({ album, isPrivate, isUnlocked, onClick }) => (
  <div
    onClick={onClick}
    className="group cursor-pointer bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
    onContextMenu={(e) => e.preventDefault()}
  >
    <div className="relative h-64 overflow-hidden bg-slate-200">
      <img
        src={album.coverImage}
        alt={album.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        draggable="false"
        onContextMenu={(e) => e.preventDefault()}
      />
      {isPrivate && (
        <div className={`absolute top-3 right-3 p-2 rounded-full ${isUnlocked ? 'bg-green-500' : 'bg-amber-500'}`}>
          <Lock className="w-4 h-4 text-white" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
    <div className="p-5">
      <h3 className="text-xl font-light text-slate-800 mb-2">{album.name}</h3>
      <p className="text-slate-600 text-sm mb-3 line-clamp-2">{album.description}</p>
      <div className="flex justify-between items-center text-sm text-slate-500">
        <span className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {new Date(album.date).toLocaleDateString()}
        </span>
        <span>{album.photoCount} photos</span>
      </div>
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
