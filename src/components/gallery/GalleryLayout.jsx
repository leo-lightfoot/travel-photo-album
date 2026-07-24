import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAlbums } from '../../hooks/useAlbums';

const GalleryLayout = () => {
  const { loadState } = useAlbums();
  const location = useLocation();
  const isDetailView = location.pathname !== '/galleries';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-light text-slate-800">Photo Gallery</h1>
              <p className="text-slate-500 text-sm mt-1">Professional Photography Collection</p>
            </div>
            {isDetailView && (
              <Link to="/galleries" className="px-4 py-2 text-slate-600 hover:text-slate-900 transition">
                ← Back to Albums
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loadState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p>Loading albums...</p>
          </div>
        )}

        {loadState === 'error' && (
          <div className="flex flex-col items-center justify-center py-24 text-center text-slate-600">
            <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
            <p className="mb-1">Couldn't load the gallery.</p>
            <p className="text-sm text-slate-400">Please refresh the page, or try again shortly.</p>
          </div>
        )}

        {loadState === 'ready' && <Outlet />}
      </main>
    </div>
  );
};

export default GalleryLayout;
