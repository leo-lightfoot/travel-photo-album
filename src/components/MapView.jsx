import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import Supercluster from 'supercluster'
import { X } from 'lucide-react'

export default function MapView({ pins }) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markers = useRef([])
  const supercluster = useRef(null)
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
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${import.meta.env.VITE_MAPTILER_API_KEY}`,
        center: [0, 20],
        zoom: 2,
        minZoom: 1, // Prevent zooming out too far
        maxZoom: 18, // Allow zooming in close
        renderWorldCopies: false, // Prevent map repetition
        // Smooth animations
        pitchWithRotate: false,
        dragRotate: false,
        touchZoomRotate: false,
        // Performance and smoothness
        antialias: true,
        fadeDuration: 300,
        // Better user experience
        doubleClickZoom: true,
        scrollZoom: { around: 'center' }
      })

      map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

      map.current.on('load', () => {
        console.log('MapView map loaded successfully')
      })

      map.current.on('error', (e) => {
        console.error('MapView map error:', e)
      })

      // Update markers when zoom/pan changes
      map.current.on('moveend', updateMarkers)
      map.current.on('zoomend', updateMarkers)
    } catch (error) {
      console.error('Failed to initialize MapView map:', error)
    }

    // Cleanup
    return () => {
      if (map.current) {
        map.current.off('moveend', updateMarkers)
        map.current.off('zoomend', updateMarkers)
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Initialize clustering when pins change
  useEffect(() => {
    if (!map.current || pins.length === 0) return

    // Convert pins to GeoJSON features
    const features = pins
      .filter(pin => pin.latitude && pin.longitude)
      .map(pin => ({
        type: 'Feature',
        properties: { pinData: pin },
        geometry: {
          type: 'Point',
          coordinates: [pin.longitude, pin.latitude]
        }
      }))

    // Initialize supercluster
    supercluster.current = new Supercluster({
      radius: 80, // Cluster radius in pixels
      maxZoom: 16, // Max zoom to cluster points on
      minPoints: 2 // Minimum points to form a cluster
    })

    supercluster.current.load(features)

    // Update markers for current view
    updateMarkers()

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

  // Function to update markers based on current view
  const updateMarkers = () => {
    if (!map.current || !supercluster.current) return

    // Clear existing markers
    markers.current.forEach(marker => marker.remove())
    markers.current = []

    // Get current map bounds
    const bounds = map.current.getBounds()
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ]

    // Get clusters for current zoom and bounds
    const zoom = map.current.getZoom()
    const clusters = supercluster.current.getClusters(bbox, Math.floor(zoom))

    // Add markers for clusters and individual points
    clusters.forEach(cluster => {
      const [longitude, latitude] = cluster.geometry.coordinates
      const { cluster: isCluster, point_count } = cluster.properties

      if (isCluster) {
        // Create cluster marker
        const el = document.createElement('div')
        el.className = 'cluster-marker'
        el.innerHTML = `
          <div style="
            width: ${40 + (Math.min(point_count, 100) / 100) * 20}px;
            height: ${40 + (Math.min(point_count, 100) / 100) * 20}px;
            border-radius: 50%;
            background-color: #0284c7;
            border: 3px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: ${point_count > 99 ? '12px' : '14px'};
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: transform 0.2s;
          ">${point_count}</div>
        `

        el.addEventListener('mouseenter', () => {
          el.querySelector('div').style.transform = 'scale(1.1)'
        })

        el.addEventListener('mouseleave', () => {
          el.querySelector('div').style.transform = 'scale(1)'
        })

        el.addEventListener('click', () => {
          const expansionZoom = Math.min(
            supercluster.current.getClusterExpansionZoom(cluster.id),
            18
          )
          map.current.easeTo({
            center: [longitude, latitude],
            zoom: expansionZoom,
            duration: 800,
            easing: (t) => t * (2 - t) // Smooth ease-out curve
          })
        })

        const marker = new maplibregl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat([longitude, latitude])
          .addTo(map.current)

        markers.current.push(marker)
      } else {
        // Create individual pin marker
        const pin = cluster.properties.pinData
        const el = document.createElement('div')
        el.className = 'custom-marker'
        el.innerHTML = `
          <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="16" cy="40" rx="6" ry="2" fill="rgba(0,0,0,0.2)"/>
            <path d="M16 0C9.373 0 4 5.373 4 12c0 8.25 12 30 12 30s12-21.75 12-30c0-6.627-5.373-12-12-12z"
                  fill="#0284c7" stroke="white" stroke-width="2"/>
            <circle cx="16" cy="12" r="5" fill="white"/>
            <circle cx="16" cy="12" r="3" fill="#0284c7"/>
          </svg>
        `
        el.style.cssText = `
          width: 32px;
          height: 42px;
          cursor: pointer;
          transition: transform 0.2s ease-out;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
        `

        // Create tooltip popup
        const tooltipContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px 0;">
            <div style="font-weight: 600; font-size: 13px; color: #1f2937; margin-bottom: 2px;">
              ${pin.title}
            </div>
            ${pin.city && pin.country ? `
              <div style="font-size: 11px; color: #6b7280; display: flex; align-items: center; gap: 4px;">
                <span>📍</span>
                <span>${pin.city}, ${pin.country}</span>
              </div>
            ` : ''}
          </div>
        `

        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: [0, -42],
          className: 'marker-tooltip'
        }).setHTML(tooltipContent)

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.2)'
          popup.addTo(map.current)
        })

        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)'
          popup.remove()
        })

        el.addEventListener('click', () => {
          setSelectedPin(pin)
        })

        const marker = new maplibregl.Marker({
          element: el,
          anchor: 'bottom'
        })
          .setLngLat([longitude, latitude])
          .setPopup(popup)
          .addTo(map.current)

        markers.current.push(marker)
      }
    })
  }

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