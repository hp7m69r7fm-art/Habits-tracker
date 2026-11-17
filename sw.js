/* Change VERSION whenever any application asset changes. */
const VERSION = 'v3';
const PREFIX = `habit-tracker:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;
const ESSENTIAL = ['./index.html', './app.js', './model.js', './styles.css', './manifest.webmanifest', './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ESSENTIAL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match('./index.html')) || fetch(request)));
    return;
  }
  if (!ESSENTIAL.some(path => new URL(path, self.registration.scope).href === url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
});
