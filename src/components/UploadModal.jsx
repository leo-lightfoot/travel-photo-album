import React, { useState, useRef, useEffect } from 'react'
import { X, Upload, Loader } from 'lucide-react'
import { supabase, reverseGeocode } from '../lib/supabase'
import maplibregl from 'maplibre-gl'

export default function UploadModal({ onClose, onSuccess }) {
  const [files, setFiles] = useState([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [uploading, setUploading] = useState(false)
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().split('T')[0])
  const [latitude, setLatitude] = useState(null)
  const [longitude, setLongitude] = useState(null)
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  
  const mapContainer = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)
  const fileInputRef = useRef(null)

  // Initialize map with delay to ensure container is rendered
  useEffect(() => {
    const initMap = () => {
      if (!mapContainer.current) {
        console.log('Map container not ready')
        return
      }

      if (map.current) {
        console.log('Map already initialized')
        return
      }

      console.log('Initializing upload modal map')

      try {
        map.current = new maplibregl.Map({
          container: mapContainer.current,
          style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${import.meta.env.VITE_MAPTILER_API_KEY}`,
          center: [0, 20],
          zoom: 2,
          minZoom: 1,
          maxZoom: 18,
          renderWorldCopies: false,
          // Mobile optimizations
          pitchWithRotate: false,
          dragRotate: false,
          touchZoomRotate: false
        })

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

        map.current.on('load', () => {
          console.log('Upload modal map loaded')
        })

        map.current.on('error', (e) => {
          console.error('Upload modal map error:', e)
        })

        map.current.on('click', async (e) => {
          const { lng, lat } = e.lngLat
          console.log('Map clicked:', { lat, lng })
          
          setLatitude(lat)
          setLongitude(lng)

          // Add or update marker
          if (marker.current) {
            marker.current.setLngLat([lng, lat])
          } else {
            // Create custom pin marker
            const el = document.createElement('div')
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
              filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
            `

            marker.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
              .setLngLat([lng, lat])
              .addTo(map.current)
          }

          // Reverse geocode
          const { city: geoCity, country: geoCountry } = await reverseGeocode(lat, lng)
          setCity(geoCity || '')
          setCountry(geoCountry || '')
        })
      } catch (error) {
        console.error('Failed to initialize map:', error)
      }
    }

    // Delay to ensure modal is fully rendered
    const timer = setTimeout(initMap, 300)

    return () => {
      clearTimeout(timer)
      if (map.current) {
        map.current.remove()
        map.current = null
      }
      if (marker.current) {
        marker.current = null
      }
    }
  }, [])

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    setFiles(selectedFiles)
    setCurrentFileIndex(0)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles(droppedFiles)
    setCurrentFileIndex(0)
  }

  const uploadCurrentPhoto = async () => {
    if (!files[currentFileIndex] || !latitude || !longitude || !title) {
      alert('Please fill in title and select a location on the map')
      return false
    }

    try {
      setUploading(true)
      const file = files[currentFileIndex]
      
      // Convert to base64 for MVP
      const reader = new FileReader()
      
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = reader.result
            
            // Insert into Supabase
            const { data, error } = await supabase
              .from('travel_pins')
              .insert([{
                title,
                description: description || null,
                tags: tags ? tags.split(',').map(t => t.trim()) : [],
                media_url: base64,
                thumb_url: base64,
                photo_date: photoDate,
                location: `POINT(${longitude} ${latitude})`,
                city: city || null,
                country: country || null,
              }])

            if (error) throw error

            console.log('Photo uploaded successfully')
            resolve(true)
          } catch (err) {
            console.error('Upload error:', err)
            reject(err)
          } finally {
            setUploading(false)
          }
        }

        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload photo: ' + error.message)
      setUploading(false)
      return false
    }
  }

  const handleNext = async () => {
    const success = await uploadCurrentPhoto()
    
    if (success) {
      if (currentFileIndex < files.length - 1) {
        // Move to next photo
        setCurrentFileIndex(currentFileIndex + 1)
        resetForm()
      } else {
        // All photos uploaded
        onSuccess()
      }
    }
  }

  const handleSkip = () => {
    if (currentFileIndex < files.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1)
      resetForm()
    } else {
      onClose()
    }
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setTags('')
    setLatitude(null)
    setLongitude(null)
    setCity('')
    setCountry('')
    if (marker.current) {
      marker.current.remove()
      marker.current = null
    }
  }

  const currentFile = files[currentFileIndex]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Upload Photos</h2>
            {files.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Photo {currentFileIndex + 1} of {files.length}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(95vh-180px)] custom-scrollbar">
          {files.length === 0 ? (
            // File selection
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
            >
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Drop photos here or click to browse
              </h3>
              <p className="text-gray-500">
                Support for JPG, PNG, WEBP
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            // Upload form
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Photo preview */}
              <div>
                <div className="bg-gray-100 rounded-xl overflow-hidden mb-4">
                  <img
                    src={URL.createObjectURL(currentFile)}
                    alt="Preview"
                    className="w-full h-96 object-contain"
                  />
                </div>
                <p className="text-sm text-gray-600">{currentFile.name}</p>
              </div>

              {/* Right: Form */}
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g., Sunset at Eiffel Tower"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows="3"
                    placeholder="Add a description..."
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g., paris, sunset, architecture"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photo Date *
                  </label>
                  <input
                    type="date"
                    value={photoDate}
                    onChange={(e) => setPhotoDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location * (Click on map)
                  </label>
                  
                  {/* Manual coordinate inputs for testing */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="number"
                      step="0.000001"
                      value={latitude || ''}
                      onChange={(e) => {
                        const lat = parseFloat(e.target.value)
                        setLatitude(lat)
                        if (map.current && !isNaN(lat) && longitude) {
                          if (marker.current) {
                            marker.current.setLngLat([longitude, lat])
                          } else {
                            marker.current = new maplibregl.Marker({ color: '#0284c7' })
                              .setLngLat([longitude, lat])
                              .addTo(map.current)
                          }
                          map.current.setCenter([longitude, lat])
                        }
                      }}
                      placeholder="Latitude (e.g., 48.8566)"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      type="number"
                      step="0.000001"
                      value={longitude || ''}
                      onChange={(e) => {
                        const lng = parseFloat(e.target.value)
                        setLongitude(lng)
                        if (map.current && !isNaN(lng) && latitude) {
                          if (marker.current) {
                            marker.current.setLngLat([lng, latitude])
                          } else {
                            marker.current = new maplibregl.Marker({ color: '#0284c7' })
                              .setLngLat([lng, latitude])
                              .addTo(map.current)
                          }
                          map.current.setCenter([lng, latitude])
                        }
                      }}
                      placeholder="Longitude (e.g., 2.3522)"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div 
                    ref={mapContainer} 
                    className="rounded-lg border border-gray-300 bg-gray-100" 
                    style={{ height: '256px', width: '100%' }}
                  />
                  
                  {city && country && (
                    <p className="text-sm text-gray-600 mt-2">
                      📍 {city}, {country}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {files.length > 0 && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleSkip}
              disabled={uploading}
              className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              disabled={!title || !latitude || !longitude || uploading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {uploading && <Loader className="w-4 h-4 animate-spin" />}
              {currentFileIndex < files.length - 1 ? 'Next Photo' : 'Finish Upload'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}