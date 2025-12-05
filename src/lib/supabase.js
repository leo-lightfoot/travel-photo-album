import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const reverseGeocode = async (lat, lon) => {
  try {
    console.log('Reverse geocoding:', { lat, lon })
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
      {
        headers: { 
          'User-Agent': 'TravelPhotoAlbum/1.0',
          'Accept-Language': 'en'
        }
      }
    )
    
    if (!response.ok) {
      throw new Error(`Geocoding HTTP error: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('Geocoding response:', data)
    
    const city = data.address?.city || 
                 data.address?.town || 
                 data.address?.village ||
                 data.address?.county ||
                 null
    
    const country = data.address?.country || null
    
    console.log('Extracted location:', { city, country })
    
    return { city, country }
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return { city: null, country: null }
  }
}