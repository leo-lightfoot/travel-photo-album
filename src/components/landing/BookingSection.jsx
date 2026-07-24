import React from 'react';
import { CalendarCheck } from 'lucide-react';

const BookingSection = ({ booking, contactEmail }) => {
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
        {contactEmail && (
          <div>
            <a
              href={`mailto:${contactEmail}`}
              className="inline-block bg-slate-800 text-white px-8 py-3 rounded-full font-medium hover:bg-slate-700 transition"
            >
              Get in Touch
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default BookingSection;
