import React, { useState, useEffect } from 'react'
import { Map, Calendar, LogOut, Plus, MapPin, Search, Image as ImageIcon } from 'lucide-react'
import LoginPage from './components/LoginPage'
import MapView from './components/MapView'
import TimelineView from './components/TimelineView'
import UploadModal from './components/UploadModal'
import SearchBar from './components/SearchBar'
import { supabase } from './lib/supabase'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentView, setCurrentView] = useState('map')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [pins, setPins] = useState([])
  const [filteredPins, setFilteredPins] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const password = sessionStorage.getItem('travel_album_auth')
    const correctPassword = import.meta.env.VITE_APP_PASSWORD || 'travelpass123'
    
    if (password === correctPassword) {
      setIsAuthenticated(true)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchPins()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPins(pins)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = pins.filter(pin => {
      return (
        pin.title?.toLowerCase().includes(query) ||
        pin.description?.toLowerCase().includes(query) ||
        pin.city?.toLowerCase().includes(query) ||
        pin.country?.toLowerCase().includes(query) ||
        pin.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    })
    
    setFilteredPins(filtered)
  }, [searchQuery, pins])

  const fetchPins = async () => {
    try {
      setLoading(true)
      console.log('Fetching pins from Supabase...')
      
      const { data, error } = await supabase
        .from('travel_pins_with_coords')
        .select('*')
        .order('photo_date', { ascending: false })
  
      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
  
      console.log('Fetched data:', data)
      console.log('Number of pins:', data?.length || 0)
  
      if (data && data.length > 0) {
        console.log('Sample pin:', data[0])
        console.log('First pin coordinates:', { 
          lat: data[0].latitude, 
          lng: data[0].longitude 
        })
      }
  
      setPins(data || [])
      setFilteredPins(data || [])
    } catch (error) {
      console.error('Error fetching pins:', error)
      alert('Failed to load photos. Check console.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = (password) => {
    const correctPassword = import.meta.env.VITE_APP_PASSWORD || 'travelpass123'
    
    if (password === correctPassword) {
      sessionStorage.setItem('travel_album_auth', password)
      setIsAuthenticated(true)
      return true
    }
    return false
  }

  const handleLogout = () => {
    sessionStorage.removeItem('travel_album_auth')
    setIsAuthenticated(false)
  }

  const handleUploadSuccess = () => {
    setShowUploadModal(false)
    fetchPins()
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <MapPin className="w-8 h-8 text-primary-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Travel Album</h1>
                <p className="text-xs text-gray-500">{pins.length} memories</p>
              </div>
            </div>

            <div className="flex-1 max-w-xl mx-8">
              <SearchBar 
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by location, title, or tags..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Photos</span>
              </button>

              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* View Toggle */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 py-2">
            <button
              onClick={() => setCurrentView('map')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                currentView === 'map'
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Map className="w-4 h-4" />
              <span>Map View</span>
            </button>

            <button
              onClick={() => setCurrentView('timeline')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                currentView === 'timeline'
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Timeline</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your memories...</p>
            </div>
          </div>
        ) : filteredPins.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              {searchQuery ? (
                <>
                  <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">No results found</h2>
                  <p className="text-gray-600 mb-6">
                    Try adjusting your search terms or clear the search to see all photos.
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Clear Search
                  </button>
                </>
              ) : (
                <>
                  <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">No photos yet</h2>
                  <p className="text-gray-600 mb-6">
                    Start building your travel album by adding your first photos!
                  </p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors mx-auto"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Your First Photo</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : currentView === 'map' ? (
          <MapView pins={filteredPins} />
        ) : (
          <TimelineView pins={filteredPins} />
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  )
}

export default App