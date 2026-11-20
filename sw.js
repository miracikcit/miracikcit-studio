/* Simpan app dalam phone supaya boleh dibuka tanpa internet. Data sendiri disimpan oleh runtime.js. */
const V = '2026.11.20-17';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open('studio-' + V).then(c => c.addAll(CORE))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== 'studio-' + V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname === 'script.google.com' || u.hostname.endsWith('googleusercontent.com') && u.pathname.startsWith('/macros')) return;
  const same = u.origin === location.origin;
  const font = u.hostname.includes('fonts.g') || u.hostname === 'cdnjs.cloudflare.com';
  if (!same && !font) return;
  // rangkaian dulu (versi terbaru), cache bila offline
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open('studio-' + V).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('index.html'))));
});
