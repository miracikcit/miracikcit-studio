/* Editor reel dalam Studio PWA (2026-11-22). Dimuat SELEPAS runtime.js dan SEBELUM enjin editor (src/ dalam reel-page-template).
   - claude.use("db"): doc editor (edits/current, prefs/style, ...) disimpan dalam STUDIO_DATA sebagai edx/<id>~<path>.
     Doc lebih 45k aksara dipecah ke ~c0, ~c1 ... (had satu sel Sheet 49k).
   - Media (proxy.mp4, data.json, sfx/...) dihidang oleh sw.js dari Google Drive (manifest doc edpwa/<id>), disimpan dalam cache phone.
   - Butang Siap (sendUp) -> ED_SEND -> job ed_send: Mac mini buka sesi Claude dengan arahan yang sama. */
(function () {
  const m = location.pathname.match(/\/editor\/v\/([^/]+)\//);
  const VID = m ? decodeURIComponent(m[1]) : '';
  window.ED_VID = VID;
  window.MK_BASE = new URL('mk/', document.currentScript.src.split('?')[0]).href;   // Fasa 4: enjin MediaPipe + model muka untuk pratonton makeup (editor/mk/)
  try { sessionStorage.removeItem('ed404'); } catch (e) {}
  const LOCAL = location.hostname === 'localhost';
  const orig = claude.use.bind(claude);
  const err = (code, msg) => Object.assign(new Error(msg || code), { code });
  const key = p => 'edx/' + VID + '~' + String(p).replace(/\//g, '~');
  let base = null, pullOk = false;

  const once = path => new Promise(res => { let done = false; base.doc(path).onSnapshot(s => { if (done) return; done = true; res(s.exists ? s.data() : null); }); });
  async function readDoc(path, tries) {
    const d = await once(path);
    if (!d || !d._c) return d;
    const parts = [];
    for (let i = 0; i < d._c; i++) { const c = await once(path + '~c' + i); if (!c) throw err('chunk', 'bahagian simpanan hilang'); parts.push(c.s); }
    try { return JSON.parse(parts.join('')); }
    catch (e) {
      /* Fasa 1A: keping tak sepadan (device lain sedang menyimpan separuh jalan). Tunggu sync seterusnya dan cuba lagi, jangan terus gagal. */
      if ((tries || 0) >= 3) throw err('chunk', 'simpanan belum lengkap, cuba buka semula sekejap lagi');
      await new Promise(r => setTimeout(r, 4000));
      return readDoc(path, (tries || 0) + 1);
    }
  }
  async function writeDoc(path, obj) {
    const s = JSON.stringify(obj);
    if (s.length <= 45000) return base.doc(path).set(obj);
    const n = Math.ceil(s.length / 44000), w = [];
    /* Fasa 1A: semua keping DAN kepala doc masuk giliran serentak (tiada await di tengah), jadi runtime hantar dalam satu panggilan `put`
       dan app yang ditutup separuh jalan tak tinggalkan keping tanpa kepala. Format ~c0.. kekal (worker Mac mini baca format ni). */
    for (let i = 0; i < n; i++) w.push(base.doc(path + '~c' + i).set({ s: s.slice(i * 44000, (i + 1) * 44000) }));
    w.push(base.doc(path).set({ _c: n, at: Date.now() }));
    return Promise.all(w);
  }

  /* 25 Nov 2026: notifikasi "draf siap" (Web Push). Minta izin masa Mira tekan Draf / UPLOAD (mesti dari ketikan), simpan langganan dalam push/subs; worker Mac mini hantar. */
  const PUSH_PUB = 'BOrwjub_k4y0gXG5KoweaHjtivWFmb3qp45RUIRSGyqHVHWC24jMfjEpRSpGPc1XFy5IRXGODl8aaULWzyEslfM';
  let pushDone = false;
  async function pushSub() {
    if (pushDone || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.ready; if (!reg.pushManager) return;
    let sb = await reg.pushManager.getSubscription();
    if (!sb) { const r = atob(PUSH_PUB.replace(/-/g, '+').replace(/_/g, '/') + '='); sb = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(r, c => c.charCodeAt(0)) }); }
    const j = sb.toJSON(), id = String((j.keys || {}).auth || '').slice(0, 12); if (!id) return;
    const d = (await readDoc('push/subs')) || {}, subs = d.subs || {};
    if (!subs[id] || subs[id].endpoint !== j.endpoint) { subs[id] = j; await writeDoc('push/subs', { subs, at: Date.now() }); }
    pushDone = true;
  }
  document.addEventListener('click', e => {
    if (!(e.target.closest && e.target.closest('#upload, #ccDSheet button')) || !('Notification' in window)) return;
    try {
      if (Notification.permission === 'granted') pushSub().catch(() => {});
      else if (Notification.permission === 'default') { const q = Notification.requestPermission(p => { if (p === 'granted') pushSub().catch(() => {}); }); if (q && q.then) q.then(p => { if (p === 'granted') pushSub().catch(() => {}); }).catch(() => {}); }
    } catch (x) {}
  }, true);

  const dbReady = (async () => {
    if (!VID) throw err('novid', 'Link editor tiada id video.');
    await Studio.ready();
    pullOk = await Studio.pulled;
    base = await orig('db');
  })();

  const shim = {
    doc(p) {
      const path = key(p);
      return {
        async get() {
          const d = await readDoc(path);
          // offline dan doc belum pernah sampai ke phone ni: jangan mula dari kosong (nanti tertindih edit sebenar)
          if (d == null && !pullOk && /^edits\//.test(p)) throw err('unavailable', 'Tak dapat sync');
          return { exists: d != null, data: () => (d == null ? undefined : JSON.parse(JSON.stringify(d))) };
        },
        async set(obj) { if (/^diag\//.test(p)) return; return writeDoc(path, obj); }
      };
    }
  };
  claude.use = async name => {
    if (name === 'db') { await dbReady; return shim; }
    if (name === 'room' || name === 'comments') throw err('capability_disabled');
    return orig(name);
  };

  /* ---- media: beri manifest kepada service worker ---- */
  async function manifest() {
    if (LOCAL) { try { const r = await fetch('/edlocal/' + encodeURIComponent(VID) + '/__manifest'); if (r.ok) return Object.assign(await r.json(), { local: true }); } catch (e) {} }
    const d = await readDoc('edpwa/' + VID);
    if (!d || !d.files) throw err('nomedia', 'Video ni belum dihantar ke Studio. Minta Claude jalankan edpwa.py untuk folder editor ni.');
    return d;
  }
  async function toSW(man) {
    const reg = await navigator.serviceWorker.ready;
    const sw = navigator.serviceWorker.controller || reg.active;
    if (!sw) throw err('nosw', 'Service worker belum sedia. Muat semula page.');
    let code = ''; try { code = JSON.parse(localStorage.getItem('mstudio:code') || '""'); } catch (e) {}
    if (LOCAL) code = 'mac-mini-dev';
    const api = new URL(STUDIO_CONFIG.api, location.href).href;
    await new Promise((res, rej) => {
      const ch = new MessageChannel(); const t = setTimeout(() => rej(err('nosw', 'Service worker tak jawab. Muat semula page.')), 8000);
      ch.port1.onmessage = () => { clearTimeout(t); res(); };
      sw.postMessage({ t: 'edman', vid: VID, files: man.files, local: !!man.local, code, api }, [ch.port2]);
    });
  }
  window.ED_READY = dbReady.then(async () => {
    const man = await manifest();
    window.ED_MAN = man;
    if (man.title) document.title = man.title + ' · Editor';
    await toSW(man);
    edTidy(man);
  });
  /* Fasa 1B: minta phone jangan buang storan editor, dan suruh service worker buang media projek yang dah final / published / tiada lagi.
     Hanya selepas tarikan pertama berjaya (senarai edpwa terkini); projek yang sedang dibuka sentiasa dikekalkan. */
  function edTidy(man) {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
    if (LOCAL || !pullOk || window.ED_TIDY) return;
    window.ED_TIDY = 1;
    let done = false;
    base.collection('edpwa').onSnapshot(snap => {
      if (done) return; done = true;
      const keep = new Set(Object.values(man.files || {})), vids = [VID];
      snap.docs.forEach(d => { const x = d.data() || {}; if (x.final || x.pub || !x.files) return; vids.push(d.id); Object.values(x.files).forEach(id => keep.add(id)); });
      const sw = navigator.serviceWorker.controller;
      if (sw && keep.size) sw.postMessage({ t: 'edclean', keep: [...keep], vids });
    });
  }
  /* 23 Nov: footage dari folder lain (job ed_foot di Mac mini, 0 token) */
  window.ED_FOOT = {
    job: input => studioCall('job_add', { type: 'ed_foot', input }),
    poll: async since => { const j = await studioCall('pull', { since: since - 1 }); return ((j.docs || []).find(x => x.p === 'edfoot/' + VID) || {}).d || null; },
    refresh: async since => { const j = await studioCall('pull', { since: (since || Date.now()) - 1 }); const d = ((j.docs || []).find(x => x.p === 'edpwa/' + VID) || {}).d; const man = d && d.files ? d : await manifest(); window.ED_MAN = man; await toSW(LOCAL ? await manifest() : man); }
  };
  window.ED_FAIL = e => {
    const b = document.getElementById('boot');
    if (b) { b.hidden = false; b.innerHTML = 'Editor tak dapat dibuka: ' + String((e && e.message) || e) + '<br><a href="../../../#editor">Balik ke Studio</a>'; }
  };

  /* ---- Siap: Draf = Mac mini render terus (0 token); Final / Render All = sesi Claude di Mac mini ---- */
  const dview = id => 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view';
  let draftT = 0, DRB = 0;   // DRB: draf sedang dirender (butang dikunci)
  async function watchDraft(upMsg, t0) {
    clearTimeout(draftT);
    try {
      const j = await studioCall('pull', { since: t0 - 1 });
      const d = ((j.docs || []).find(x => x.p === 'edpwa/' + VID) || {}).d;
      const dr = d && d.draft;
      if (dr && dr.at >= t0 - 5000) {
        if (dr.status === 'sedia') { DRB = 0; finDraw(); upMsg('Draf siap (' + (dr.mb || '?') + ' MB). '); const m = document.getElementById('upMsg'); if (m) m.insertAdjacentHTML('beforeend', `<a href="${dview(dr.id)}" target="_blank" rel="noopener"><b>▶ Tonton draf</b></a>`); return; }
        if (dr.status === 'error') { DRB = 0; finDraw(); upMsg('Draf gagal: ' + (dr.msg || 'ralat') + '. Pilihan kau dah disimpan; tekan Render sekali lagi atau pilih Final supaya Claude bantu.'); return; }
      }
    } catch (e) {}
    draftT = setTimeout(() => watchDraft(upMsg, t0), 15000);
  }
  /* p23 (2026-11-23, Mira): render final = satu tekan sahaja, bar % ikut langkah sesi Claude (finPct/finStep dalam edpwa/<id>),
     butang link chat bila sesi keluar. Status kekal walaupun page ditutup dan dibuka semula. */
  let FIN = null, finT = 0;
  const FIN_STALE = 90 * 60e3;
  const finRun = () => FIN && FIN.finStatus === 'proses' && Date.now() - (FIN.finAt || 0) < FIN_STALE;
  function finDraw() {
    const box = document.getElementById('finBox'), up = document.getElementById('upload');
    if (up) { const run = finRun() || (DRB && Date.now() - DRB < 20 * 60e3); up.disabled = run; if (run) up.dataset.busy = '1'; else delete up.dataset.busy; }
    if (!box) return;
    if (!FIN || !FIN.finAt) { box.innerHTML = ''; return; }
    const pct = Math.max(0, Math.min(100, +FIN.finPct || 0)), st = FIN.finStatus, ok = st === 'siap', bad = st === 'error' || (!ok && !finRun());
    const head = ok ? '✅ Render siap' : bad ? '⚠️ Render terhenti' : '⏳ Sedang render…';
    const chat = FIN.finChat ? `<a class="fchat" href="${FIN.finChat}" target="_blank" rel="noopener">💬 Buka chat Claude</a>` : '';
    box.innerHTML = `<div class="finbar${!ok && !bad ? ' run' : ''}"><div class="fbt"><span>${head}</span><span>${pct}%</span></div><div class="fbg"><i style="width:${Math.max(3, pct)}%"></i></div><small>${(FIN.finStep || '').replace(/[<>&]/g, '')}${bad && st !== 'error' ? ' (tiada berita lebih 90 minit; semak chat Claude atau tekan render semula)' : ''}</small>${chat}</div>`;
  }
  async function finRead() {
    try { const j = await studioCall('pull', { since: (FIN && FIN.finAt ? FIN.finAt : Date.now() - FIN_STALE) - 60e3 }); const d = ((j.docs || []).find(x => x.p === 'edpwa/' + VID) || {}).d; if (d && d.finAt && (!FIN || d.finAt >= FIN.finAt - 120e3)) FIN = { ...(FIN || {}), ...d, finAt: Math.max(d.finAt, (FIN || {}).finAt || 0) }; } catch (e) {}
  }
  async function finWatch() { clearTimeout(finT); await finRead(); finDraw(); if (finRun()) finT = setTimeout(finWatch, 6000); }
  /* 2026-11-23 (Mira): jenis render ikut Shoot list. Item Shoot yang ada attachment (sample / produk / brand / bayaran) = Jobs, lain = Creative. */
  let KIND = undefined;
  const nk = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  async function kindOf() {
    if (KIND !== undefined) return KIND;
    KIND = null;
    try {
      const docs = await new Promise(res => { let done = 0; base.collection('items').onSnapshot(s => { if (!done) { done = 1; res(s.docs.map(d => d.data())); } }); setTimeout(() => { if (!done) { done = 1; res([]); } }, 4000); });
      const man = window.ED_MAN || {}, dir = String(man.dir || ''), keys = [man.title, dir.split('/').slice(-3).join(' '), (dir.match(/CLAUDE EDITS\/[^/]+\/([^/]+)/) || [])[1]].map(nk).filter(k => k.length >= 4);
      const it = docs.find(d => { const t = nk(d.title); return t.length >= 4 && keys.some(k => k.includes(t.slice(0, 10)) || t.includes(k.slice(0, 10))); });
      if (it) KIND = (it.kind ? it.kind === 'job' : !!(it.sample || it.productId || it.brand || it.paid)) ? 'product' : 'non';
    } catch (e) {}
    return KIND;
  }
  window.ED_KIND = () => KIND;
  window.ED_FIN = () => { kindOf().then(k => { try { if (k && (0, eval)('!S.final.tab')) { (0, eval)(`S.final.tab = '${k}'; touched(); drawPanel();`); } } catch (e) {} }); finDraw(); if (!FIN) { FIN = {}; readDoc('edpwa/' + VID).then(d => { if (d && d.finAt && Date.now() - d.finAt < FIN_STALE * 4) { FIN = d; finDraw(); if (finRun()) finWatch(); } }).catch(() => {}); } };
  window.ED_PROMPT = p => {
    if (!p || p.render === 'draft') return 'Draf tak perlukan Claude. Tekan butang render sekali lagi.';
    const multi = p.multi, src = p.failAsal === 'buang' ? 'fail asal ke Trash' : /^pindah/.test(p.failAsal || '') ? 'pindah folder footage asal projek ke "' + (p.srcTo || '?') + '"' : 'fail asal disimpan';
    return `FINAL PWA (mod jimat token) untuk ${p.title} (id editor ${VID}${multi ? ', ' + p.total + ' video' : ''}). Jangan baca PERATURAN-EDIT.md, jangan tengok frame.
1. python3 ~/MiracikcitTranscribe/studio.py get 'edx/${VID}~edits~${multi ? 'pN' : 'current'}' > edits.json${multi ? ' (N = 1..' + p.total + ')' : ''}; project = medan project dalam studio.py get 'edpwa/${VID}'.
2. python3 ~/.claude/assets/reel-page-template/render_draft.py <project> edits.json <build dalam scratchpad> --final <Produk>_N.mp4
3. Salin mp4 ke 00. TO POST FINAL.
4. Sheet CONTENT 2026 tab ${p.sheet === 'product' ? 'PRODUCTS' : 'NON PRODUCT'}${p.product ? ' (produk ' + p.product + ')' : ''}: satu baris + caption setiap video.
5. python3 ~/MiracikcitTranscribe/studio.py merge 'edpwa/${VID}' '{"final":"siap"}' dan studio.py scan.
6. ${src}; product listing ${p.productListing === 'buang' ? 'ke Trash' : 'disimpan'}. Fail sementara ke Trash. Laporan 2-3 baris.`;
  };
  window.ED_SEND = async (btn, payload, text, upMsg) => {
    if (finRun() || (DRB && Date.now() - DRB < 20 * 60e3)) { upMsg('Render sedang berjalan. Tunggu siap dulu.'); return; }
    upMsg('Menyimpan pilihan terakhir…');
    try {
      try { await (0, eval)('dbDoc && dbDoc.set(docBody())'); } catch (e) {}   // pastikan edit terbaru dah sampai ke Sheet
      const draft = payload && payload.action === 'upload' && payload.render === 'draft' && (window.ED_MAN || {}).project;
      if (draft) {
        const t0 = Date.now();
        await studioCall('job_add', { type: 'ed_draft', input: { vid: VID } }); DRB = Date.now(); finDraw();
        upMsg('Mac mini sedang render draf 540×960 (2–6 minit). Kau boleh tutup page ni; draf juga keluar dalam tab Editor Studio.');
        watchDraft(upMsg, t0);
        return;
      }
      FIN = { finAt: Date.now(), finPct: 2, finStep: 'Menghantar ke Mac mini…', finStatus: 'proses', finChat: '' }; finDraw();
      await studioCall('job_add', { type: 'ed_send', input: { vid: VID, title: (window.ED_MAN || {}).title || '', dir: (window.ED_MAN || {}).dir || '', text, payload } });
      FIN.finPct = 4; FIN.finStep = 'Arahan sampai. Mac mini sedang buka sesi Claude…'; finDraw(); upMsg(''); finWatch();
    } catch (e) { FIN = null; finDraw(); upMsg('Tak dapat hantar (' + ((e && (e.message || e.code)) || 'ralat') + '). Pilihan kau dah disimpan, cuba lagi.'); }
  };
})();

/* ---- Layout gaya CapCut (2026-11-22 v2): ✕ + Siap di atas, rel tab kiri, video sentiasa di tengah, SATU baris butang,
   timeline semua trek dengan playhead tetap di tengah (seret timeline = seek bila jari berhenti, cubit = zoom),
   tab selain Cut jadi helaian bawah. Butang lama dipanggil terus (click proxy), enjin tak diubah. ---- */
(function () {
  const $ = id => document.getElementById(id);
  const H = document.documentElement;
  H.classList.add('pwa');
  try { if (localStorage.getItem('reelRows') === null) localStorage.setItem('reelRows', '1'); } catch (e) {}   // semua trek (VO, effect, bunyi...) dalam Cut
  const click = id => { const b = $(id); if (b) b.click(); };
  const curTab = () => { const t = document.querySelector('#tabs [aria-selected="true"]'); return t ? t.dataset.tab : ''; };
  const goTab = n => { const t = document.querySelector(`#tabs [data-tab="${n}"]`); if (t) { t.click(); return true; } return false; };
  const G = n => { try { return (0, eval)(n); } catch (e) { return undefined; } };   // pembolehubah enjin (let di skrip editor)
  /* setiap tab tunjuk trek timeline yang berkaitan sahaja (sentiasa nampak di atas panel) */
  const ROWS = { Title: /^(Video|Tajuk)$/, Caption: /^(Video|Caption|Highlight)$/, Highlight: /^(Video|Highlight)$/, Effects: /^(Video|Effects|Zoom)$/, Sticker: /^(Video|Sticker)$/,
    Bunyi: /^(Video|Bunyi|Suara|Suara asal|VO|Muzik|Music|BGM)/i, Warna: /^Video$/, 'Style Board': /^(Video|Tajuk|Caption)$/ };
  function rows() {
    const t = curTab(), re = ROWS[t], ok = n => !re || re.test(n || '');
    const labs = [...document.querySelectorAll('#labels > span')];
    labs.forEach(l => l.classList.toggle('edhide', !ok(l.getAttribute('title'))));
    // trek dipadan ikut id (enjin kadang-kadang pindah trek tajuk keluar dari #inner), trek tanpa id ikut label "ro"
    const ID = { hookTrack: 'Tajuk', capTrack: 'Caption', hlTrack: 'Highlight', zmTrack: 'Zoom', fxTrack: 'Effects', stTrack: 'Sticker', sfxTrack: 'Bunyi', voTrack: 'VO' };
    const roNames = labs.filter(l => l.classList.contains('ro')).map(l => l.getAttribute('title')); let ri = 0;
    document.querySelectorAll('.ed .track, .ed .vrow').forEach(tr => {
      const n = tr.classList.contains('vrow') ? 'Video' : ID[tr.id] || (tr.classList.contains('ro') ? roNames[ri++] : '');
      tr.classList.toggle('edhide', !!n && !ok(n));
    });
    H.classList.toggle('ednotl', t === 'Siap');
  }
  /* 23 Nov (Mira): tab Cut, pembaris + trek video melekat di atas (dalam .rbar); trek lain + panel naik turun bersama (#edlow) */
  function pinVideo() {
    if (curTab() !== 'Potong') return;
    const v = $('vrow'), ri = $('rinner'); if (!v || !ri || v.parentNode === ri) return;
    ri.appendChild(v); v.classList.add('fxsticky');
    const rl = document.querySelector('#rbar > span'); if (rl) rl.innerHTML = '<span class="rlab lv"><svg class="ic"><use href="#i-film"/></svg></span>';
    const lab = document.querySelector('#labels [title="Video"]'); if (lab) lab.hidden = true;
  }
  function sync() {
    const t = curTab();
    H.classList.toggle('edsheet', !!t && (t !== 'Potong' || G('jnSel') > 0 || G('spOpen')));   /* p24 / p25: sambungan atau kelajuan dipilih = helaian pilih */
    [...H.classList].filter(c => c.startsWith('edtab-')).forEach(c => H.classList.remove(c)); if (t) H.classList.add('edtab-' + t.replace(/\s+/g, ''));
    rows(); pinVideo();
    const l = $('ccTab'); if (l) l.textContent = (document.querySelector('#tabs [aria-selected="true"] .tl, #tabs [aria-selected="true"]') || {}).textContent || t;
  }
  /* playhead tetap di tengah: #inner dan #rinner ada margin 50% (CSS), jadi scrollLeft = masa × pps.
     Enjin juga cuba scroll timeline semasa main (drawHead) — tulisan tu diabaikan supaya tak bergegar; hanya ed-boot yang scroll.
     Semasa main, kedudukan dilicinkan setiap frame (pos enjin bergerak berperingkat). */
  let snapT = 0, touchSc = null, seekT = 0, pinch = null, own = false, disp = 0, lastT = 0, off = null, phDrag = null;
  /* 25 Nov: scrub licin. scrubbing = jari / momentum sedang gerakkan timeline; satu seek setiap frame (enjin tunggu video siap cari frame). */
  let scrubbing = false, finger = false, wheelAt = 0, endTm = 0, sent = -1, prevD = null, edgeL = null, phX = {}, trimOn = 0, glide = 0, trimX = 0, lastPX = 0, lastPY = 0;
  const eng = s => { try { return (0, eval)(s); } catch (e) {} };   /* 24 Nov: off = jarak playhead dari kiri timeline (px); tak lagi tetap di tengah */
  const SL = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft');
  function lock(sc) {
    if (sc.dataset.lk) return; sc.dataset.lk = '1';
    Object.defineProperty(sc, 'scrollLeft', { configurable: true, get() { return SL.get.call(this); }, set(v) { if (own) SL.set.call(this, v); } });
  }
  function setSL(sc, x) { own = true; SL.set.call(sc, x); own = false; }
  // tab Cut: timeline penuh (#tscroll). Tab lain: hanya trek tab tu di bawah pembaris (#rscroll), trek video disorok.
  const scroller = () => (H.classList.contains('edsheet') ? $('rscroll') : $('tscroll'));
  function flash() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (x) {} H.classList.add('edsnap'); clearTimeout(snapT); snapT = setTimeout(() => H.classList.remove('edsnap'), 260); }
  function scrubStart() {
    scrubbing = true; sent = -1; prevD = null; if (G('playing')) eng('stop()');
    edgeL = null; try { const S = G('S'), st = G('startOf'); edgeL = S.clips.map((c, i) => st(i)); edgeL.push(G('total()')); } catch (e) {}
    eng('scrubSet(1)');
  }
  function scrubEnd() {
    if (!scrubbing) return; scrubbing = false; clearTimeout(endTm);
    const pps = G('pps');   /* lepas jari: kalau dalam 3 px dari hujung klip, duduk tepat di situ (semasa seret tak melekat) */
    if (pps && edgeL) { const thr = 3 / pps, hit = edgeL.find(e => Math.abs(e - disp) < thr); if (hit != null && hit !== disp) { disp = hit; flash(); } }
    window.__edSeek = disp; eng('seek(window.__edSeek); scrubSet(0)');
  }
  function follow(t) {
    const pps = G('pps'), pos = G('pos'), playing = G('playing'), sc = scroller();
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0; lastT = t;
    if (sc && pps && pos != null) {
      if (scrubbing && playing) { scrubbing = false; clearTimeout(endTm); }
      if (scrubbing) { if (disp !== sent) { sent = disp; window.__edSeek = disp; eng('seek(window.__edSeek)'); } }   // gambar ikut jari, satu seek setiap frame
      else if (playing) { const err = pos - disp; if (Math.abs(err) > 0.5) disp = pos; else disp += dt + err * Math.min(1, dt * 6); }   // ikut jam video dengan lembut, tanpa lompat
      else disp = pos;
      { const d = G('dr'), tr = d && d.k === 'trim';   /* 25 Nov (ikut CapCut): tarik pemegang KIRI = hujung kiri klip ikut jari (timeline dianjak), hujung kanan kekal */
        if (tr && d.moved) { try { const c = G('S').clips[d.i], ts = $('tscroll'), sp = c.sp || 1; if (d._sl == null) { d._sl = SL.get.call(ts); const rs0 = $('rscroll'); d._slr = rs0 ? SL.get.call(rs0) : d._sl; }   /* dua scroller boleh beza beberapa px (lebar tak sama): simpan asas masing-masing */
          /* jari dekat tepi timeline: timeline bergerak sendiri dan klip terus dipanjangkan / dipendekkan (ikut CapCut). Berhenti bila footage klip dah habis. */
          { const r = ts.getBoundingClientRect(), EDGE = 44, dir = lastPX < r.left + EDGE ? -1 : lastPX > r.right - EDGE ? 1 : 0;
            if (dir) { const depth = Math.min(1, (dir < 0 ? r.left + EDGE - lastPX : lastPX - (r.right - EDGE)) / EDGE), grow = (d.side === 'l') === (dir < 0);
              const can = grow ? (d.side === 'l' ? c.in > c.srcMin + 1e-3 : c.out < c.srcMax - 1e-3) : (c.out - c.in > G('MIN_CLIP') + .02);
              if (can) { d.ax = (d.ax || 0) + dir * (90 + 260 * depth) * dt; document.dispatchEvent(new PointerEvent('pointermove', { clientX: lastPX, clientY: lastPY, bubbles: true })); } } }
          const want = d._sl + (d.ax || 0), rs = $('rscroll');   /* timeline TAK dianjak semasa tarik (enjin gerakkan klip sendiri); hanya bergerak bila jari di tepi skrin (ax) */
          [[ts, want], [rs, d._slr + (d.ax || 0)]].forEach(([el, w]) => { if (!el) return; const x = Math.max(0, w); if (Math.abs(SL.get.call(el) - x) > 0.5) setSL(el, x); });
          /* di hujung timeline scroll tak boleh pergi lagi: baki dianjak dengan transform supaya hujung klip tetap ikut jari */
          const res = Math.round(want - SL.get.call(ts)); if (res !== trimX) { trimX = res; ['inner', 'rinner'].forEach(id => { const el = $(id); if (el) { el.style.transition = ''; el.style.transform = res ? 'translateX(' + (-res) + 'px)' : ''; } }); } } catch (e) {} }
        if (!tr && trimX) { trimX = 0; ['inner', 'rinner'].forEach(id => { const el = $(id); if (el) { el.style.transition = 'transform .26s ease-out'; el.style.transform = ''; setTimeout(() => { el.style.transition = ''; }, 300); } }); }
        if (tr && scrubbing) { scrubbing = false; clearTimeout(endTm); eng('scrubOn = false; vsWant = null'); }   /* pemegang disentuh semasa timeline masih meluncur: tamatkan scrub, jangan lompat balik */
        /* semasa tarik, mesej panjang video (#lenbar) boleh muncul / hilang dan tolak timeline naik turun di bawah jari: kunci tingginya sampai jari dilepas */
        if (tr && !trimOn) { const lb = $('lenbar'); if (lb) { const h = lb.offsetHeight; if (h) { lb.style.height = h + 'px'; lb.style.overflow = 'hidden'; } else lb.style.display = 'none'; } }
        if (tr) trimOn = 1; else if (trimOn) { trimOn = 0;   /* lepas jari: timeline TAK bergerak; playhead kekal di tengah dan gambar tunjuk saat di bawah playhead (macam CapCut) */
          try { window.__edSeek = Math.max(0, SL.get.call($('tscroll')) / pps); eng('seek(window.__edSeek)'); disp = G('pos'); } catch (e) {} const lb = $('lenbar'); if (lb) { lb.style.height = ''; lb.style.overflow = ''; lb.style.display = ''; } } }   /* lepas jari: timeline meluncur balik ke playhead, bukan melompat */
      const cw = sc.clientWidth; off = cw / 2;   /* Fasa 2 (24 Nov, Mira): playhead ikut CapCut, tetap di tengah */
      if (!scrubbing && !finger && !phDrag) {
        [$('tscroll'), $('rscroll')].forEach(el => { if (!el) return; const w = el.clientWidth || cw; const max = Math.max(0, el.scrollWidth - w);
          let x = Math.max(0, Math.min(max, disp * pps + w / 2 - off)); const cur = SL.get.call(el); if (t < glide && Math.abs(x - cur) > 1) x = cur + (x - cur) * Math.min(1, dt * 14);
          if (Math.abs(cur - x) > 0.5) setSL(el, x); });
      }
      [['edph', $('tscroll')], ['edph2', $('rscroll')]].forEach(([id, el]) => { const ph = $(id); if (!ph || !el) return; const w = el.clientWidth;
        const x = (scrubbing && el === touchSc) || trimOn ? w / 2 : w / 2 + disp * pps - SL.get.call(el)   /* semasa tarik pemegang playhead kekal di tengah (ikut CapCut) */, L = Math.round((el.offsetLeft + x) * 4) / 4, vis = x < -2 || x > w + 2 ? 'hidden' : '';
        const o = phX[id] || (phX[id] = {}); if (o.l !== L) { o.l = L; ph.style.left = L + 'px'; } if (o.v !== vis) { o.v = vis; ph.style.visibility = vis; } });
    }
    requestAnimationFrame(follow);
  }
  function timeline() {
    const tsc = $('tscroll'), rsc = $('rscroll'); if (!tsc || !rsc || tsc.dataset.cc) return; tsc.dataset.cc = '1';
    const ed = document.querySelector('.ed'), rb = document.querySelector('.rbar');
    if (ed && !$('edph')) ed.insertAdjacentHTML('beforeend', '<div class="edph" id="edph" aria-hidden="true"></div>');
    if (rb && !$('edph2')) rb.insertAdjacentHTML('beforeend', '<div class="edph" id="edph2" aria-hidden="true"></div>');
    [$('edph'), $('edph2')].forEach(ph => { if (!ph) return; const sc = ph.id === 'edph' ? tsc : rsc;
      const mv = e => { if (!phDrag) return; e.preventDefault(); const r = sc.getBoundingClientRect(); const pps = G('pps'); if (!pps) return;
        off = Math.max(0, Math.min(r.width, e.clientX - r.left)); const t = Math.max(0, (SL.get.call(sc) + off - sc.clientWidth / 2) / pps); disp = t;
        clearTimeout(seekT); seekT = setTimeout(() => { try { window.__edSeek = t; (0, eval)('seek(window.__edSeek); drawStickers && drawStickers();'); } catch (e2) {} }, 30); };
      ph.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); phDrag = 1; ph.setPointerCapture(e.pointerId); if (G('playing')) { try { (0, eval)('stop()'); } catch (e2) {} } });
      ph.addEventListener('pointermove', mv);
      ['pointerup', 'pointercancel'].forEach(ev => ph.addEventListener(ev, () => { phDrag = null; }));
    });
    const arm = () => { clearTimeout(endTm); endTm = setTimeout(() => { if (finger) return; scrubEnd(); }, 140); };
    /* 25 Nov: lepas tarik pemegang klip, enjin lukis semula timeline pada pointerup, jadi touchend hilang (elemen dah dibuang) dan "finger" tersangkut hidup:
       timeline berhenti ikut playhead sampai sentuhan seterusnya. pointerup (fasa capture, sebelum lukis semula) sentiasa sampai. */
    ['pointerdown', 'pointermove'].forEach(ev => addEventListener(ev, e => { lastPX = e.clientX; lastPY = e.clientY; }, true));
    addEventListener('pointerup', e => { if (e.pointerType !== 'mouse' && finger) { finger = false; if (scrubbing) arm(); } }, true);
    [tsc, rsc].forEach(sc => {
      lock(sc);
      const mark = () => { touchSc = sc; };
      ['touchstart', 'touchmove', 'pointerdown', 'wheel'].forEach(ev => sc.addEventListener(ev, mark, { passive: true }));
      sc.addEventListener('wheel', () => { wheelAt = Date.now(); }, { passive: true });
      const fin = e => { finger = e.touches.length > 0; if (!finger && scrubbing) arm(); };
      ['touchstart', 'touchend', 'touchcancel'].forEach(ev => sc.addEventListener(ev, fin, { passive: true }));
      sc.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { finger = true; const up = () => { finger = false; removeEventListener('pointerup', up, true); if (scrubbing) arm(); }; addEventListener('pointerup', up, true); } }, { passive: true });
      sc.addEventListener('scroll', () => {
        if (sc !== touchSc || G('dr')) return;
        if (!scrubbing) { if (!finger && Date.now() - wheelAt > 250) return; scrubStart(); }   // scroll oleh program, bukan jari
        const x = SL.get.call(sc), other = sc === tsc ? rsc : tsc; if (Math.abs(SL.get.call(other) - x) > 0.5) setSL(other, x);
        const pps = G('pps'); if (!pps) return;   /* seret timeline = scrub video; playhead tetap di tengah, video ikut jari tepat (tak melekat di hujung klip) */
        disp = Math.max(0, x / pps);
        if (edgeL && prevD != null && prevD !== disp) { const a = Math.min(prevD, disp), b = Math.max(prevD, disp); if (edgeL.some(e => e > a && e <= b)) flash(); }   // lalu hujung klip: kelip kuning + getaran (di phone yang benarkan)
        prevD = disp; arm();
      }, { passive: true });
      sc.addEventListener('touchstart', e => { if (e.touches.length === 2) { const z = $('zoom'); pinch = { d: Math.abs(e.touches[0].clientX - e.touches[1].clientX) || 1, z: +(z && z.value) || 25 }; } }, { passive: true });
      sc.addEventListener('touchmove', e => {
        if (!pinch || e.touches.length !== 2) return;
        const d = Math.abs(e.touches[0].clientX - e.touches[1].clientX) || 1, z = $('zoom'); if (!z) return;
        const v = Math.max(+z.min || 0, Math.min(+z.max || 100, Math.round(pinch.z + (d / pinch.d - 1) * 60)));
        if (+z.value !== v) { z.value = v; z.dispatchEvent(new Event('input', { bubbles: true })); }
      }, { passive: true });
      sc.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; }, { passive: true });
    });
    requestAnimationFrame(follow);
  }
  function build() {
    const top = $('top'), sc = document.querySelector('.stagecol'), tr = document.querySelector('.transport');
    if (!top || !sc || !tr || !$('tscroll')) return false;
    if (top.dataset.cc) return true;
    top.dataset.cc = '1';
    const edApp = (() => { try { return localStorage.getItem('edApp') === '1'; } catch (e) { return false; } })();   // app Editor sendiri (Home Screen): ✕ balik ke senarai projek, bukan Studio
    top.insertAdjacentHTML('afterbegin', edApp ? '<a class="edx" href="../../" aria-label="Senarai projek">✕</a>' : '<a class="edx" href="../../../#editor" aria-label="Balik ke Studio">✕</a>');
    top.insertAdjacentHTML('beforeend', '<button class="edsiap" id="edSiap" type="button">Siap</button>');
    const ic = n => `<svg class="ic"><use href="#${n}"/></svg>`;
    tr.insertAdjacentHTML('afterbegin', `<span class="cctc" id="ccTc">0:00</span>
      <button type="button" class="chip cc" data-p="toStart" aria-label="Ke permulaan">${ic('i-start')}</button>
      <button type="button" class="chip cc" data-p="fBack" aria-label="Undur 1 frame">${ic('i-fback')}</button>
      <button type="button" class="chip cc ccplay" data-p="play" aria-label="Main / henti"><svg class="ic"><use id="ccPlayIc" href="#i-play"/></svg></button>
      <button type="button" class="chip cc" data-p="fFwd" aria-label="Maju 1 frame">${ic('i-ffwd')}</button>
      <button type="button" class="chip cc" data-p="undo" aria-label="Undo">${ic('i-undo')}</button>
      <button type="button" class="chip cc ccredo" data-p="redo" aria-label="Redo">${ic('i-undo')}</button>
      <button type="button" class="chip cc cckey" data-p="split" aria-label="Belah klip">${ic('i-split')}</button>
      <button type="button" class="chip cc cckey" data-p="del" aria-label="Buang">${ic('i-del')}</button>
      <button type="button" class="chip cc ccswap" data-p="swapClip" aria-label="Tukar klip dipilih">⇄</button>
      <span class="ccsep" aria-hidden="true"></span>`);
    tr.insertAdjacentHTML('beforeend', `<button type="button" class="chip cc cctool" data-p="resetAll" aria-label="Reset ke editing asal">${ic('i-reset')}</button>`);
    /* 24 Nov: zoom di hujung kanan bar (sentiasa nampak): swipe kanan = besar, kiri = kecil. Butang main kedua di tepi kanan video. */
    tr.insertAdjacentHTML('beforeend', `<div class="cczoom" id="ccZoom" role="slider" aria-label="Zoom timeline, swipe kiri kanan"><span>−</span><b>🔍</b><span>+</span><i id="ccZv"></i></div>`);
    sc.insertAdjacentHTML('beforeend', `<button type="button" class="ccplay2" id="ccPlay2" aria-label="Main / henti"><svg class="ic"><use id="ccPlayIc2" href="#i-play"/></svg></button>`);
    $('ccPlay2').addEventListener('pointerdown', e => e.stopPropagation());
    $('ccPlay2').onclick = e => { e.stopPropagation(); e.preventDefault(); click('play'); };
    { const zb = $('ccZoom'); let z0 = null;
      const zv = () => { const z = $('zoom'); const v = $('ccZv'); if (z && v) v.style.width = ((+z.value - +z.min) / ((+z.max - +z.min) || 1) * 100) + '%'; };
      zb.addEventListener('pointerdown', e => { const z = $('zoom'); if (!z) return; e.preventDefault(); z0 = { x: e.clientX, v: +z.value }; zb.setPointerCapture(e.pointerId); zb.classList.add('on'); });
      zb.addEventListener('pointermove', e => { const z = $('zoom'); if (!z0 || !z) return; const v = Math.max(+z.min, Math.min(+z.max, Math.round(z0.v + (e.clientX - z0.x) * 0.6)));
        if (+z.value !== v) { z.value = v; z.dispatchEvent(new Event('input', { bubbles: true })); zv(); } });
      ['pointerup', 'pointercancel'].forEach(ev => zb.addEventListener(ev, () => { z0 = null; zb.classList.remove('on'); }));
      zv(); }
    const st = $('stage'); if (st) st.insertAdjacentHTML('beforeend', `<button type="button" class="ccbig" id="ccBig" aria-label="Besarkan video" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg></button>`);
    sc.insertAdjacentHTML('afterend', `<div class="edshd" id="edshd"><b id="ccTab"></b><span class="sp"></span></div>`);
    tr.addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (b) { e.stopPropagation(); click(b.dataset.p); } }, true);
    $('ccBig').addEventListener('pointerdown', e => e.stopPropagation());
    $('ccBig').onclick = e => { e.stopPropagation(); e.preventDefault(); const on = H.classList.toggle('edbig'); $('ccBig').setAttribute('aria-pressed', on); window.dispatchEvent(new Event('resize')); };
    /* ===== Fasa 2 (24 Nov 2026, Mira lulus lakaran v2): tepi kanan (DONE, masa, simpan, besarkan, main), MORE, lompat ‹ ›, + footage ===== */
    sc.insertAdjacentHTML('beforeend', `<div class="ccside" id="ccSide"><button type="button" class="ccdone" id="ccDone">DONE</button><span class="cctc2" id="ccTc2">0:00</span><span class="ccsv" id="ccSv" role="status"></span><span class="sp"></span></div>
      <button type="button" class="ccmore" id="ccMore" aria-haspopup="true" aria-expanded="false">MORE</button>`);
    $('ccSide').append($('ccBig'), $('ccPlay2'));
    const toSiap = () => { if (!goTab('Siap') && window.toast) toast('Butang render ada pada video terakhir projek ni'); };
    /* 24 Nov (Mira lulus): DONE buka helaian dua butang. Draf = terus hantar (Mac mini render, 0 token). Final = buka skrin Render dengan Final dipilih
       (pilihan Jobs / Creative dan fail asal perlu disemak dulu, jadi satu tekan UPLOAD lagi). */
    document.body.insertAdjacentHTML('beforeend', `<div class="ccveil" id="ccDVeil" hidden></div><div class="ccdsheet" id="ccDSheet" hidden role="dialog" aria-label="Render">
      <button type="button" class="big" data-r="draft"><b>Draf</b><span>540×960 · Mac mini render terus</span></button>
      <button type="button" class="big fin" data-r="final"><b>Final</b><span>1080×1920 · semak pilihan, kemudian UPLOAD</span></button>
      <button type="button" class="x" data-r="">Batal</button></div>`);
    { const sh = $('ccDSheet'), ve = $('ccDVeil'), open = on => { sh.hidden = ve.hidden = !on; };
      $('ccDone').onclick = e => { e.stopPropagation(); if (!document.querySelector('#tabs [data-tab="Siap"]')) return toSiap(); open(true); };
      ve.onclick = () => open(false);
      sh.onclick = e => { const b = e.target.closest('button'); if (!b) return; open(false); const r = b.dataset.r; if (!r) return;
        if (!goTab('Siap')) return toSiap();
        setTimeout(() => { const c = document.querySelector(`#panel [data-fp="render"][data-v="${r}"]`); if (c && c.getAttribute('aria-pressed') !== 'true') c.click();
          setTimeout(() => { const up = $('upload'); if (!up) return; if (r === 'draft') up.click(); else up.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 250); }, 250); }; }
    /* 24 Nov (Mira lulus): tekan lama kad preset = tengok warna ASAL selagi ditekan (banding sebelum / selepas). Tak ubah apa-apa, tak simpan. */
    { let tm = 0, held = false, x0 = 0, y0 = 0;
      const off = () => { clearTimeout(tm); if (!held) return; held = false; H.classList.remove('edcmp');
        try { (0, eval)('(function(){ const h = window.__edCmp; if (!h) return; const c = S.clips[h.i]; if (c) { if (h.g) c.grade = h.g; else delete c.grade; } window.__edCmp = null; lastGrade = ""; applyGrade(S.clips[curIdx]); gradeKick(); })()'); } catch (e) {} };
      document.addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('#panel .preset'); if (!b) return; x0 = e.clientX; y0 = e.clientY; clearTimeout(tm);
        tm = setTimeout(() => { try { (0, eval)('(function(){ const c = S.clips[curIdx]; if (!c || !c.grade) return; window.__edCmp = { i: curIdx, g: c.grade }; delete c.grade; lastGrade = ""; applyGrade(c); gradeKick(); })()'); } catch (e2) {}
          if (window.__edCmp) { held = true; H.classList.add('edcmp'); } }, 380); }, true);
      document.addEventListener('pointermove', e => { if (!held && (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8)) clearTimeout(tm); }, true);
      ['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => { const was = held; off(); if (was) { const stop = c => { c.stopPropagation(); c.preventDefault(); }; document.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => document.removeEventListener('click', stop, true), 400); } }, true));
      document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('#panel .preset')) e.preventDefault(); }); }
    { const sv = $('saved'), out = $('ccSv');
      const svs = () => { out.textContent = (sv.textContent || '').replace('Semua perubahan disimpan', 'Disimpan'); out.className = 'ccsv' + (/\berr\b/.test(sv.className) ? ' err' : ''); };
      if (sv) { new MutationObserver(svs).observe(sv, { childList: true, characterData: true, subtree: true, attributes: true }); svs(); } }
    /* MORE = bar ikon satu baris di bawah edit bar (Mira 24 Nov: bukan menu tulisan) */
    { const ic2 = n => `<svg class="ic" aria-hidden="true"><use href="#${n}"/></svg>`, sv = d => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
      const bt = (attr, label, icon) => `<button type="button" ${attr} aria-label="${label}" title="${label}">${icon}</button>`;
      tr.insertAdjacentHTML('afterend', `<div class="ccmenu" id="ccMenu" hidden role="toolbar" aria-label="More">` +
        bt('data-t="Sticker"', 'Stickers', ic2('i-star')) + bt('data-t="Bunyi"', 'Sounds', ic2('i-note')) + bt('data-t="Style Board"', 'Style Board', ic2('i-palette')) + bt('data-t="Siap"', 'Render', ic2('i-up')) +
        `<i aria-hidden="true"></i>` +
        bt('data-c="swapClip"', 'Tukar klip', sv('M4 8h14l-3-3M20 16H6l3 3')) + bt('data-c="muteClip"', 'Mute klip', ic2('i-sound')) + bt('data-c="mvL"', 'Alih klip ke kiri', ic2('i-left')) + bt('data-c="mvR"', 'Alih klip ke kanan', ic2('i-right')) + bt('data-sp="1"', 'Kelajuan klip', ic2('i-speed')) +
        bt('data-c="fBack"', 'Undur 1 frame', ic2('i-fback')) + bt('data-c="fFwd"', 'Maju 1 frame', ic2('i-ffwd')) + bt('data-c="resetAll"', 'Reset semua', ic2('i-reset')) +
        `<i aria-hidden="true"></i>` + bt('data-x="1"', 'Keluar editor', sv('M6 6l12 12M18 6L6 18')) + `</div>`); }
    { const menu = $('ccMenu'), more = $('ccMore');
      const open = on => { menu.hidden = !on; more.setAttribute('aria-expanded', on); window.dispatchEvent(new Event('resize')); };
      more.addEventListener('pointerdown', e => e.stopPropagation());
      more.onclick = e => { e.stopPropagation(); open(menu.hidden); };
      menu.onclick = e => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
        if (b.dataset.t) { open(false); if (b.dataset.t === 'Siap') toSiap(); else goTab(b.dataset.t); }
        else if (b.dataset.sp) { const f = G('spToggle'); if (f) f(); }   /* p25 */
        else if (b.dataset.c) click(b.dataset.c);          // alat klip: bar kekal terbuka (cth tekan frame berkali-kali)
        else if (b.dataset.x) location.href = edApp ? '../../' : '../../../#editor'; };
      const moreOn = () => more.classList.toggle('on', !menu.hidden || /^(Sticker|Bunyi|Style Board)$/.test(curTab()));
      new MutationObserver(moreOn).observe($('tabs'), { attributes: true, childList: true, subtree: true, attributeFilter: ['aria-selected'] });
      new MutationObserver(moreOn).observe(menu, { attributes: true, attributeFilter: ['hidden'] }); moreOn(); }
    tr.insertAdjacentHTML('beforeend', `<span class="ccjump"><button type="button" id="ccPrev" aria-label="Lompat ke effect / highlight / sticker sebelum"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg></button><button type="button" id="ccNext" aria-label="Lompat ke effect / highlight / sticker seterusnya"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6"/></svg></button></span>`);
    { const jump = dir => {
        const S = G('S'), pos = G('pos') || 0, t = curTab(), f = G('tabOf'); let xs = (S && S.stickers) || [];
        if (f && /^(Title|Highlight|Effects|Sticker)$/.test(t)) xs = xs.filter(x => { try { return f(x) === t; } catch (e) { return false; } });
        const ts = [...new Set(xs.map(x => +x.t).filter(v => v >= 0))].sort((a, b) => a - b);
        const to = dir > 0 ? ts.find(v => v > pos + 0.05) : ts.slice().reverse().find(v => v < pos - 0.05);
        if (to == null) { if (window.toast) toast(dir > 0 ? 'Tiada lagi selepas ni' : 'Tiada lagi sebelum ni'); return; }
        window.__edSeek = to; try { (0, eval)('if (playing) stop(); seek(window.__edSeek); drawStickers && drawStickers();'); } catch (e) {} };
      $('ccPrev').onclick = e => { e.stopPropagation(); jump(-1); }; $('ccNext').onclick = e => { e.stopPropagation(); jump(1); }; }
    { const rb = $('rbar'); if (rb) { rb.insertAdjacentHTML('beforeend', '<button type="button" class="ccadd" id="ccAdd" aria-label="Tambah footage">+</button>');
        $('ccAdd').addEventListener('pointerdown', e => e.stopPropagation()); $('ccAdd').onclick = e => { e.stopPropagation(); click('addFoot'); }; } }
    $('edSiap').onclick = () => { if (!goTab('Siap') && window.toast) toast('Butang render ada pada video terakhir projek ni'); };
    const tc = $('tc'), pi = $('playIc');
    const tcs = () => { const v = (tc.textContent || '').replace(/\s*·\s*f\d+/, ''); $('ccTc').textContent = v; const t2 = $('ccTc2'); if (t2) t2.textContent = v; };
    if (tc) { new MutationObserver(tcs).observe(tc, { childList: true, characterData: true, subtree: true }); tcs(); }
    if (pi) new MutationObserver(() => { $('ccPlayIc').setAttribute('href', pi.getAttribute('href')); const p2 = $('ccPlayIc2'); if (p2) p2.setAttribute('href', pi.getAttribute('href')); }).observe(pi, { attributes: true });
    new MutationObserver(sync).observe($('tabs'), { attributes: true, childList: true, subtree: true, attributeFilter: ['aria-selected'] });
    const inn = $('inner'); if (inn) new MutationObserver(() => { const j = curTab() === 'Potong' && (G('jnSel') > 0 || !!G('spOpen')); if (curTab() === 'Potong' && H.classList.contains('edsheet') !== j) sync(); else { rows(); pinVideo(); } }).observe(inn, { childList: true });
    const ed = document.querySelector('.ed'), pnl = $('panel');
    if (ed && pnl && !$('edlow')) { const low = document.createElement('div'); low.id = 'edlow'; low.className = 'edlow'; ed.parentNode.insertBefore(low, ed); low.append(ed, pnl); }
    sync(); timeline();
    return true;
  }
  let n = 0; const t = setInterval(() => { if (build() || ++n > 160) clearInterval(t); }, 250);
})();

