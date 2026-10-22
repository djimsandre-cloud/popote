// Popote : fonctionne hors connexion. Augmentez VERSION à chaque mise à jour.
const VERSION = 'popote-v62';
const SHELL = ['/', '/index.html', '/guide.html', '/confidentialite.html', '/manifest.json', '/pam-outils.js', '/icons/icon-192.png', '/icons/icon-512.png'];
// Seuls ces domaines sont mis en cache (jamais la base de données Firestore).
const CACHEABLE = [self.location.origin, 'https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://www.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Réseau d'abord (pour avoir la dernière version), cache si hors connexion.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || !CACHEABLE.includes(url.origin)) return;
  // Jamais de cache pour la connexion Google (pages /__/auth/...).
  if (url.origin === self.location.origin && url.pathname.startsWith('/__/auth/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});
