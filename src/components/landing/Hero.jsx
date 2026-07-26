import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Instagram } from 'lucide-react';

const Hero = ({ photographerName, tagline, backdropImage, instagramDm }) => (
  <section className="relative overflow-hidden bg-slate-900 text-white">
    {backdropImage && (
      <>
        <img
          src={backdropImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-55"
          draggable="false"
          onContextMenu={(e) => e.preventDefault()}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-slate-900/20" />
      </>
    )}
    <div className="relative max-w-5xl mx-auto px-4 py-32 md:py-44 text-center">
      <div className="flex justify-center mb-6">
        <Camera className="w-10 h-10 text-white/80" />
      </div>
      <h1 className={`text-4xl md:text-6xl font-light tracking-tight ${tagline ? 'mb-4' : 'mb-10'}`}>
        {photographerName}
      </h1>
      {tagline && (
        <p className="text-lg md:text-xl text-slate-200 font-light mb-10 max-w-2xl mx-auto">
          {tagline}
        </p>
      )}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          to="/galleries"
          className="inline-flex items-center gap-2 bg-white text-slate-900 px-8 py-4 rounded-full text-lg font-medium hover:bg-slate-100 transition shadow-lg"
        >
          View Galleries
          <ArrowRight className="w-5 h-5" />
        </Link>
        {instagramDm && (
          <a
            href={instagramDm}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 border border-white/50 text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-white/10 transition"
          >
            <Instagram className="w-5 h-5" />
            Message
          </a>
        )}
      </div>
    </div>
  </section>
);

export default Hero;
