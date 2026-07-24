import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AlbumsProvider } from './hooks/useAlbums';
import { UnlockedAlbumsProvider } from './hooks/useUnlockedAlbums';
import LandingPage from './pages/LandingPage';
import GalleriesPage from './pages/GalleriesPage';
import AlbumDetailPage from './pages/AlbumDetailPage';
import GalleryLayout from './components/gallery/GalleryLayout';

const App = () => (
  <BrowserRouter>
    <AlbumsProvider>
      <UnlockedAlbumsProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<GalleryLayout />}>
            <Route path="/galleries" element={<GalleriesPage />} />
            <Route path="/galleries/:albumId" element={<AlbumDetailPage />} />
          </Route>
        </Routes>
      </UnlockedAlbumsProvider>
    </AlbumsProvider>
  </BrowserRouter>
);

export default App;
