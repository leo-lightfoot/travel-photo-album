import { getAlbums } from '../lib/albums.js';
import { jsonResponse } from '../lib/http.js';

export async function handleGetAlbums(request, env) {
  const albums = await getAlbums(env.DB);
  return jsonResponse(albums);
}
