import { handleVerifyStart, handleVerifyConfirm } from './routes/verify.js';
import { handleSessionCheck } from './routes/session.js';
import { handleGetAlbums, handleGetFeatured } from './routes/albums.js';
import { handleUnlockAlbum } from './routes/unlock.js';
import { handleUpdateAlbum, handleUpdatePhoto } from './routes/admin.js';
import { isAdminRequest } from './lib/adminAuth.js';
import { jsonResponse } from './lib/http.js';

const ADMIN_ALBUM_ID_ROUTE = /^\/api\/admin\/albums\/([^/]+)$/;
const UNLOCK_ROUTE = /^\/api\/albums\/([^/]+)\/unlock$/;

async function handleApi(request, env, pathname) {
  if (pathname === '/api/verify/start' && request.method === 'POST') {
    return handleVerifyStart(request, env);
  }

  if (pathname === '/api/verify/confirm' && request.method === 'POST') {
    return handleVerifyConfirm(request, env);
  }

  if (pathname === '/api/session/check' && request.method === 'POST') {
    return handleSessionCheck(request, env);
  }

  if (pathname === '/api/featured' && request.method === 'GET') {
    return handleGetFeatured(request, env);
  }

  if (pathname === '/api/albums' && request.method === 'GET') {
    return handleGetAlbums(request, env);
  }

  const unlockMatch = pathname.match(UNLOCK_ROUTE);
  if (unlockMatch && request.method === 'POST') {
    return handleUnlockAlbum(request, env, unlockMatch[1]);
  }

  if (pathname.startsWith('/api/admin/')) {
    if (!isAdminRequest(request)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const albumIdMatch = pathname.match(ADMIN_ALBUM_ID_ROUTE);
    if (albumIdMatch && request.method === 'PUT') {
      return handleUpdateAlbum(request, env, albumIdMatch[1]);
    }

    if (pathname === '/api/admin/photos' && request.method === 'PUT') {
      return handleUpdatePhoto(request, env);
    }
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url.pathname);
    }

    return env.ASSETS.fetch(request);
  }
};
