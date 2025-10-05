#!/usr/bin/env node

/**
 * Album JSON Generator
 * Scans a local folder structure and generates albums.json for your photo gallery
 * 
 * Usage:
 * node generate-albums.js
 * 
 * Expected folder structure:
 * photos/
 *   public/
 *     wedding-2024/
 *       IMG_001.jpg
 *       IMG_002.jpg
 *       album-info.json (optional metadata)
 *     corporate-event/
 *       ...
 *   private/
 *     family-reunion/
 *       IMG_001.jpg
 *       album-info.json (must include secretCode)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CONFIG = {
  photosDir: './photos',
  outputFile: './public/albums.json',
  r2BaseUrl: 'https://pub-bfb0a434dd5f45b1917f3071b9e609e8.r2.dev', // UPDATE THIS with your R2 public URL
  supportedFormats: ['.jpg', '.jpeg', '.png', '.webp']
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return CONFIG.supportedFormats.includes(ext);
}

function getImageFiles(dirPath) {
  try {
    return fs.readdirSync(dirPath)
      .filter(file => isImageFile(file))
      .sort();
  } catch (err) {
    return [];
  }
}

function loadAlbumMetadata(albumPath) {
  const metadataPath = path.join(albumPath, 'album-info.json');
  if (fs.existsSync(metadataPath)) {
    try {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch (err) {
      console.error(`Error reading metadata for ${albumPath}:`, err.message);
    }
  }
  return {};
}

function generateAlbumId(folderName) {
  return folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function getImageMetadata(imagePath) {
  const stats = fs.statSync(imagePath);
  return {
    modified: stats.mtime,
    size: stats.size
  };
}

async function processAlbum(albumPath, albumFolder, isPrivate, r2BasePath) {
  const metadata = loadAlbumMetadata(albumPath);
  const images = getImageFiles(albumPath);
  
  if (images.length === 0) {
    console.log(`⚠️  Skipping ${albumFolder} - no images found`);
    return null;
  }

  // Find cover image
  const coverImage = metadata.coverImage || images[0];
  const coverUrl = `${CONFIG.r2BaseUrl}/${r2BasePath}/${albumFolder}/${coverImage}`;

  console.log(`\n📁 Processing: ${albumFolder}`);
  console.log(`   Found ${images.length} images`);

  // Interactive prompts for missing metadata
  const name = metadata.name || await question(`   Album name: `);
  const description = metadata.description || await question(`   Description: `);
  const category = metadata.category || await question(`   Category (e.g., Weddings, Family, Corporate): `);
  const dateStr = metadata.date || await question(`   Date (YYYY-MM-DD): `);
  
  let secretCode = null;
  if (isPrivate) {
    secretCode = metadata.secretCode || await question(`   Secret code (for private access): `);
  }

  // Generate photo entries
  const photos = images.map((img, idx) => {
    const imgPath = path.join(albumPath, img);
    const imgMetadata = getImageMetadata(imgPath);
    
    return {
      url: `${CONFIG.r2BaseUrl}/${r2BasePath}/${albumFolder}/${img}`,
      caption: metadata.captions?.[img] || `Photo ${idx + 1}`,
      date: dateStr
    };
  });

  const album = {
    id: generateAlbumId(albumFolder),
    name,
    description,
    coverImage: coverUrl,
    date: dateStr,
    category,
    photoCount: images.length,
    photos
  };

  if (isPrivate) {
    album.secretCode = secretCode;
    album.tags = metadata.tags || [];
  }

  return album;
}

async function generateAlbumsJson() {
  console.log('🎨 Photo Gallery - Album JSON Generator\n');
  console.log('=' .repeat(50));

  // Check if photos directory exists
  if (!fs.existsSync(CONFIG.photosDir)) {
    console.error(`❌ Photos directory not found: ${CONFIG.photosDir}`);
    console.log('\nExpected structure:');
    console.log('  photos/');
    console.log('    public/');
    console.log('      album-name/');
    console.log('        IMG_001.jpg');
    console.log('    private/');
    console.log('      album-name/');
    console.log('        IMG_001.jpg');
    process.exit(1);
  }

  // Check R2 URL
  if (CONFIG.r2BaseUrl.includes('xxxxx')) {
    console.log('\n⚠️  Warning: Please update R2_BASE_URL in this script!');
    const url = await question('Enter your R2 public URL: ');
    CONFIG.r2BaseUrl = url.trim();
  }

  const result = {
    public: [],
    private: []
  };

  // Process public albums
  const publicDir = path.join(CONFIG.photosDir, 'public');
  if (fs.existsSync(publicDir)) {
    const folders = fs.readdirSync(publicDir).filter(f => {
      return fs.statSync(path.join(publicDir, f)).isDirectory();
    });

    console.log(`\n📂 Found ${folders.length} public album(s)\n`);
    
    for (const folder of folders) {
      const albumPath = path.join(publicDir, folder);
      const album = await processAlbum(albumPath, folder, false, 'public');
      if (album) result.public.push(album);
    }
  }

  // Process private albums
  const privateDir = path.join(CONFIG.photosDir, 'private');
  if (fs.existsSync(privateDir)) {
    const folders = fs.readdirSync(privateDir).filter(f => {
      return fs.statSync(path.join(privateDir, f)).isDirectory();
    });

    console.log(`\n🔒 Found ${folders.length} private album(s)\n`);
    
    for (const folder of folders) {
      const albumPath = path.join(privateDir, folder);
      const album = await processAlbum(albumPath, folder, true, 'private');
      if (album) result.private.push(album);
    }
  }

  // Save albums.json
  const outputDir = path.dirname(CONFIG.outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    CONFIG.outputFile,
    JSON.stringify(result, null, 2),
    'utf8'
  );

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Generated: ${CONFIG.outputFile}`);
  console.log(`   Public albums: ${result.public.length}`);
  console.log(`   Private albums: ${result.private.length}`);
  console.log(`   Total photos: ${result.public.reduce((sum, a) => sum + a.photoCount, 0) + result.private.reduce((sum, a) => sum + a.photoCount, 0)}`);
  console.log('\nNext steps:');
  console.log('  1. Review albums.json');
  console.log('  2. Upload photos to R2 (same folder structure)');
  console.log('  3. Deploy site: npm run build');
  
  rl.close();
}

// Example album-info.json structure
function printExampleMetadata() {
  const example = {
    name: "Sarah & John Wedding",
    description: "A beautiful celebration of love in Tuscany",
    category: "Weddings",
    date: "2024-06-15",
    coverImage: "IMG_001.jpg",
    tags: ["wedding", "tuscany", "summer"],
    secretCode: "WEDDING2024",
    captions: {
      "IMG_001.jpg": "The ceremony",
      "IMG_002.jpg": "First dance",
      "IMG_003.jpg": "Cake cutting"
    }
  };

  console.log('\n📝 Optional: Create album-info.json in each album folder to pre-fill metadata:\n');
  console.log(JSON.stringify(example, null, 2));
}

// Run
if (require.main === module) {
  if (process.argv.includes('--help')) {
    console.log('Usage: node generate-albums.js');
    console.log('\nOptions:');
    console.log('  --help     Show this help message');
    console.log('  --example  Show example album-info.json structure');
    process.exit(0);
  }

  if (process.argv.includes('--example')) {
    printExampleMetadata();
    process.exit(0);
  }

  generateAlbumsJson().catch(err => {
    console.error('Error:', err);
    rl.close();
    process.exit(1);
  });
}