/* ---- Caption gaya CapCut (2026-11-22): pratonton kecil, senarai Baris (▶ masa + ayat) atau Perenggan.
   Cara edit kekal: perkataan menyala ikut video, tap untuk betulkan terus. + Buang emm sekali tekan. ---- */
(function () {
  const $ = id => document.getElementById(id), H = document.documentElement;
  const G = n => { try { return (0, eval)(n); } catch (e) { return undefined; } };
  let mode = 'baris'; try { mode = localStorage.getItem('edCapMode') || 'baris'; } catch (e) {}
  const FILL = /^(e+m+|e+r+m+|a+h*|u+h+|u+m+|h+m+|e+h+)$/i;
  const fmt = t => { t = Math.max(0, t || 0); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); };
  function head() {
    const hd = $('edshd'); if (!hd) return;
    let box = $('ccCap');
    if (!H.classList.contains('edtab-Caption')) { if (box) box.hidden = true; return; }
    if (!box) {
      hd.insertAdjacentHTML('beforeend', `<span class="cccap" id="ccCap"><span class="ccseg" role="group" aria-label="Paparan caption"><button type="button" data-cm="baris">Baris</button><button type="button" data-cm="para">Perenggan</button></span><button type="button" id="ccHl">★ Highlight</button></span>`);
      box = $('ccCap');
      box.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.cm) { mode = b.dataset.cm; try { localStorage.setItem('edCapMode', mode); } catch (x) {} const w = $('words'); if (w) delete w.dataset.cc; apply(); }
        if (b.id === 'ccHl') { const o = $('hlBtn'); if (o) o.click(); setTimeout(head, 50); }
      });
    }
    box.hidden = false;
    box.querySelectorAll('[data-cm]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cm === mode));
    /* butang ★ highlight di kepala (23 Nov): ikut perkataan yang dipilih dalam senarai */
    const wSel = G('wSel'), KS = G('KEYSET'), hb = $('ccHl'), on = wSel >= 0 && KS && KS.has(wSel);
    hb.textContent = wSel >= 0 ? (on ? '★ Buang highlight' : '★ Jadi highlight') : '★ Highlight';
    hb.classList.toggle('on', !!on); hb.classList.toggle('ready', wSel >= 0);
  }
  function emm() {
    try {
      const S = G('S'); let n = 0;
      try { (0, eval)('snapshot()'); } catch (e) {}
      S.words.forEach(w => { if (!w.cut && FILL.test(String(w.t || '').replace(/[^\p{L}]/gu, ''))) { w.cut = true; n++; } });
      (0, eval)('touched(); refreshGroups(); draw();');
      if (window.toast) toast(n + ' emm dibuang. Undo kalau silap');
    } catch (e) { if (window.toast) toast('Tak dapat buang emm'); }
  }
  function apply() {
    head();
    const box = $('words'); if (!box || !H.classList.contains('edtab-Caption')) return;
    const want = mode === 'baris' ? 'baris' : 'para';
    if (box.dataset.cc === want) return;
    const spans = [...box.querySelectorAll('.w')];
    if (want === 'para') { box.classList.remove('edrows'); spans.forEach(s => box.appendChild(s)); box.querySelectorAll('.edrow').forEach(r => r.remove()); box.dataset.cc = 'para'; return; }
    let WT = null; try { WT = (0, eval)('WT || (WT = wordTimes())'); } catch (e) {}
    const tOf = {}; (WT || []).forEach(x => { if (x) tOf[x.i] = x.es; });
    const frag = document.createDocumentFragment(); let row = null, n = 0, last = -9;
    spans.forEach(s => {
      const i = +s.dataset.w, t = tOf[i], txt = s.textContent || '';
      const brk = !row || n >= 8 || (t != null && last > -9 && t - last > 0.7) || /[.?!]$/.test(row.lastTxt || '');
      if (brk) {
        row = document.createElement('div'); row.className = 'edrow';
        row.innerHTML = `<button type="button" class="edt" data-t="${t != null ? t : ''}" aria-label="Main dari sini">▶ ${t != null ? fmt(t) : '–'}</button><span class="edws"></span>`;
        frag.appendChild(row); n = 0;
      }
      row.querySelector('.edws').appendChild(s); row.lastTxt = txt; n++;
      if (t != null) { const b = row.querySelector('.edt'); if (b.dataset.t === '') { b.dataset.t = t; b.textContent = '▶ ' + fmt(t); } }
      if (t != null) last = t;
    });
    box.innerHTML = ''; box.appendChild(frag); box.classList.add('edrows'); box.dataset.cc = 'baris';
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#words')) setTimeout(head, 30); });
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.edrow .edt'); if (!b || b.dataset.t === '') return;
    e.stopPropagation();
    window.__edSeek = +b.dataset.t;
    try { (0, eval)('if (playing) stop(); seek(window.__edSeek);'); const p = document.querySelector('[data-p="play"]'); if (p) p.click(); } catch (x) {}
  }, true);
  let t = setInterval(() => {
    const p = $('panel'); if (!p) return; clearInterval(t);
    new MutationObserver(() => apply()).observe(p, { childList: true, subtree: true });
    new MutationObserver(() => { apply(); }).observe(H, { attributes: true, attributeFilter: ['class'] });
    apply();
  }, 300);
})();

