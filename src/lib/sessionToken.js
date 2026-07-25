const STORAGE_KEY = 'gallery_session';

export function getStoredToken() {
  return localStorage.getItem(STORAGE_KEY);
}

export function setStoredToken(token) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(STORAGE_KEY);
}
