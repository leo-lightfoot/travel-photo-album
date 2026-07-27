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
      {/* Protected by Cloudflare Access at the edge, not by app code. Reads
          full album data (private photos included) from its own Access-
          protected /api/admin/albums, so it lives outside the visitor
          AlbumsProvider -- that fetches /api/albums, which returns the
          photoless visitor shape for private albums. */}
      <Route path="/admin" element={<AdminPage />} />
      {/* AlbumsProvider fetches /api/albums, which requires a verified
          visitor session token -- scoped to just these routes so the public
          landing page (outside this wrapper) never attempts, and fails, that
          fetch. */}
      <Route
        element={
          <AlbumsProvider>
            <UnlockedAlbumsProvider>
              <Outlet />
            </UnlockedAlbumsProvider>
          </AlbumsProvider>
        }
      >
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
