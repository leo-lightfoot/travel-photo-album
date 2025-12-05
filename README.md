# Travel Photo Album

A modern, interactive web application for organizing and visualizing your travel memories. Upload photos with location data and view them on an interactive map or timeline.

## Features

- **Interactive Map View**: Visualize all your travel photos on an interactive map using MapLibre GL
- **Timeline View**: Browse your memories chronologically with detailed information
- **Photo Upload**: Easily upload photos with metadata including:
  - Title and description
  - Location (city, country with coordinates)
  - Date taken
  - Custom tags
- **Search & Filter**: Search photos by location, title, description, or tags
- **Password Protected**: Secure your personal album with password authentication
- **Responsive Design**: Beautiful UI built with Tailwind CSS that works on all devices

## Tech Stack

- **Frontend Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Database & Storage)
- **Maps**: MapLibre GL
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Supabase account and project

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd travel-photo-album
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**

   Create a `.env` file in the root directory with the following variables:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_APP_PASSWORD=your_custom_password
   ```

4. **Set up Supabase**

   Create a table named `travel_pins_with_coords` in your Supabase database with the following schema:
   - `id` (uuid, primary key)
   - `title` (text)
   - `description` (text)
   - `city` (text)
   - `country` (text)
   - `latitude` (float)
   - `longitude` (float)
   - `photo_date` (timestamp)
   - `photo_url` (text)
   - `tags` (text array)
   - `created_at` (timestamp)

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**

   Navigate to `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Usage

1. **Login**: Enter the password configured in your environment variables
2. **Upload Photos**: Click the "Add Photos" button to upload new travel memories
3. **View on Map**: See all your photos pinned to their locations on an interactive map
4. **Browse Timeline**: Switch to timeline view to browse photos chronologically
5. **Search**: Use the search bar to filter photos by location, title, or tags

## Project Structure

```
travel-photo-album/
├── src/
│   ├── components/
│   │   ├── LoginPage.jsx       # Password authentication
│   │   ├── MapView.jsx          # Interactive map display
│   │   ├── TimelineView.jsx    # Chronological photo timeline
│   │   ├── UploadModal.jsx     # Photo upload interface
│   │   └── SearchBar.jsx       # Search functionality
│   ├── lib/
│   │   └── supabase.js         # Supabase client configuration
│   ├── App.jsx                 # Main application component
│   └── main.jsx                # Application entry point
├── public/                     # Static assets
└── package.json               # Project dependencies
```

## License

This project is open source and available under the MIT License.
