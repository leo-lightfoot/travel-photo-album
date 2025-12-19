import React, { useState } from 'react'
import { format } from 'date-fns'
import { MapPin, Calendar, X, Globe } from 'lucide-react'

export default function TimelineView({ pins }) {
  const [selectedPin, setSelectedPin] = useState(null)

  // Group pins by year and month
  const groupedPins = pins.reduce((acc, pin) => {
    const date = new Date(pin.photo_date)
    const yearMonth = format(date, 'MMMM yyyy')
    
    if (!acc[yearMonth]) {
      acc[yearMonth] = []
    }
    acc[yearMonth].push(pin)
    return acc
  }, {})

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {Object.entries(groupedPins).map(([period, periodPins]) => (
          <div key={period} className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 sticky top-0 bg-gray-50 py-2 z-10">
              {period}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {periodPins.map((pin) => (
                <div
                  key={pin.id}
                  onClick={() => setSelectedPin(pin)}
                  className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="relative h-64 overflow-hidden">
                    <img
                      src={pin.thumb_url || pin.media_url}
                      alt={pin.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      onContextMenu={(e) => e.preventDefault()}
                    />
                    {/* Location badge overlay */}
                    {pin.city && pin.country && (
                      <div className="absolute top-3 left-3">
                        <div className="location-badge">
                          <MapPin className="w-3 h-3" />
                          <span>{pin.city}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
                      {pin.title}
                    </h3>

                    {pin.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {pin.description}
                      </p>
                    )}

                    {/* Location - More prominent */}
                    {pin.city && pin.country && (
                      <div className="mb-3 pb-3 border-b border-gray-100">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-gray-900 text-sm">
                              {pin.city}, {pin.country}
                            </div>
                            {pin.latitude && pin.longitude && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                <Globe className="w-3 h-3" />
                                <span>
                                  {pin.latitude.toFixed(4)}°, {pin.longitude.toFixed(4)}°
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Date */}
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                      <Calendar className="w-3 h-3" />
                      <span>{format(new Date(pin.photo_date), 'MMM d, yyyy')}</span>
                    </div>

                    {/* Tags */}
                    {pin.tags && pin.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {pin.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-primary-50 text-primary-600 rounded text-xs"
                          >
                            #{tag}
                          </span>
                        ))}
                        {pin.tags.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                            +{pin.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Pin Modal */}
      {selectedPin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="relative">
              <img
                src={selectedPin.media_url}
                alt={selectedPin.title}
                className="w-full h-[500px] object-contain bg-black"
                onContextMenu={(e) => e.preventDefault()}
              />
              <button
                onClick={() => setSelectedPin(null)}
                className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-96 custom-scrollbar">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedPin.title}
              </h2>

              {selectedPin.description && (
                <p className="text-gray-600 mb-4">{selectedPin.description}</p>
              )}

              {/* Location Section - Enhanced */}
              {selectedPin.city && selectedPin.country && (
                <div className="mb-4 p-3 bg-primary-50 rounded-lg border border-primary-100">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {selectedPin.city}, {selectedPin.country}
                      </div>
                      {selectedPin.latitude && selectedPin.longitude && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                          <Globe className="w-4 h-4" />
                          <span className="font-mono">
                            {selectedPin.latitude.toFixed(6)}°, {selectedPin.longitude.toFixed(6)}°
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Date */}
              {selectedPin.photo_date && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(selectedPin.photo_date), 'MMMM d, yyyy')}</span>
                </div>
              )}

              {/* Tags */}
              {selectedPin.tags && selectedPin.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedPin.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}