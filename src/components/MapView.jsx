import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { X } from 'lucide-react'

export default function MapView({ pins }) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markers = useRef([])
  const [selectedPin, setSelectedPin] = useState(null)

  // Initialize map
  useEffect(() => {
    if (map.current) return // Map already initialized

    if (!mapContainer.current) {
      console.error('Map container ref is null')
      return
    }

    console.log('Initializing MapView map')

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://demotiles.maplibre.org/style.json',
        center: [0, 20],
        zoom: 2
      })

      map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

      map.current.on('load', () => {
        console.log('MapView map loaded successfully')
      })

      map.current.on('error', (e) => {
        console.error('MapView map error:', e)
      })
    } catch (error) {
      console.error('Failed to initialize MapView map:', error)
    }

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Update markers when pins change
  useEffect(() => {
    if (!map.current) return

    // Clear existing markers
    markers.current.forEach(marker => marker.remove())
    markers.current = []

    // Add markers for all pins
    pins.forEach(pin => {
      if (!pin.latitude || !pin.longitude) {
        console.warn('Pin missing coordinates:', pin)
        return
      }

      const el = document.createElement('div')
      el.className = 'custom-marker'
      el.style.cssText = `
        background-color: #0284c7;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: transform 0.2s;
      `
      
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)'
      })
      
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)'
      })

      el.addEventListener('click', () => {
        setSelectedPin(pin)
      })

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.longitude, pin.latitude])
        .addTo(map.current)

      markers.current.push(marker)
    })

    // Fit bounds to show all markers
    if (pins.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      pins.forEach(pin => {
        if (pin.latitude && pin.longitude) {
          bounds.extend([pin.longitude, pin.latitude])
        }
      })
      
      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, { 
          padding: 50, 
          maxZoom: 12,
          duration: 1000
        })
      }
    }
  }, [pins])

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapContainer} 
        className="absolute inset-0 w-full h-full"
        style={{ minHeight: '400px' }}
      />

      {/* Selected Pin Modal */}
      {selectedPin && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-10">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="relative">
              <img
                src={selectedPin.media_url}
                alt={selectedPin.title}
                className="w-full h-96 object-cover"
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
              
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                {selectedPin.city && selectedPin.country && (
                  <div>
                    📍 {selectedPin.city}, {selectedPin.country}
                  </div>
                )}
                
                {selectedPin.photo_date && (
                  <div>
                    📅 {new Date(selectedPin.photo_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              
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