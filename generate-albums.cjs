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
const sharp = require('sharp');
const { execFileSync } = require('child_process');

// Configuration
const CONFIG = {
  photosDir: './photos',
  outputFile: './public/albums.json',
  r2BaseUrl: 'https://pub-bfb0a434dd5f45b1917f3071b9e609e8.r2.dev', // UPDATE THIS with your R2 public URL
  supportedFormats: ['.jpg', '.jpeg', '.png', '.webp'],
  r2BucketName: 'photo-gallery',
  maxDimension: 2000,
  sizeThresholdBytes: 1.5 * 1024 * 1024, // only resize/recompress above this
  jpegQuality: 82
};

const UPLOAD_MANIFEST_PATH = path.join(__dirname, '.r2-upload-manifest.json');
const NPX_CMD = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function loadUploadManifest() {
  try {
    return JSON.parse(fs.readFileSync(UPLOAD_MANIFEST_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveUploadManifest(manifest) {
  fs.writeFileSync(UPLOAD_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

const uploadManifest = loadUploadManifest();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Windows occasionally holds a brief lock on a just-written file (antivirus,
// thumbnail generation, OneDrive/cloud sync), which makes the rename below
// fail with EPERM even though nothing is wrong -- retrying after a short
// wait clears it almost every time.
async function renameWithRetry(src, dest, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      fs.renameSync(src, dest);
      return;
    } catch (err) {
      if (err.code !== 'EPERM' || i === attempts - 1) throw err;
      await sleep(300 * (i + 1));
    }
  }
}

// Resizes/recompresses in place (overwrites the file in photos/) only when
// it's actually oversized -- an already-small image is left untouched so
// re-running this doesn't re-encode it every time. Writes to a .tmp file
// first and renames over the original, since sharp can't read and write
// the same path in one pipeline.
async function optimizeImageInPlace(filePath) {
  const stat = fs.statSync(filePath);
  const meta = await sharp(filePath).metadata();
  const longestEdge = Math.max(meta.width || 0, meta.height || 0);
  const needsResize = longestEdge > CONFIG.maxDimension;
  const needsCompress = stat.size > CONFIG.sizeThresholdBytes;
  if (!needsResize && !needsCompress) return false;

  const ext = path.extname(filePath).toLowerCase();
  let pipeline = sharp(filePath).rotate(); // bake in EXIF orientation before resizing
  if (needsResize) {
    pipeline = pipeline.resize({
      width: CONFIG.maxDimension,
      height: CONFIG.maxDimension,
      fit: 'inside',
      withoutEnlargement: true
    });
  }
  if (ext === '.png') {
    pipeline = pipeline.png({ quality: CONFIG.jpegQuality });
  } else if (ext === '.webp') {
    pipeline = pipeline.webp({ quality: CONFIG.jpegQuality });
  } else {
    pipeline = pipeline.jpeg({ quality: CONFIG.jpegQuality, mozjpeg: true });
  }

  const tmpPath = `${filePath}.tmp`;
  await pipeline.toFile(tmpPath);
  await renameWithRetry(tmpPath, filePath);
  return true;
}

function contentTypeFor(ext) {
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

// Uploads straight to R2 via the wrangler CLI (already authenticated for
// deploy -- no separate R2 API credentials needed). Skips files whose
// size+mtime fingerprint hasn't changed since the last successful upload,
// so re-running this after adding one new album doesn't re-upload every
// album that's already live.
function uploadIfChanged(localPath, r2Key) {
  const stat = fs.statSync(localPath);
  const fingerprint = `${stat.size}-${Math.round(stat.mtimeMs)}`;
  if (uploadManifest[r2Key] === fingerprint) return false;

  console.log(`   ⬆️  Uploading ${r2Key}`);
  execFileSync(NPX_CMD, [
    'wrangler', 'r2', 'object', 'put', `${CONFIG.r2BucketName}/${r2Key}`,
    '--file', localPath,
    '--remote',
    '--content-type', contentTypeFor(path.extname(localPath).toLowerCase())
  ], { stdio: 'inherit', shell: true });

  uploadManifest[r2Key] = fingerprint;
  saveUploadManifest(uploadManifest); // persist immediately so a later failure doesn't lose this
  return true;
}

async function optimizeAndUploadAlbum(albumPath, albumFolder, r2BasePath, images) {
  for (const img of images) {
    const localPath = path.join(albumPath, img);
    const resized = await optimizeImageInPlace(localPath);
    if (resized) console.log(`   🗜️  Resized/compressed ${img}`);
    uploadIfChanged(localPath, `${r2BasePath}/${albumFolder}/${img}`);
  }
}

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

// Only the folder name is mandatory -- every other prompt below can be left
// blank. If the name prompt is skipped too, fall back to a readable version
// of the folder name instead of baking an empty string into albums.json.
function defaultAlbumName(folderName) {
  return folderName.replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
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

  await optimizeAndUploadAlbum(albumPath, albumFolder, r2BasePath, images);

  // Interactive prompts for missing metadata -- only the album name falls
  // back to something non-blank (the folder name) if skipped. Description,
  // category, and date are genuinely optional: if left blank they're left
  // out of albums.json entirely rather than stored as "", so the frontend
  // never has to render an empty field or an "Invalid Date".
  const nameAnswer = (metadata.name || await question(`   Album name (blank = "${defaultAlbumName(albumFolder)}"): `)).trim();
  const name = nameAnswer || defaultAlbumName(albumFolder);
  const description = (metadata.description || await question(`   Description (optional): `)).trim();
  const category = (metadata.category || await question(`   Category (optional, e.g., Weddings, Family, Corporate): `)).trim();
  const dateStr = (metadata.date || await question(`   Date (optional, YYYY-MM-DD): `)).trim();

  let secretCode = null;
  if (isPrivate) {
    secretCode = metadata.secretCode || await question(`   Secret code (for private access): `);
  }

  // Generate photo entries
  const featuredPhotos = metadata.featuredPhotos || [];
  const photos = images.map((img, idx) => {
    return {
      url: `${CONFIG.r2BaseUrl}/${r2BasePath}/${albumFolder}/${img}`,
      caption: metadata.captions?.[img] || `Photo ${idx + 1}`,
      ...(dateStr && { date: dateStr }),
      ...(featuredPhotos.includes(img) && { featured: true })
    };
  });

  const album = {
    id: generateAlbumId(albumFolder),
    name,
    coverImage: coverUrl,
    photoCount: images.length,
    photos,
    ...(description && { description }),
    ...(dateStr && { date: dateStr }),
    ...(category && { category })
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
  console.log('  2. Commit + push (photos are already uploaded to R2)');

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
    featuredPhotos: ["IMG_001.jpg"],
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