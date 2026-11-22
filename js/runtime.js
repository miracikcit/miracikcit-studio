/* Miracikcit Studio runtime: ganti window.claude (artifact) dengan Apps Script dalam Sheet CONTENT 2026.
   Data: tab STUDIO_DATA (sync semua device, simpan offline dalam peranti, hantar bila online semula).
   Sheets + Calendar + Drive: melalui Apps Script.  AI Ideas: Claude dalam Mac mini (guna usage Claude Mira). */
(function () {
  const API = window.STUDIO_CONFIG.api;
  const LS = k => 'mstudio:' + k;
  const lsGet = (k, d) => { try { const v = localStorage.getItem(LS(k)); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS(k), JSON.stringify(v)); } catch (e) {} };
  let CODE = location.hostname === 'localhost' ? 'mac-mini-dev' : lsGet('code', '');   // localhost: devserver.py tambah kunci worker
  const err = (code, message) => Object.assign(new Error(message || code), { code });

  async function call(action, body, opt) {
    if (!navigator.onLine) throw err('unavailable');
    let r;
    try {
      r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action, code: CODE }, body || {})), redirect: 'follow' });
    } catch (e) { throw err('unavailable'); }
    let j; try { j = await r.json(); } catch (e) { throw err('unavailable'); }
    if (!j.ok) { if (j.auth && !(opt && opt.noAuth)) { lsSet('code', ''); location.reload(); } throw err('tool_error', j.error); }
    return j;
  }

  /* ---------------- data store ---------------- */
  const cache = lsGet('cache', {});          // path -> data
  let since = lsGet('since', 0);
  let outbox = lsGet('outbox', []);          // [{p,d}]
  const colSubs = {}, docSubs = {};
  const persist = () => { lsSet('cache', cache); lsSet('since', since); lsSet('outbox', outbox); };
  const colOf = p => p.split('/').slice(0, -1).join('/');
  function emitCol(col) {
    (colSubs[col] || []).forEach(cb => {
      const docs = Object.keys(cache).filter(p => colOf(p) === col && cache[p] != null)
        .map(p => ({ id: p.split('/').pop(), data: () => JSON.parse(JSON.stringify(cache[p])) }));
      try { cb({ docs }); } catch (e) { console.error(e); }
    });
  }
  function emitDoc(p) { (docSubs[p] || []).forEach(cb => { try { cb({ exists: cache[p] != null, data: () => cache[p] == null ? undefined : JSON.parse(JSON.stringify(cache[p])) }); } catch (e) { console.error(e); } }); }
  function apply(p, d) { if (d == null) delete cache[p]; else cache[p] = d; emitCol(colOf(p)); emitDoc(p); }

  let pulling = false, flushing = false, firstPull = null;
  let pullOk = false, pulledRes; const pulled = new Promise(r => { pulledRes = r; });   // editor PWA tunggu tarikan pertama
  async function pull() {
    if (pulling) return; pulling = true;
    try {
      await flush();
      const j = await call('pull', { since });
      const pending = new Set(outbox.map(w => w.p));
      j.docs.forEach(x => { if (!pending.has(x.p)) apply(x.p, x.d); since = Math.max(since, x.u); });
      persist(); setNet('ok'); pullOk = true;
    } catch (e) { setNet(e.code === 'unavailable' ? 'offline' : 'err'); }
    finally { pulling = false; }
  }
  async function flush() {
    if (flushing || !outbox.length) return; flushing = true;
    try {
      while (outbox.length) {
        const batch = outbox.slice(0, 20);
        await call('put', { writes: batch });
        outbox = outbox.slice(batch.length); persist();
      }
    } finally { flushing = false; }
  }
  function write(p, d) {
    apply(p, d);
    outbox = outbox.filter(w => w.p !== p); outbox.push({ p, d }); persist();
    return flush().catch(e => { setNet(e.code === 'unavailable' ? 'offline' : 'err'); });
  }
  const db = {
    collection(col) {
      return {
        onSnapshot(cb) { (colSubs[col] = colSubs[col] || []).push(cb); if (Object.keys(cache).length || firstPull === 'done') emitColSoon(col); return () => {}; },
        doc(id) { return db.doc(col + '/' + id); }
      };
    },
    doc(p) {
      return {
        onSnapshot(cb) { (docSubs[p] = docSubs[p] || []).push(cb); if (Object.keys(cache).length || firstPull === 'done') setTimeout(() => emitDoc(p), 0); return () => {}; },
        set(d) { return write(p, d); },
        delete() { return write(p, null); }
      };
    }
  };
  const soon = new Set();
  function emitColSoon(col) { soon.add(col); setTimeout(() => { soon.forEach(emitCol); soon.clear(); }, 0); }

  /* ---------------- Sheets + Calendar (bentuk sama dengan connector lama) ---------------- */
  const watchers = [];
  const TOOLMAP = { get_values: 'get_values', update_values: 'update_values', list_events: 'cal_list', create_event: 'cal_create', update_event: 'cal_update', delete_event: 'cal_delete' };
  async function callTool(server, tool, args) {
    const a = TOOLMAP[tool]; if (!a) throw err('not_in_manifest');
    const j = await call(a, args);
    return { payload: j.payload || {} };
  }
  function runWatch(w) {
    callTool(w.server, w.tool, w.args).then(r => {
      lsSet('w:' + w.key, r.payload);
      w.cb({ type: 'data', result: { payload: r.payload, cache: { storedAt: Date.now() } } });
    }).catch(e => w.cb({ type: 'error', error: { code: e.code } }));
  }
  const mcp = {
    callTool,
    watchTool(server, tool, args, cb, opt) {
      const w = { server, tool, args, cb, key: tool + JSON.stringify(args) };
      watchers.push(w);
      const c = lsGet('w:' + w.key, null);
      if (c) setTimeout(() => cb({ type: 'data', result: { payload: c, cache: { storedAt: 0 } } }), 0);
      runWatch(w);
      const ms = Math.max(20000, (opt && opt.refetchInterval) || 60000);
      setInterval(() => { if (document.visibilityState === 'visible') runWatch(w); }, ms);
      return () => {};
    },
    async invalidate(server, tool) { watchers.filter(w => w.tool === tool).forEach(runWatch); }
  };

  /* ---------------- fail (Google Drive) ---------------- */
  const toB64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
  const assets = {
    async upload(f) { const j = await call('upload', { name: f.name, mime: f.type, b64: await toB64(f) }); return { id: j.id }; },
    async delete(id) { await call('file_delete', { id }); }
  };
  window.studioFileUrl = id => {
    const [fid, kind] = String(id || '').split('~');
    if (!kind) return '';
    return kind === 'i' ? 'https://lh3.googleusercontent.com/d/' + fid : 'https://drive.google.com/uc?export=download&id=' + fid;
  };
  window.studioFileView = id => 'https://drive.google.com/file/d/' + String(id || '').split('~')[0] + '/view';

  /* ---------------- AI Ideas: Claude di Mac mini ---------------- */
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return 'h' + (h >>> 0).toString(36); };
  const ask = msg => new Promise(res => {
    if (typeof window.confirmBox !== 'function') return res(confirm(msg));
    window.confirmBox(msg, () => res(true), 'Ya, generate');
    const off = () => { if (document.getElementById('scrim').hidden) { res(false); } else setTimeout(off, 400); };
    setTimeout(off, 400);
  });
  async function waitJob(id, maxMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      await new Promise(r => setTimeout(r, 4000));
      let j; try { j = (await call('job_get', { id })).job; } catch (e) { continue; }
      if (j.status === 'done') return j.output;
      if (j.status === 'error') throw err('tool_error', (j.output && j.output.error) || 'gagal');
    }
    throw err('timeout');
  }
  window.studioUsage = () => { const m = new Date().toISOString().slice(0, 7); return (lsGet('aiuse', {})[m]) || 0; };
  const sample = {
    async json(prompt) {
      const key = hash(prompt), done = lsGet('ai:' + key, null);
      if (done) return done;                              // jawapan sama, tiada token baru
      const n = window.studioUsage();
      const ok = await ask('Generate guna usage Claude kau (kecil, lebih kurang satu mesej pendek). Bulan ni dah ' + n + ' kali. Teruskan?');
      if (!ok) throw err('declined');
      let id = lsGet('aijob:' + key, '');
      if (!id) { id = (await call('job_add', { type: 'ai', input: { prompt } })).id; lsSet('aijob:' + key, id);
        const u = lsGet('aiuse', {}), m = new Date().toISOString().slice(0, 7); u[m] = (u[m] || 0) + 1; lsSet('aiuse', u); }
      if (window.toast) window.toast('Mac mini sedang tanya Claude');
      let outp;
      try { outp = await waitJob(id, 6 * 60000); } catch (e) { if (e.code !== 'timeout') lsSet('aijob:' + key, ''); throw e; }
      lsSet('ai:' + key, outp.json); lsSet('aijob:' + key, '');
      return outp.json;
    }
  };
  window.studioProductAdd = b => call('product_add', b);
  window.studioChunk = (id, start, len) => call('file_chunk', { id, start, len });
  window.studioJob = async (type, input, maxMs) => { const id = (await call('job_add', { type, input })).id; return waitJob(id, maxMs || 10 * 60000); };
  window.studioCall = call;

  /* ---------------- dictation (pengecaman suara browser) ---------------- */
  function dictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    let rec = null; const fin = [], st = [];
    return {
      start(o) {
        return new Promise((res, rej) => {
          rec = new SR(); rec.lang = (o && o.language === 'ms') ? 'ms-MY' : (o && o.language) || 'ms-MY';
          rec.continuous = true; rec.interimResults = false;
          rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) fin.forEach(f => f({ text: e.results[i][0].transcript })); };
          rec.onerror = e => rej(err(e.error === 'not-allowed' ? 'not_granted' : 'failed'));
          rec.onend = () => st.forEach(f => f({ state: 'idle' }));
          rec.onstart = () => res();
          try { rec.start(); } catch (e) { rej(err('failed')); }
        });
      },
      async stop() { rec && rec.stop(); },
      onFinal(f) { fin.push(f); }, onState(f) { st.push(f); }
    };
  }

  /* ---------------- downloads ---------------- */
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }
  };

  window.claude = {
    async use(name) {
      if (name === 'db') return db;
      if (name === 'mcp') return mcp;
      if (name === 'assets') return assets;
      if (name === 'sample') return sample;
      if (name === 'downloads') return downloads;
      if (name === 'dictation') { const d = dictation(); if (!d) throw err('capability_disabled'); return d; }
      throw err('capability_disabled');
    }
  };

  /* ---------------- status rangkaian ---------------- */
  let net = 'ok';
  function setNet(s) { if (s === net) return; net = s; const el = document.getElementById('netpill'); if (el) { el.hidden = s === 'ok'; el.textContent = s === 'offline' ? 'Offline · disimpan dalam phone' : 'Tak dapat sync'; } }
  window.addEventListener('online', () => pull());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
  setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 15000);

  /* ---------------- kod rahsia ---------------- */
  function gate() {
    return new Promise(resolve => {
      if (CODE) return resolve();
      const box = document.createElement('div');
      box.className = 'gate';
      box.innerHTML = `<div class="gate-in glass"><p class="eyebrow">Miracikcit Studio</p><h1 style="margin-bottom:10px">Masuk</h1>
        <p class="meta" id="gMsg">Taip kod rahsia Studio kau.</p>
        <input class="inp" id="gCode" type="password" autocomplete="current-password" placeholder="Kod rahsia" style="margin:12px 0">
        <button class="btn solid rose" id="gGo" style="width:100%">Masuk</button></div>`;
      document.body.appendChild(box);
      let fresh = false;
      call('hello', {}, { noAuth: true }).then(j => { if (!j.hasCode) { fresh = true; document.getElementById('gMsg').textContent = 'Kali pertama: cipta kod rahsia (sekurang-kurangnya 6 aksara). Semua device guna kod yang sama.'; document.getElementById('gGo').textContent = 'Cipta kod'; } }).catch(() => {});
      const go = async () => {
        const v = document.getElementById('gCode').value.trim(); if (!v) return;
        CODE = v;
        try {
          if (fresh) await call('setup', { code: v }, { noAuth: true });
          await call('check', {}, { noAuth: true });
          lsSet('code', v); box.remove(); resolve();
        } catch (e) { CODE = ''; document.getElementById('gMsg').textContent = e.code === 'unavailable' ? 'Tiada internet. Cuba lagi.' : 'Kod salah. Cuba lagi.'; }
      };
      document.getElementById('gGo').onclick = go;
      document.getElementById('gCode').onkeydown = e => { if (e.key === 'Enter') go(); };
    });
  }

  window.Studio = {
    ready: () => gate().then(() => { firstPull = 'started'; pull().then(() => { firstPull = 'done'; pulledRes(pullOk); Object.keys(colSubs).forEach(emitCol); Object.keys(docSubs).forEach(emitDoc); }); }),
    lock() { lsSet('code', ''); location.reload(); },
    pulled
  };
})();