/* ===== 25 Nov 2026 (Mira): panel Title / Caption / Highlight / Effects disusun gaya Adjust (bar ikon bahagian), butang safe zone di tepi video ===== */
(function () {
  const $ = id => document.getElementById(id), H = document.documentElement;
  const G = n => { try { return (0, eval)(n); } catch (e) { return undefined; } };
  const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const SEG = {
    words: ['Perkataan', 'M4 7h16M4 12h16M4 17h10'],
    pick: ['Pilih gaya', 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
    set: ['Laras', 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4'],
    list: ['Dalam video ni', 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01']
  };
  const ORDER = { Title: ['pick', 'set'], Caption: ['words', 'pick', 'set'], Highlight: ['pick', 'set'], Effects: ['pick', 'set', 'list'] };
  const cur = {}, had = {};
  const tabNow = () => { const c = [...H.classList].find(x => x.startsWith('edtab-')); return c ? c.slice(6) : ''; };
  function items(p, tab) {
    const out = []; let after = false;
    [...p.children].forEach(el => {
      if (el.classList.contains('ccpseg') || el.hidden) return;
      if (tab === 'Highlight' && el.id === 'ttTop') {
        [...el.children].forEach(c => out.push([c, c.classList.contains('hlwl') ? '' : c.classList.contains('grid') ? 'pick' : 'set']));
        return;
      }
      let k = 'set';
      if (tab === 'Effects') {
        if (el.classList.contains('catbar')) after = true;
        k = after ? 'pick' : el.id === 'fxList' || el.querySelector('[data-readd]') ? 'list' : 'set';
      } else if (el.querySelector('#words')) k = 'words';
      else if (el.querySelector('.grid')) k = 'pick';
      out.push([el, k]);
    });
    return out;
  }
  function apply() {
    const p = $('panel'); if (!p) return;
    const tab = tabNow(), ord = ORDER[tab]; let bar = p.querySelector(':scope > .ccpseg');
    if (!ord) { if (bar) bar.remove(); return; }
    const its = items(p, tab), kinds = ord.filter(k => its.some(x => x[1] === k));
    if (kinds.length < 2) { if (bar) bar.remove(); its.forEach(x => x[0].removeAttribute('data-ccoff')); return; }
    /* pilih effect / zoom pada timeline: borang muncul, terus ke bahagian Laras */
    const hasSet = kinds.includes('set');
    if (tab === 'Effects' && hasSet && !had[tab]) cur[tab] = 'set';
    had[tab] = hasSet;
    if (!kinds.includes(cur[tab])) cur[tab] = kinds[0];
    const sig = tab + ':' + kinds.join(',');
    if (!bar || bar.dataset.sig !== sig) {
      if (bar) bar.remove();
      bar = document.createElement('div'); bar.className = 'gseg ccpseg'; bar.dataset.sig = sig; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Bahagian ' + tab);
      bar.style.gridTemplateColumns = `repeat(${kinds.length}, 1fr)`;
      bar.innerHTML = kinds.map(k => `<button type="button" data-ccs="${k}" aria-label="${SEG[k][0]}" title="${SEG[k][0]}">${svg(SEG[k][1])}</button>`).join('');
      bar.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); cur[tabNow()] = b.dataset.ccs; apply(); p.scrollTop = 0; });
      p.prepend(bar);
    } else if (p.firstElementChild !== bar) p.prepend(bar);
    bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.ccs === cur[tab]));
    its.forEach(([el, k]) => { if (k && k !== cur[tab]) el.setAttribute('data-ccoff', '1'); else el.removeAttribute('data-ccoff'); });
  }
  let q = 0; const later = () => { if (q) return; q = requestAnimationFrame(() => { q = 0; apply(); }); };
  let t = setInterval(() => {
    const p = $('panel'), side = $('ccSide'), big = $('ccBig'); if (!p || !side || !big) return; clearInterval(t);
    new MutationObserver(later).observe(p, { childList: true, subtree: true });
    new MutationObserver(later).observe(H, { attributes: true, attributeFilter: ['class'] });
    apply();
    /* safe zone: butang kecil bawah butang besarkan */
    big.insertAdjacentHTML('afterend', `<button type="button" class="ccbig ccsafe" id="ccSafe" aria-label="Tunjuk safe zone" title="Safe zone" aria-pressed="false">${svg('M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4M9 9h6v6H9z')}</button>`);
    const sb = $('ccSafe');
    sb.addEventListener('pointerdown', e => e.stopPropagation());
    sb.onclick = e => {
      e.stopPropagation(); e.preventDefault();
      const b = document.createElement('button'); b.dataset.sz = '1'; b.hidden = true; p.appendChild(b); b.click(); b.remove();
      sb.setAttribute('aria-pressed', !!G('safeOn'));
    };
  }, 300);
})();

