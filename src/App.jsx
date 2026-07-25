import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
    <AlbumsProvider>
      <UnlockedAlbumsProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
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
        </Routes>
      </UnlockedAlbumsProvider>
    </AlbumsProvider>
  </BrowserRouter>
);

export default App;
