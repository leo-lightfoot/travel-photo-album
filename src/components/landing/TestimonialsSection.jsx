import React from 'react';
import { Quote } from 'lucide-react';

const TestimonialsSection = ({ testimonials }) => {
  if (!testimonials || testimonials.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-20">
      <h2 className="text-3xl font-light text-slate-800 mb-10 text-center">What Clients Say</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {testimonials.map((t) => (
          <div key={t.id} className="bg-white rounded-xl shadow-md p-6 flex flex-col">
            <Quote className="w-6 h-6 text-slate-300 mb-3" />
            <p className="text-slate-700 mb-4 flex-1">{t.quote}</p>
            <div>
              <p className="text-slate-800 font-medium">{t.name}</p>
              {t.context && <p className="text-slate-500 text-sm">{t.context}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TestimonialsSection;
