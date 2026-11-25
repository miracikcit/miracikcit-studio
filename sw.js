/* Simpan app dalam phone supaya boleh dibuka tanpa internet. Data sendiri disimpan oleh runtime.js. */
const V = '2026.11.25-15';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-180.png'];
const SHELL = 'studio-' + V, SC = self.registration.scope, NET_MS = 3000;
/* Fasa 1B: precache shell Studio + editor. Senarai fail dibaca dari HTML sendiri (index.html guna ?v=<versi>, editor.html guna ?v=<hash isi>),
   jadi kunci cache sentiasa sama dengan apa yang page minta dan fail lapuk tak boleh terhidang. Semua diambil terus dari rangkaian (cache: 'reload'). */
const PAGES = [['index.html', ''], ['editor/editor.html', 'editor/v/x/'], ['editor/index.html', 'editor/']];
const EXTRA = ['editor/manifest.webmanifest', 'icons/editor-180.png', 'icons/editor-192.png'];
async function precache() {
  const c = await caches.open(SHELL);
  await c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));   // wajib: gagal = versi lama terus dipakai
  const grab = async url => { try { const r = await fetch(new Request(url, { cache: 'reload' })); if (r.ok) await c.put(url, r.clone()); return r.ok ? r : null; } catch (e) { return null; } };
  const urls = new Set(EXTRA.map(u => SC + u));
  await Promise.all(PAGES.map(async ([page, base]) => {
    const r = await grab(SC + page); if (!r) return;
    (await r.text()).replace(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g, (m, u) => { try { const x = new URL(u, SC + base); x.hash = ''; if (x.href.startsWith(SC)) urls.add(x.href); } catch (e) {} return m; });
  }));
  await Promise.all([...urls].map(grab));   // selebihnya: cuba sebaik mungkin
}
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(precache()); });   // versi baru terus aktif (editor PWA perlukan laluan terbaru)
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && !k.startsWith('ed-')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

/* ---- Editor reel PWA: editor/v/<id>/<fail> dihidang dari Google Drive (manifest dari ed-boot.js), disimpan dalam cache phone ----
   Fasa 1B: setiap fail disimpan ikut keping 8 MB dalam cache 'ed-media':
     edc/<id Drive>/meta  = {size, n, type}        edc/<id Drive>/<i> = keping ke-i
   Permintaan Range hanya baca keping berkenaan (fail penuh tak dimuat ke memori). Keping yang diminta dimuat turun dulu,
   selebihnya diisi di belakang. Entri format lama (edm/<id> = satu blob) terus dihidang dan dipindah ke keping di belakang. */
