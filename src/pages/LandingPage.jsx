import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useFeaturedPhotos } from '../hooks/useFeaturedPhotos';
import { useSiteContent } from '../hooks/useSiteContent';
import Hero from '../components/landing/Hero';
import FeaturedPhotos from '../components/landing/FeaturedPhotos';
import BookingSection from '../components/landing/BookingSection';
import ContactSection from '../components/landing/ContactSection';
import { instagramDmUrl } from '../lib/instagram';

const LandingPage = () => {
  const { photos: featuredPhotos, loadState: albumsState } = useFeaturedPhotos();
  const { content, loadState: contentState } = useSiteContent();

  if (albumsState === 'loading' || contentState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p>Loading...</p>
      </div>
    );
  }

  if (albumsState === 'error' || contentState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center text-slate-600 px-4">
        <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
        <p className="mb-1">Something didn't load correctly.</p>
        <p className="text-sm text-slate-400">Please refresh the page, or try again shortly.</p>
      </div>
    );
  }

  const instagramDm = instagramDmUrl(content.contact?.instagram);

  return (
    <div className="min-h-screen bg-slate-50">
      <Hero
        photographerName={content.site?.photographerName}
        tagline={content.site?.tagline}
        backdropImage={content.site?.heroImage}
        instagramDm={instagramDm}
      />
      <FeaturedPhotos photos={featuredPhotos} />
      <BookingSection booking={content.booking} contactEmail={content.contact?.email} instagramDm={instagramDm} />
      <ContactSection contact={content.contact} />
    </div>
  );
};

export default LandingPage;
