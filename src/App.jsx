import React from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AlbumsProvider } from './hooks/useAlbums';
import { UnlockedAlbumsProvider } from './hooks/useUnlockedAlbums';
import LandingPage from './pages/LandingPage';
import GalleriesPage from './pages/GalleriesPage';
import AlbumDetailPage from './pages/AlbumDetailPage';
import AdminPage from './pages/AdminPage';
import GalleryLayout from './components/gallery/GalleryLayout';
import RequireVerifiedVisitor from './components/gate/RequireVerifiedVisitor';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {/* AlbumsProvider fetches /api/albums, which now requires either a
          verified visitor session token or Cloudflare Access admin auth --
          scoped to just these routes so the public landing page (outside
          this wrapper) never attempts, and fails, that fetch. */}
      <Route
        element={
          <AlbumsProvider>
            <UnlockedAlbumsProvider>
              <Outlet />
            </UnlockedAlbumsProvider>
          </AlbumsProvider>
        }
      >
        {/* Protected by Cloudflare Access at the edge, not by app code */}
        <Route path="/admin" element={<AdminPage />} />
        <Route
          element={
            <RequireVerifiedVisitor>
              <GalleryLayout />
            </RequireVerifiedVisitor>
          }
        >
          <Route path="/galleries" element={<GalleriesPage />} />
          <Route path="/galleries/:albumId" element={<AlbumDetailPage />} />
        </Route>
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
