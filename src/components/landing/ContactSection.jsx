import React from 'react';
import { Mail, Phone, Instagram, MapPin } from 'lucide-react';

const ContactSection = ({ contact }) => {
  if (!contact) return null;

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-light text-white mb-8">Contact</h2>
        <div className="flex flex-wrap justify-center gap-6 text-sm">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-white transition">
              <Mail className="w-4 h-4" />
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:text-white transition">
              <Phone className="w-4 h-4" />
              {contact.phone}
            </a>
          )}
          {contact.instagram && (
            <a
              href={contact.instagram}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 hover:text-white transition"
            >
              <Instagram className="w-4 h-4" />
              Instagram
            </a>
          )}
          {contact.location && (
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {contact.location}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
};

export default ContactSection;
