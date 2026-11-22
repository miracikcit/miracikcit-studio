/* Editor reel dalam Studio PWA (2026-11-22). Dimuat SELEPAS runtime.js dan SEBELUM enjin editor (src/ dalam reel-page-template).
   - claude.use("db"): doc editor (edits/current, prefs/style, ...) disimpan dalam STUDIO_DATA sebagai edx/<id>~<path>.
     Doc lebih 45k aksara dipecah ke ~c0, ~c1 ... (had satu sel Sheet 49k).
   - Media (proxy.mp4, data.json, sfx/...) dihidang oleh sw.js dari Google Drive (manifest doc edpwa/<id>), disimpan dalam cache phone.
   - Butang Siap (sendUp) -> ED_SEND -> job ed_send: Mac mini buka sesi Claude dengan arahan yang sama. */
(function () {
  const m = location.pathname.match(/\/editor\/v\/([^/]+)\//);
  const VID = m ? decodeURIComponent(m[1]) : '';
  window.ED_VID = VID;
  try { sessionStorage.removeItem('ed404'); } catch (e) {}
  const LOCAL = location.hostname === 'localhost';
  const orig = claude.use.bind(claude);
  const err = (code, msg) => Object.assign(new Error(msg || code), { code });
  const key = p => 'edx/' + VID + '~' + String(p).replace(/\//g, '~');
  let base = null, pullOk = false;

  const once = path => new Promise(res => { let done = false; base.doc(path).onSnapshot(s => { if (done) return; done = true; res(s.exists ? s.data() : null); }); });
  async function readDoc(path) {
    const d = await once(path);
    if (!d || !d._c) return d;
    const parts = [];
    for (let i = 0; i < d._c; i++) { const c = await once(path + '~c' + i); if (!c) throw err('chunk', 'bahagian simpanan hilang'); parts.push(c.s); }
    return JSON.parse(parts.join(''));
  }
  async function writeDoc(path, obj) {
    const s = JSON.stringify(obj);
    if (s.length <= 45000) return base.doc(path).set(obj);
    const n = Math.ceil(s.length / 44000), w = [];
    for (let i = 0; i < n; i++) w.push(base.doc(path + '~c' + i).set({ s: s.slice(i * 44000, (i + 1) * 44000) }));
    await Promise.all(w);
    return base.doc(path).set({ _c: n, at: Date.now() });
  }

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
  });
  window.ED_FAIL = e => {
    const b = document.getElementById('boot');
    if (b) { b.hidden = false; b.innerHTML = 'Editor tak dapat dibuka: ' + String((e && e.message) || e) + '<br><a href="../../../#editor">Balik ke Studio</a>'; }
  };

  /* ---- Siap: hantar ke Mac mini ---- */
  window.ED_SEND = async (btn, payload, text, upMsg) => {
    upMsg('Menghantar ke Mac mini…');
    try {
      await new Promise(r => setTimeout(r, 1500));   // bagi simpanan terakhir sampai ke Sheet dulu
      await studioCall('job_add', { type: 'ed_send', input: { vid: VID, title: (window.ED_MAN || {}).title || '', dir: (window.ED_MAN || {}).dir || '', text, payload } });
      upMsg('Arahan dah sampai ke Mac mini. Sesi Claude akan dibuka di sana, tengok chat Claude kau.');
    } catch (e) { upMsg('Tak dapat hantar (' + ((e && (e.message || e.code)) || 'ralat') + '). Pilihan kau dah disimpan, cuba lagi.'); }
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
  const ROWS = { Title: /^(Video|Tajuk)$/, Caption: /^(Video|Caption|Highlight)$/, Effects: /^(Video|Effects|Zoom)$/, Sticker: /^(Video|Sticker)$/,
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
  function sync() {
    const t = curTab();
    H.classList.toggle('edsheet', !!t && t !== 'Potong');
    rows();
    const l = $('ccTab'); if (l) l.textContent = (document.querySelector('#tabs [aria-selected="true"] .tl, #tabs [aria-selected="true"]') || {}).textContent || t;
  }
  /* playhead tetap di tengah: #inner dan #rinner ada margin 50% (CSS), jadi scrollLeft = masa × pps.
     Enjin juga cuba scroll timeline semasa main (drawHead) — tulisan tu diabaikan supaya tak bergegar; hanya ed-boot yang scroll.
     Semasa main, kedudukan dilicinkan setiap frame (pos enjin bergerak berperingkat). */
  let touchAt = 0, seekT = 0, pinch = null, own = false, disp = 0, lastT = 0;
  const SL = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft');
  function lock(sc) {
    if (sc.dataset.lk) return; sc.dataset.lk = '1';
    Object.defineProperty(sc, 'scrollLeft', { configurable: true, get() { return SL.get.call(this); }, set(v) { if (own || Date.now() - touchAt < 900) SL.set.call(this, v); } });
  }
  function setSL(sc, x) { own = true; SL.set.call(sc, x); own = false; }
  function follow(t) {
    const sc = $('tscroll'), pps = G('pps'), pos = G('pos'), playing = G('playing');
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0; lastT = t;
    if (sc && pps && pos != null) {
      if (playing) { disp += dt; if (Math.abs(disp - pos) > 0.15) disp = pos; } else disp = pos;
      if (Date.now() - touchAt > 900) { const x = disp * pps; if (Math.abs(SL.get.call(sc) - x) > 0.5) setSL(sc, x); }
      const ph = $('edph'); if (ph) ph.style.left = (sc.offsetLeft + sc.clientWidth / 2) + 'px';
    }
    requestAnimationFrame(follow);
  }
  function timeline() {
    const sc = $('tscroll'); if (!sc || sc.dataset.cc) return; sc.dataset.cc = '1';
    lock(sc);
    const ed = document.querySelector('.ed'); if (ed && !$('edph')) ed.insertAdjacentHTML('beforeend', '<div class="edph" id="edph" aria-hidden="true"></div>');
    const mark = () => { touchAt = Date.now(); };
    ['touchstart', 'touchmove', 'pointerdown', 'wheel'].forEach(ev => sc.addEventListener(ev, mark, { passive: true }));
    sc.addEventListener('scroll', () => {
      if (Date.now() - touchAt > 900) return;   // scroll oleh program, bukan jari
      touchAt = Date.now();
      if (G('playing')) { try { (0, eval)('stop()'); } catch (e) {} }
      clearTimeout(seekT);
      seekT = setTimeout(() => { const pps = G('pps'); if (!pps) return; try { window.__edSeek = sc.scrollLeft / pps; (0, eval)('seek(window.__edSeek); drawStickers && drawStickers();'); } catch (e) {} }, 140);   // seek bila jari berhenti
    }, { passive: true });
    sc.addEventListener('touchstart', e => { if (e.touches.length === 2) { const z = $('zoom'); pinch = { d: Math.abs(e.touches[0].clientX - e.touches[1].clientX) || 1, z: +(z && z.value) || 25 }; } }, { passive: true });
    sc.addEventListener('touchmove', e => {
      if (!pinch || e.touches.length !== 2) return;
      const d = Math.abs(e.touches[0].clientX - e.touches[1].clientX) || 1, z = $('zoom'); if (!z) return;
      const v = Math.max(+z.min || 0, Math.min(+z.max || 100, Math.round(pinch.z + (d / pinch.d - 1) * 60)));
      if (+z.value !== v) { z.value = v; z.dispatchEvent(new Event('input', { bubbles: true })); }
    }, { passive: true });
    sc.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; }, { passive: true });
    requestAnimationFrame(follow);
  }
  function build() {
    const top = $('top'), sc = document.querySelector('.stagecol'), tr = document.querySelector('.transport');
    if (!top || !sc || !tr || !$('tscroll')) return false;
    if (top.dataset.cc) return true;
    top.dataset.cc = '1';
    top.insertAdjacentHTML('afterbegin', '<a class="edx" href="../../../#editor" aria-label="Balik ke Studio">✕</a>');
    top.insertAdjacentHTML('beforeend', '<button class="edsiap" id="edSiap" type="button">Siap</button>');
    const ic = n => `<svg class="ic"><use href="#${n}"/></svg>`;
    tr.insertAdjacentHTML('afterbegin', `<span class="cctc" id="ccTc">0:00</span>
      <button type="button" class="chip cc" data-p="fBack" aria-label="Undur 1 frame">${ic('i-fback')}</button>
      <button type="button" class="chip cc ccplay" data-p="play" aria-label="Main / henti"><svg class="ic"><use id="ccPlayIc" href="#i-play"/></svg></button>
      <button type="button" class="chip cc" data-p="fFwd" aria-label="Maju 1 frame">${ic('i-ffwd')}</button>
      <button type="button" class="chip cc" data-p="undo" aria-label="Undo">${ic('i-undo')}</button>
      <button type="button" class="chip cc cckey" data-p="split" aria-label="Belah klip">${ic('i-split')}</button>
      <button type="button" class="chip cc cckey" data-p="del" aria-label="Buang">${ic('i-del')}</button>
      <span class="ccsep" aria-hidden="true"></span>`);
    tr.insertAdjacentHTML('beforeend', `<button type="button" class="chip cc cctool" data-p="resetAll" aria-label="Reset ke editing asal">${ic('i-reset')}</button>`);
    const st = $('stage'); if (st) st.insertAdjacentHTML('beforeend', `<button type="button" class="ccbig" id="ccBig" aria-label="Besarkan video" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg></button>`);
    sc.insertAdjacentHTML('afterend', `<div class="edshd" id="edshd"><b id="ccTab"></b><span class="sp"></span><button type="button" id="ccOk" aria-label="Tutup panel, balik ke timeline">✓</button></div>`);
    tr.addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (b) { e.stopPropagation(); click(b.dataset.p); } }, true);
    $('ccBig').addEventListener('pointerdown', e => e.stopPropagation());
    $('ccBig').onclick = e => { e.stopPropagation(); e.preventDefault(); const on = H.classList.toggle('edbig'); $('ccBig').setAttribute('aria-pressed', on); window.dispatchEvent(new Event('resize')); };
    $('ccOk').onclick = () => { goTab('Potong'); H.classList.remove('edtl'); };
    $('edSiap').onclick = () => { if (!goTab('Siap') && window.toast) toast('Butang render ada pada video terakhir projek ni'); };
    const tc = $('tc'), pi = $('playIc');
    const tcs = () => { $('ccTc').textContent = (tc.textContent || '').replace(/\s*·\s*f\d+/, ''); };
    if (tc) { new MutationObserver(tcs).observe(tc, { childList: true, characterData: true, subtree: true }); tcs(); }
    if (pi) new MutationObserver(() => { $('ccPlayIc').setAttribute('href', pi.getAttribute('href')); }).observe(pi, { attributes: true });
    new MutationObserver(sync).observe($('tabs'), { attributes: true, childList: true, subtree: true, attributeFilter: ['aria-selected'] });
    const inn = $('inner'); if (inn) new MutationObserver(rows).observe(inn, { childList: true });
    sync(); timeline();
    return true;
  }
  let n = 0; const t = setInterval(() => { if (build() || ++n > 160) clearInterval(t); }, 250);
})();
