#!/usr/bin/env node

/**
 * Album pipeline: resizes/uploads photos to R2, then upserts album + photo
 * rows into D1. Descriptions, categories, and per-photo captions are edited
 * afterward on the live site's /admin page (Cloudflare Access-protected) --
 * this script only ever *seeds* those fields on first insert and never
 * overwrites them again, so admin edits survive re-running this.
 *
 * Usage:
 * node generate-albums.cjs
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
const os = require('os');
const sharp = require('sharp');
const { execFileSync } = require('child_process');

// Configuration
const CONFIG = {
  photosDir: './photos',
  r2BaseUrl: 'https://pub-bfb0a434dd5f45b1917f3071b9e609e8.r2.dev', // UPDATE THIS with your R2 public URL
  supportedFormats: ['.jpg', '.jpeg', '.png', '.webp'],
  r2BucketName: 'photo-gallery',
  d1DatabaseName: 'subscribers-db',
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

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

function sqlString(value) {
  return `'${sqlEscape(value)}'`;
}

// Runs a batch of SQL statements against D1 via the wrangler CLI (same
// already-authenticated pattern as the R2 uploads above -- no separate DB
// credentials needed). --local targets the dev-only D1 emulation instead of
// production, for testing this script/the admin page without touching real data.
const D1_TARGET_FLAG = process.argv.includes('--local') ? '--local' : '--remote';
function runD1Batch(sql) {
  const tmpFile = path.join(os.tmpdir(), `d1-batch-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmpFile, sql, 'utf8');
  try {
    execFileSync(NPX_CMD, [
      'wrangler', 'd1', 'execute', CONFIG.d1DatabaseName,
      D1_TARGET_FLAG, '--file', tmpFile
    ], { stdio: 'inherit', shell: true });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

// name/date/is_private/secret_code/tags/cover_image are owned by
// album-info.json and refreshed every run. description/category are seeded
// here only on first insert -- once an album exists, the admin page (D1) owns
// those two fields, so re-running this must never clobber an edit made there.
function buildAlbumUpsertSql({ id, name, description, category, dateStr, isPrivate, secretCode, tags, coverUrl }) {
  const secretCodeSql = secretCode ? sqlString(secretCode) : 'NULL';
  return `
INSERT INTO albums (id, name, description, category, date, is_private, secret_code, tags, cover_image, created_at)
VALUES (${sqlString(id)}, ${sqlString(name)}, ${sqlString(description)}, ${sqlString(category)}, ${sqlString(dateStr)}, ${isPrivate ? 1 : 0}, ${secretCodeSql}, ${sqlString(JSON.stringify(tags))}, ${sqlString(coverUrl)}, ${sqlString(new Date().toISOString())})
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  date = excluded.date,
  is_private = excluded.is_private,
  secret_code = excluded.secret_code,
  tags = excluded.tags,
  cover_image = excluded.cover_image;
`;
}

// caption/featured/tags are admin-owned (edited on /admin) and never
// touched again after a photo's first insert -- only sort_order/album_id
// refresh, in case the local file listing order or album placement changes.
function buildPhotoUpsertSql({ url, albumId, caption, featured, sortOrder }) {
  return `
INSERT INTO photos (url, album_id, caption, date, featured, tags, sort_order)
VALUES (${sqlString(url)}, ${sqlString(albumId)}, ${sqlString(caption)}, '', ${featured ? 1 : 0}, '[]', ${sortOrder})
ON CONFLICT(url) DO UPDATE SET
  album_id = excluded.album_id,
  sort_order = excluded.sort_order;
`;
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

// The folder name is the only mandatory input -- if album-info.json doesn't
// supply a name, fall back to a readable version of the folder name.
function defaultAlbumName(folderName) {
  return folderName.replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}

async function processAlbum(albumPath, albumFolder, isPrivate, r2BasePath) {
  const metadata = loadAlbumMetadata(albumPath);
  const images = getImageFiles(albumPath);

  if (images.length === 0) {
    console.log(`⚠️  Skipping ${albumFolder} - no images found`);
    return;
  }

  if (isPrivate && !metadata.secretCode) {
    console.log(`⚠️  Skipping ${albumFolder} - private album needs a secretCode in album-info.json`);
    return;
  }

  const coverImage = metadata.coverImage || images[0];
  const coverUrl = `${CONFIG.r2BaseUrl}/${r2BasePath}/${albumFolder}/${coverImage}`;

  console.log(`\n📁 Processing: ${albumFolder}`);
  console.log(`   Found ${images.length} images`);

  await optimizeAndUploadAlbum(albumPath, albumFolder, r2BasePath, images);

  const id = generateAlbumId(albumFolder);
  const name = (metadata.name || defaultAlbumName(albumFolder)).trim();
  const description = (metadata.description || '').trim();
  const category = (metadata.category || '').trim();
  const dateStr = (metadata.date || '').trim();
  const tags = isPrivate ? (metadata.tags || []) : [];

  let sql = buildAlbumUpsertSql({
    id, name, description, category, dateStr,
    isPrivate, secretCode: isPrivate ? metadata.secretCode : null, tags, coverUrl
  });

  const featuredPhotos = metadata.featuredPhotos || [];
  images.forEach((img, idx) => {
    sql += buildPhotoUpsertSql({
      url: `${CONFIG.r2BaseUrl}/${r2BasePath}/${albumFolder}/${img}`,
      albumId: id,
      caption: metadata.captions?.[img] || `Photo ${idx + 1}`,
      featured: featuredPhotos.includes(img),
      sortOrder: idx
    });
  });

  console.log(`   💾 Syncing to database`);
  runD1Batch(sql);
}

async function runPipeline() {
  console.log('🎨 Photo Gallery - Album Pipeline\n');
  console.log('='.repeat(50));

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

  if (CONFIG.r2BaseUrl.includes('xxxxx')) {
    console.error('❌ Set CONFIG.r2BaseUrl in generate-albums.cjs before running.');
    process.exit(1);
  }

  let publicCount = 0;
  const publicDir = path.join(CONFIG.photosDir, 'public');
  if (fs.existsSync(publicDir)) {
    const folders = fs.readdirSync(publicDir).filter(f => fs.statSync(path.join(publicDir, f)).isDirectory());
    console.log(`\n📂 Found ${folders.length} public album(s)\n`);
    for (const folder of folders) {
      await processAlbum(path.join(publicDir, folder), folder, false, 'public');
      publicCount++;
    }
  }

  let privateCount = 0;
  const privateDir = path.join(CONFIG.photosDir, 'private');
  if (fs.existsSync(privateDir)) {
    const folders = fs.readdirSync(privateDir).filter(f => fs.statSync(path.join(privateDir, f)).isDirectory());
    console.log(`\n🔒 Found ${folders.length} private album(s)\n`);
    for (const folder of folders) {
      await processAlbum(path.join(privateDir, folder), folder, true, 'private');
      privateCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Done -- ${publicCount} public, ${privateCount} private album folder(s) processed`);
  console.log('\nNext steps:');
  console.log('  1. Visit /admin to fill in descriptions, categories, and captions');
  console.log('  2. New albums/photos start blank -- nothing to commit, D1 is live immediately');
}

// Example album-info.json structure
function printExampleMetadata() {
  const example = {
    name: 'Sarah & John Wedding',
    description: 'A beautiful celebration of love in Tuscany (optional -- can also be set later on /admin)',
    category: 'Weddings',
    date: '2024-06-15',
    coverImage: 'IMG_001.jpg',
    tags: ['wedding', 'tuscany', 'summer'],
    secretCode: 'WEDDING2024',
    featuredPhotos: ['IMG_001.jpg'],
    captions: {
      'IMG_001.jpg': 'The ceremony (optional -- can also be set later on /admin)'
    }
  };

  console.log('\n📝 Optional: Create album-info.json in each album folder to pre-fill metadata:\n');
  console.log(JSON.stringify(example, null, 2));
}

// Run
if (require.main === module) {
  if (process.argv.includes('--help')) {
    console.log('Usage: node generate-albums.cjs');
    console.log('\nOptions:');
    console.log('  --help     Show this help message');
    console.log('  --example  Show example album-info.json structure');
    process.exit(0);
  }

  if (process.argv.includes('--example')) {
    printExampleMetadata();
    process.exit(0);
  }

  runPipeline().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}
