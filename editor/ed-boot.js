/* Editor reel dalam Studio PWA (2026-11-22). Dimuat SELEPAS runtime.js dan SEBELUM enjin editor (src/ dalam reel-page-template).
   - claude.use("db"): doc editor (edits/current, prefs/style, ...) disimpan dalam STUDIO_DATA sebagai edx/<id>~<path>.
     Doc lebih 45k aksara dipecah ke ~c0, ~c1 ... (had satu sel Sheet 49k).
   - Media (proxy.mp4, data.json, sfx/...) dihidang oleh sw.js dari Google Drive (manifest doc edpwa/<id>), disimpan dalam cache phone.
   - Butang Siap (sendUp) -> ED_SEND -> job ed_send: Mac mini buka sesi Claude dengan arahan yang sama. */
(function () {
  const m = location.pathname.match(/\/editor\/v\/([^/]+)\//);
  const VID = m ? decodeURIComponent(m[1]) : '';
  window.ED_VID = VID;
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

/* ---- Layout gaya CapCut (2026-11-22): ✕ + Siap di atas, rel tab kiri video, controller bawah video, panel tab jadi helaian bawah ---- */
(function () {
  const $ = id => document.getElementById(id);
  document.documentElement.classList.add('pwa');
  const click = id => { const b = $(id); if (b) b.click(); };
  const curTab = () => { const t = document.querySelector('#tabs [aria-selected="true"]'); return t ? t.dataset.tab : ''; };
  const goTab = n => { const t = document.querySelector(`#tabs [data-tab="${n}"]`); if (t) { t.click(); return true; } return false; };
  function sync() {
    const t = curTab(), sheet = !!t && t !== 'Potong';
    document.documentElement.classList.toggle('edsheet', sheet);
    const l = $('ccTab'); if (l) l.textContent = t;
  }
  function build() {
    const top = $('top'), sc = document.querySelector('.stagecol');
    if (!top || !sc || top.dataset.cc) return !!(top && top.dataset.cc);
    top.dataset.cc = '1';
    top.insertAdjacentHTML('afterbegin', '<a class="edx" href="../../../#editor" aria-label="Balik ke Studio">✕</a>');
    top.insertAdjacentHTML('beforeend', '<button class="edsiap" id="edSiap" type="button">Siap</button>');
    const ic = n => `<svg class="ic"><use href="#${n}"/></svg>`;
    sc.insertAdjacentHTML('afterend', `<div class="edctl" id="edctl">
      <button type="button" id="ccBig" aria-label="Besarkan video" aria-pressed="false"><svg class="ic" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
      <span class="cctc" id="ccTc">0:00 / 0:00</span>
      <button type="button" data-p="fBack" aria-label="Undur 1 frame">${ic('i-fback')}</button>
      <button type="button" data-p="play" class="ccplay" aria-label="Main / henti"><svg class="ic"><use id="ccPlayIc" href="#i-play"/></svg></button>
      <button type="button" data-p="fFwd" aria-label="Maju 1 frame">${ic('i-ffwd')}</button>
      <button type="button" data-p="undo" aria-label="Undo">${ic('i-undo')}</button>
    </div>
    <div class="edshd" id="edshd"><b id="ccTab"></b><span class="sp"></span><button type="button" id="ccTl" aria-pressed="false">Timeline</button><button type="button" id="ccOk" aria-label="Tutup panel, balik ke timeline">✓</button></div>`);
    $('edctl').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (b) click(b.dataset.p); });
    $('ccBig').onclick = () => { const on = document.documentElement.classList.toggle('edbig'); $('ccBig').setAttribute('aria-pressed', on); window.dispatchEvent(new Event('resize')); };
    $('ccTl').onclick = () => { const on = document.documentElement.classList.toggle('edtl'); $('ccTl').setAttribute('aria-pressed', on); };
    $('ccOk').onclick = () => { goTab('Potong'); document.documentElement.classList.remove('edtl'); };
    $('edSiap').onclick = () => { if (!goTab('Siap') && window.toast) toast('Butang render ada pada video terakhir projek ni'); };
    const tc = $('tc'), pi = $('playIc');
    if (tc) new MutationObserver(() => { $('ccTc').textContent = tc.textContent; }).observe(tc, { childList: true, characterData: true, subtree: true });
    if (pi) new MutationObserver(() => { $('ccPlayIc').setAttribute('href', pi.getAttribute('href')); }).observe(pi, { attributes: true });
    new MutationObserver(sync).observe($('tabs'), { attributes: true, childList: true, subtree: true, attributeFilter: ['aria-selected'] });
    sync();
    return true;
  }
  let n = 0; const t = setInterval(() => { if (build() || ++n > 120) clearInterval(t); }, 250);
})();