/* Kit Gaya (28 Nov 2026, Mira): preset Style Board yang sepadan dengan templat Design (Rujukan > Design > Editor).
   Senarai kit dari doc sync/kits (Mac mini terbitkan; kit baru dari "Minta jadi templat" masuk sendiri), dengan 3 kit asas sebagai sandaran.
   Guna pilihan editor SEDIA ADA sahaja (disemak wujud), jadi render_draft.py render sama. Kalau font "kit<id>" dah dipasang dalam
   enjin render (Rujukan > Templat > Pasang font kit), font tu dipakai. Cover reel ikut kit yang sama: Studio > Editor > Cover. */
(function () {
  const BASE = {
    doodle: { n: 'Doodle', s: { pal: 'brand', font: 'h3', capStyle: 'script', trans: 'cut', punch: true, titlePos: 'top', titleOutline: false, titleFx: 'drop', capFx: 'hop' } },
    comel: { n: 'Comel', s: { pal: 'pink', font: 'caveat', capStyle: 'pill', trans: 'paper', punch: false, titlePos: 'top', titleOutline: false, titleFx: 'hop', capFx: 'hop' } },
    majalah: { n: 'Majalah', s: { pal: 'tjean', font: 'luxe', capStyle: 'kotak', trans: 'dip', punch: false, titlePos: 'left', titleOutline: false, titleFx: 'land', capFx: 'fade' } }
  };
  const synced = () => { try { const c = JSON.parse(localStorage.getItem('mstudio:cache') || '{}'); const k = c['sync/kits']; return (k && Array.isArray(k.kits)) ? k.kits : []; } catch (e) { return []; } };
  let n = 0;
  const t = setInterval(() => {
    n++;
    let L = null;
    try { L = LOOKS; } catch (e) { if (n > 150) clearInterval(t); return; }   // enjin belum dimuat
    clearInterval(t);
    try {
      const has = (g, id) => OPTS[g].some(o => o.id === id);
      const ok = s => s && ['pal', 'font', 'capStyle', 'trans'].every(g => has(g, s[g])) && FX[s.titleFx] && FX[s.capFx];
      const list = {};
      Object.keys(BASE).forEach(id => { list[id] = { n: BASE[id].n, s: Object.assign({}, BASE[id].s) }; });
      synced().forEach(k => { if (k && k.id && k.editor) list[k.id] = { n: String(k.name || k.id), s: Object.assign({}, k.editor) }; });
      Object.keys(list).forEach(id => {
        const k = list[id];
        if (has('font', 'kit' + id)) k.s.font = 'kit' + id;      // font kit sebenar (bila dah dipasang dalam render)
        if (!ok(k.s) || L.some(x => x.id === 'kit' + id)) return;
        L.push({ id: 'kit' + id, n: 'Kit ' + k.n.replace(/^Kit\s+/i, ''), d: 'Sama dengan templat Design ' + k.n + '.', s: k.s });
      });
    } catch (e) {}
  }, 200);
})();
