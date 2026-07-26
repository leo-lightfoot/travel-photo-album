import React from 'react';
import { CalendarCheck, Instagram } from 'lucide-react';

const BookingSection = ({ booking, contactEmail, instagramDm }) => {
  if (!booking) return null;

  return (
    <section className="bg-white border-y border-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="flex justify-center mb-4">
          <CalendarCheck className="w-8 h-8 text-slate-700" />
        </div>
        <h2 className="text-3xl font-light text-slate-800 mb-4">{booking.headline}</h2>
        <p className="text-slate-600 mb-6 leading-relaxed">{booking.body}</p>
        {booking.availabilityNote && (
          <p className="text-sm text-amber-700 bg-amber-50 inline-block px-4 py-2 rounded-full mb-8">
            {booking.availabilityNote}
          </p>
        )}
        {(contactEmail || instagramDm) && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {contactEmail && (
              <a
                href={`mailto:${contactEmail}`}
                className="inline-block bg-slate-800 text-white px-8 py-3 rounded-full font-medium hover:bg-slate-700 transition"
              >
                Get in Touch
              </a>
            )}
            {instagramDm && (
              <a
                href={instagramDm}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border border-slate-300 text-slate-800 px-8 py-3 rounded-full font-medium hover:bg-slate-50 transition"
              >
                <Instagram className="w-4 h-4" />
                Message on Instagram
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default BookingSection;