const ED = {}, EDIN = {}, EDI = {}, EDFULL = {}, EDMIG = {};
const CS = 8000000;
const ED_CAP = true;   // Range terbuka (bytes=a-) dijawab sampai hujung keping sahaja, supaya video mula main sebelum semua siap. false = tunggu semua keping julat tu.
const MIME = { mp4: 'video/mp4', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', json: 'application/json', svg: 'image/svg+xml' };
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.t === 'edping') { if (e.ports[0]) e.ports[0].postMessage('ed1'); return; }   // pintu masuk editor: sw ni kenal laluan editor/v/
  if (d.t === 'edclean') { e.waitUntil(edClean(d.keep || [], d.vids || []).catch(() => -1).then(n => { if (e.ports[0]) e.ports[0].postMessage(n); })); return; }
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
/* uji localhost: seluruh fail dari devserver, tak disimpan */
async function edLocal(vid, rest, type) {
  const r = await fetch(SC + 'edlocal/' + encodeURIComponent(vid) + '/' + rest); if (!r.ok) throw new Error('local ' + r.status);
  return new Blob([await r.arrayBuffer()], { type });
}
/* satu keping dari Drive melalui Apps Script ed_chunk (akses rawak ikut start) */
async function edFetch(meta, id, i) {
  const r = await fetch(meta.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
    body: JSON.stringify({ action: 'ed_chunk', code: meta.code, id, start: i * CS, len: CS }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'ed_chunk');
  const bin = atob(j.b64 || ''), u8 = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
  return { u8, total: Number(j.total) || 0 };
}
const edLen = (info, i) => Math.min(CS, info.size - i * CS);
async function edSetInfo(cache, K, total, type) {
  const old = EDI[K];
  if (old && old.size === total) return old;
  if (old) { for (let j = 0; j < old.n; j++) await cache.delete(K + '/' + j); delete EDFULL[K]; }   // fail di Drive dah berubah saiz: buang keping lama
  const info = EDI[K] = { size: total, n: Math.ceil(total / CS), type };
  await cache.put(K + '/meta', new Response(JSON.stringify(info), { headers: { 'Content-Type': 'application/json' } })).catch(() => {});
  return info;
}
/* keping ke-i: dari cache kalau ada (saiz betul), kalau tak muat turun (satu muat turun sahaja walau diminta serentak) dan simpan */
async function edChunk(cache, K, meta, id, i, type) {
  const key = K + '/' + i, hit = await cache.match(key);
  if (hit) { const b = await hit.blob(); if (!EDI[K] || b.size === edLen(EDI[K], i)) return b; }
  return (EDIN[key] = EDIN[key] || (async () => {
    const { u8, total } = await edFetch(meta, id, i);
    const info = await edSetInfo(cache, K, total, type);
    if (i < info.n && u8.length !== edLen(info, i)) throw new Error('keping tak lengkap');
    const b = new Blob([u8], { type });
    if (u8.length) await cache.put(key, new Response(b, { headers: { 'Content-Type': type } })).catch(() => {});   // storan penuh: tetap hidang dari memori
    return b;
  })().finally(() => { delete EDIN[key]; }));
}
async function edInfo(cache, K, meta, id, type) {
  if (EDI[K]) return EDI[K];
  const r = await cache.match(K + '/meta');
  if (r) return (EDI[K] = await r.json());
  await edChunk(cache, K, meta, id, 0, type);   // keping pertama beritahu saiz fail
  return EDI[K];
}
/* isi keping selebihnya di belakang, satu demi satu untuk semua fail (permintaan sebenar dari video tak perlu beratur) */
let edQ = Promise.resolve();
function edFill(cache, K, meta, id, type) {
  if (EDFULL[K]) return null;
  EDFULL[K] = 1;
  return (edQ = edQ.then(async () => {
    try { const info = EDI[K]; for (let i = 0; i < info.n; i++) await edChunk(cache, K, meta, id, i, type); EDFULL[K] = 2; }
    catch (e) { delete EDFULL[K]; }   // cuba lagi pada permintaan seterusnya
  }));
}
/* format lama (satu blob) -> keping. Blob lama hanya dibuang selepas semua keping + meta selamat disimpan. */
function edMigrate(cache, K, oldKey, blob, type) {
  if (EDMIG[K]) return null;
  return (EDMIG[K] = (async () => {
    const info = { size: blob.size, n: Math.ceil(blob.size / CS), type };
    try {
      for (let i = 0; i < info.n; i++) await cache.put(K + '/' + i, new Response(blob.slice(i * CS, (i + 1) * CS, type), { headers: { 'Content-Type': type } }));
      await cache.put(K + '/meta', new Response(JSON.stringify(info), { headers: { 'Content-Type': 'application/json' } }));
      EDI[K] = info; EDFULL[K] = 2;
      await cache.delete(oldKey);
    } catch (e) { for (let i = 0; i < info.n; i++) await cache.delete(K + '/' + i).catch(() => {}); }   // gagal (cth storan penuh): kekal guna blob lama
    delete EDMIG[K];
  })());
}
function edRange(req, size) {
  const mm = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (!mm || (mm[1] === '' && mm[2] === '')) return { a: 0, b: size - 1, full: true };
  if (mm[1] === '') return { a: Math.max(0, size - Number(mm[2])), b: size - 1 };
  const a = Number(mm[1]), open = mm[2] === '';
  return { a, b: open ? size - 1 : Math.min(Number(mm[2]), size - 1), open };
}
function edReply(body, r, size, type) {
  if (r.full) return new Response(body, { headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' } });
  return new Response(body, { status: 206, headers: { 'Content-Type': type, 'Content-Range': `bytes ${r.a}-${r.b}/${size}`, 'Content-Length': String(r.b - r.a + 1), 'Accept-Ranges': 'bytes' } });
}
const ed416 = size => new Response('', { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
async function edMedia(e, vid, rest) {
  const req = e.request, meta = await edMeta(vid);
  const id = meta && meta.files && meta.files[rest];
  if (!id) return new Response('tiada', { status: 404 });
  const type = MIME[(rest.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
  if (meta.local) {
    const lk = 'L-' + vid + '/' + rest;
    const blob = await (EDIN[lk] = EDIN[lk] || edLocal(vid, rest, type).finally(() => { delete EDIN[lk]; }));
    const r = edRange(req, blob.size);
    if (!r.full && (r.a >= blob.size || r.b < r.a)) return ed416(blob.size);
    return edReply(r.full ? blob : blob.slice(r.a, r.b + 1, type), r, blob.size, type);
  }
  const cache = await caches.open('ed-media');
  const K = SC + 'edc/' + encodeURIComponent(id), oldKey = SC + 'edm/' + encodeURIComponent(id);
  if (!EDI[K] && !(await cache.match(K + '/meta'))) {
    const old = await cache.match(oldKey);
    if (old) {   // format lama: hidang macam dulu, pindah ke keping di belakang
      const blob = await old.blob(), r = edRange(req, blob.size);
      const mg = edMigrate(cache, K, oldKey, blob, type); if (mg) e.waitUntil(mg);
      if (!r.full && (r.a >= blob.size || r.b < r.a)) return ed416(blob.size);
      return edReply(r.full ? blob : blob.slice(r.a, r.b + 1, type), r, blob.size, type);
    }
  }
  const info = await edInfo(cache, K, meta, id, type), size = info.size;
  const r = edRange(req, size);
  if (!r.full && (r.a >= size || r.b < r.a)) return ed416(size);
  if (ED_CAP && r.open) r.b = Math.min(r.b, (Math.floor(r.a / CS) + 1) * CS - 1);
  const parts = [];
  for (let i = Math.floor(r.a / CS); size && i <= Math.floor(r.b / CS); i++) {
    const b = await edChunk(cache, K, meta, id, i, type), s = Math.max(r.a - i * CS, 0), t = Math.min(r.b - i * CS + 1, CS);
    parts.push(s === 0 && t >= b.size ? b : b.slice(s, t, type));
  }
  const fill = edFill(cache, K, meta, id, type); if (fill) e.waitUntil(fill);
  return edReply(new Blob(parts, { type }), r, size, type);
}
/* buang media projek yang dah final / published / tiada lagi. keep = id Drive yang masih diguna, vids = projek yang masih diedit (dari page). */
async function edClean(keep, vids) {
  if (!keep.length) return 0;
  const ok = new Set(keep.map(String)), c = await caches.open('ed-media'); let n = 0;
  for (const r of await c.keys()) {
    const m = new URL(r.url).pathname.match(/\/ed[mc]\/([^/]+)/);
    if (!m || ok.has(decodeURIComponent(m[1]))) continue;
    await c.delete(r); n++;
    const K = SC + 'edc/' + m[1]; delete EDI[K]; delete EDFULL[K];
  }
  const vs = new Set(vids.map(String)), mc = await caches.open('ed-meta');
  for (const r of await mc.keys()) {
    const vid = decodeURIComponent(new URL(r.url).pathname.split('/').pop());
    if (!vs.has(vid)) { await mc.delete(r); delete ED[vid]; }
  }
  return n;
}

/* ---- fetch biasa: rangkaian dulu; kalau lebih NET_MS (atau offline) guna cache, rangkaian tetap kemas kini cache di belakang ---- */
function netFirst(e, req, key, o) {
  const open = caches.open(SHELL);
  const net = fetch(req).then(r => { if (r.ok) { const c = r.clone(); e.waitUntil(open.then(x => x.put(key, c)).catch(() => {})); } return r; });
  e.waitUntil(net.catch(() => {}));
  const cached = async () => {
    const c = await open;
    return (await c.match(key)) || (o.same && await c.match(key, { ignoreSearch: true })) || (o.nav && await c.match(SC + o.nav)) || null;   // index.html hanya untuk navigasi
  };
  return new Promise((res, rej) => {
    let done = false;
    const t = setTimeout(() => cached().then(c => { if (c && !done) { done = true; res(c); } }), NET_MS);
    net.then(r => { clearTimeout(t); if (!done) { done = true; res(r); } },
      err => { clearTimeout(t); if (done) return; cached().then(c => { if (done) return; done = true; c ? res(c) : rej(err); }); });
  });
}
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  const em = e.request.method === 'GET' && u.origin === location.origin && u.pathname.match(/\/editor\/v\/([^/]+)\/(.*)$/);
  if (em) {
    const vid = decodeURIComponent(em[1]), rest = decodeURIComponent(em[2]);
    if (rest === '' || rest === 'index.html') { const shell = SC + 'editor/editor.html'; e.respondWith(netFirst(e, new Request(shell, { cache: 'no-cache' }), shell, {})); }
    else e.respondWith(edMedia(e, vid, rest).catch(err => new Response(String(err && err.message || err), { status: 502 })));
    return;
  }
  if (e.request.method === 'GET' && u.origin === location.origin && u.pathname.includes('/editor/mk/')) {   // Fasa 4: enjin makeup (18 MB): muat turun SEKALI, kekal merentas versi Studio
    e.respondWith(caches.open('ed-mk1').then(async c => (await c.match(u.href)) || fetch(e.request).then(r => { if (r.ok) e.waitUntil(c.put(u.href, r.clone())); return r; })));
    return;
  }
  if (e.request.method !== 'GET' || u.hostname === 'script.google.com' || u.hostname.endsWith('googleusercontent.com') && u.pathname.startsWith('/macros')) return;
  const same = u.origin === location.origin;
  const font = u.hostname.includes('fonts.g') || u.hostname === 'cdnjs.cloudflare.com';
  if (!same && !font) return;
  // fail editor sentiasa semak semula (elak HTTP cache lama)
  const ed = same && u.pathname.includes('/editor/');
  const nav = e.request.mode === 'navigate' && same ? (/\/editor\/$|\/editor\/index\.html$/.test(u.pathname) ? 'editor/index.html' : 'index.html') : '';
  e.respondWith(netFirst(e, ed ? new Request(e.request, { cache: 'no-cache' }) : e.request, e.request, { same, nav }));
});

/* 25 Nov 2026: notifikasi draf siap (Web Push dari worker Mac mini) */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Miracikcit Studio', { body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'ed-' + (d.vid || ''), data: { vid: d.vid || '' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const vid = (e.notification.data || {}).vid, u = self.registration.scope + (vid ? 'editor/?v=' + encodeURIComponent(vid) : '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(x => 'focus' in x); return c ? c.focus() : self.clients.openWindow(u); }));
});
