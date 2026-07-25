import { handleVerifyStart, handleVerifyConfirm } from './routes/verify.js';
import { handleSessionCheck } from './routes/session.js';
import { jsonResponse } from './lib/http.js';

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
