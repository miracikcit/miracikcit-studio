/* Simpan app dalam phone supaya boleh dibuka tanpa internet. Data sendiri disimpan oleh runtime.js. */
const V = '2026.11.23-7';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-180.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open('studio-' + V).then(c => c.addAll(CORE))); });   // versi baru terus aktif (editor PWA perlukan laluan terbaru)
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== 'studio-' + V && !k.startsWith('ed-')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
/* ---- Editor reel PWA: editor/v/<id>/<fail> dihidang dari Google Drive (manifest dari ed-boot.js), disimpan dalam cache phone ---- */
const ED = {}, EDIN = {};
const MIME = { mp4: 'video/mp4', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', json: 'application/json', svg: 'image/svg+xml' };
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.t === 'edping') { if (e.ports[0]) e.ports[0].postMessage('ed1'); return; }   // pintu masuk editor: sw ni kenal laluan editor/v/
  if (d.t !== 'edman') return;
  ED[d.vid] = d;
  e.waitUntil(caches.open('ed-meta').then(c => c.put('/edmeta/' + encodeURIComponent(d.vid), new Response(JSON.stringify(d)))).then(() => { if (e.ports[0]) e.ports[0].postMessage('ok'); }));
});
async function edMeta(vid) {
  if (ED[vid]) return ED[vid];
  const r = await (await caches.open('ed-meta')).match('/edmeta/' + encodeURIComponent(vid));
  if (r) return (ED[vid] = await r.json());
  for (let i = 0; i < 40 && !ED[vid]; i++) await new Promise(ok => setTimeout(ok, 250));   // fail awal (cth watermark) tunggu manifest dari ed-boot.js
  return ED[vid] || null;
}
async function edDownload(meta, vid, rest, id, type) {
  if (meta.local) { const r = await fetch(self.registration.scope + 'edlocal/' + encodeURIComponent(vid) + '/' + rest); if (!r.ok) throw new Error('local ' + r.status); return new Blob([await r.arrayBuffer()], { type }); }
  const parts = []; let start = 0, total = 1;
  while (start < total) {
    const r = await fetch(meta.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
      body: JSON.stringify({ action: 'ed_chunk', code: meta.code, id, start, len: 8000000 }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'ed_chunk');
    total = j.total;
    const bin = atob(j.b64 || ''), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    if (!u8.length) break;
    parts.push(u8); start += u8.length;
  }
  return new Blob(parts, { type });
}
async function edMedia(req, vid, rest) {
  const meta = await edMeta(vid);
  const id = meta && meta.files && meta.files[rest];
  if (!id) return new Response('tiada', { status: 404 });
  const type = MIME[(rest.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
  const ck = self.registration.scope + 'edm/' + encodeURIComponent(meta.local ? 'L-' + vid + '/' + rest : id);
  const cache = await caches.open('ed-media');
  let hit = await cache.match(ck), blob;
  if (hit) blob = await hit.blob();
  else {
    blob = await (EDIN[ck] = EDIN[ck] || edDownload(meta, vid, rest, id, type).finally(() => { delete EDIN[ck]; }));
    if (!meta.local) cache.put(ck, new Response(blob, { headers: { 'Content-Type': type } })).catch(() => {});
  }
  const range = req.headers.get('range'), size = blob.size;
  const mm = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (mm) {
    let a = mm[1] === '' ? Math.max(0, size - Number(mm[2])) : Number(mm[1]);
    let b = mm[1] !== '' && mm[2] !== '' ? Math.min(Number(mm[2]), size - 1) : size - 1;
    if (a >= size) return new Response('', { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    return new Response(blob.slice(a, b + 1, type), { status: 206, headers: { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': String(b - a + 1), 'Accept-Ranges': 'bytes' } });
  }
  return new Response(blob, { headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' } });
}
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  const em = e.request.method === 'GET' && u.origin === location.origin && u.pathname.match(/\/editor\/v\/([^/]+)\/(.*)$/);
  if (em) {
    const vid = decodeURIComponent(em[1]), rest = decodeURIComponent(em[2]);
    if (rest === '' || rest === 'index.html') {
      const shell = self.registration.scope + 'editor/editor.html';
      e.respondWith(fetch(shell, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open('studio-' + V).then(x => x.put(shell, c)); } return r; }).catch(() => caches.match(shell)));
    } else e.respondWith(edMedia(e.request, vid, rest).catch(err => new Response(String(err && err.message || err), { status: 502 })));
    return;
  }
  if (e.request.method !== 'GET' || u.hostname === 'script.google.com' || u.hostname.endsWith('googleusercontent.com') && u.pathname.startsWith('/macros')) return;
  const same = u.origin === location.origin;
  const font = u.hostname.includes('fonts.g') || u.hostname === 'cdnjs.cloudflare.com';
  if (!same && !font) return;
  // rangkaian dulu (versi terbaru), cache bila offline; fail editor sentiasa semak semula (elak HTTP cache lama)
  const fresh = same && u.pathname.includes('/editor/') ? fetch(e.request, { cache: 'no-cache' }) : fetch(e.request);
  e.respondWith(fresh.then(r => { if (r.ok) { const c = r.clone(); caches.open('studio-' + V).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('index.html'))));
});
