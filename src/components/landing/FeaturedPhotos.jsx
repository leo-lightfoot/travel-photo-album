import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// `photos` must already be filtered to public albums only by the caller --
// this component has no way to tell a public photo from a private one on
// its own, and the landing page sits in front of both the email gate and
// the passcode gate.
const FeaturedPhotos = ({ photos }) => {
  if (photos.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-20">
      <div className="flex items-end justify-between mb-8">
        <h2 className="text-3xl font-light text-slate-800">Recent Work</h2>
        <Link
          to="/galleries"
          className="hidden sm:inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 transition text-sm"
        >
          View all galleries
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {photos.map((photo, idx) => (
          <div
            key={idx}
            className="aspect-[4/5] rounded-xl overflow-hidden bg-slate-200 shadow-md group"
            onContextMenu={(e) => e.preventDefault()}
          >
            <img
              src={photo.url}
              alt={photo.caption || 'Featured photo'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              draggable="false"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeaturedPhotos;
