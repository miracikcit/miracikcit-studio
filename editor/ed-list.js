/* Senarai app Editor (25 Nov 2026, Mira). APP EDITOR BERASINGAN dari Studio (editor/?app=1, ikon sendiri di Home Screen):
   SEMUA kerja edit (senarai video, New Video, editor) duduk di sini, bukan dalam tab Studio, supaya Mira boleh tukar antara dua app.
   Dipanggil oleh editor/index.html (edList). Gaya: ../css/editor-list.css (.edlist / .el-*). Tak bergantung pada kod tab Studio:
   hanya runtime (Studio.ready, claude.use('db'), studioCall). Lakaran diluluskan: claude.ai/artifact/D2qnWv9iCXEzXkZf1CTgDw */
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nrm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'baru tadi' : m < 60 ? m + ' minit lalu' : m < 1440 ? Math.round(m / 60) + ' jam lalu' : Math.round(m / 1440) + ' hari lalu'; };
  const isUrl = u => /^https?:\/\//i.test(String(u || '').trim());
  const hue = s => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const IC = { search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>', plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>', x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg>', cut: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.2 7.5 20 18M8.2 16.5 20 6"/></svg>', play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5z"/></svg>' };
  const MAXMB = 500;
  const T = { edpwa: [], tracker: [], toedit: null, F: 'all', q: '', qOpen: false, nw: null, menu: null, wait: [], loaded: false };
  let root, pick, pending = false, toastEl, toastH;
  const A = {};

  function toast(m) { if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'el-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); } toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastH); toastH = setTimeout(() => toastEl.classList.remove('show'), 2800); }

  /* ---- data ---- */
  const trackOf = pw => { const n = nrm(pw.title || ''); const d = String(pw.dir || '').toLowerCase(); return T.tracker.find(e => (e.folder && d.includes(String(e.folder).toLowerCase())) || (n.length >= 4 && nrm(e.name || '').length >= 4 && (n.includes(nrm(e.name)) || nrm(e.name).includes(n)))) || null; };
  function items() {
    const out = T.edpwa.filter(e => !e.pub && !e.hidden && (e.status !== 'error' || Date.now() - (e.updated || 0) < 2 * 864e5)).map(pw => ({ k: 'p:' + pw.id, pw, e: trackOf(pw), name: pw.title || pw.id, own: pw.src === 'sendiri', at: pw.updated || 0 }));
    T.wait.filter(w => Date.now() - w.at < 15 * 6e4 && !T.edpwa.some(x => x.src === 'sendiri' && (x.created || 0) > w.at - 6e4 && nrm(x.title || '') === nrm(w.name)))
      .forEach(w => out.push({ k: 'w:' + w.at, pw: { status: 'proses', pct: 1, step: 'Menunggu Mac mini' }, e: null, name: w.name, own: true, at: w.at }));
    const q = T.q.trim().toLowerCase();
    return out.filter(it => !q || (it.name + ' ' + ((it.e && it.e.style) || '')).toLowerCase().includes(q)).sort((a, b) => b.at - a.at);
  }
  function stat(it) { const pw = it.pw, d = pw.draft;
    if (pw.status === 'proses') return { t: 'Disediakan ' + Math.round(pw.pct || 0) + '%', c: 'var(--el-warn)', pct: Math.max(3, pw.pct || 0), sub: pw.step || 'Mac mini sedang sediakan' };
    if (pw.status === 'error') return { t: 'Ralat', c: 'var(--el-bad)', sub: String(pw.msg || 'Tak jadi').slice(0, 80) };
    if (d && d.status === 'proses') return { t: 'Render draf…', c: 'var(--el-warn)' };
    if (d && d.status === 'error') return { t: 'Draf gagal', c: 'var(--el-bad)' };
    if (d && d.id) return { t: 'Draf sedia', c: 'var(--el-ok)' };
    return { t: 'Sedia edit', c: 'var(--el-teal)' }; }
  const ready = it => !!(it.pw.id && it.pw.status !== 'proses' && it.pw.status !== 'error');
  const draftUrl = it => { const d = it.pw.draft; return d && d.status === 'sedia' && d.id ? 'https://drive.google.com/file/d/' + encodeURIComponent(d.id) + '/view' : ''; };

  /* ---- gambar poster: poster.jpg projek (Drive EDITOR PWA) melalui ed_chunk, disimpan dalam cache phone 'ed-posters' ---- */
  const EDP = { url: {}, q: [], busy: 0 };
  function posterId(pw) { const f = (pw && pw.files) || {}; if (f['poster.jpg']) return f['poster.jpg']; const k = Object.keys(f).filter(x => /(^|\/)poster\.jpg$/.test(x)).sort()[0]; return k ? f[k] : ''; }
  function pump() { while (EDP.busy < 2 && EDP.q.length) { const id = EDP.q.shift(); EDP.busy++; (async () => {
    try { const c = await caches.open('ed-posters'); let r = await c.match('/edp/' + encodeURIComponent(id));
      if (!r) { const j = await studioCall('ed_chunk', { id, start: 0, len: 900000 }); const bin = atob(j.b64 || ''); if (!bin.length) throw 0; const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        r = new Response(new Blob([u], { type: 'image/jpeg' })); await c.put('/edp/' + encodeURIComponent(id), r.clone()); }
      EDP.url[id] = URL.createObjectURL(await r.blob()); document.querySelectorAll('.edlist [data-edp="' + id + '"]').forEach(el => { el.style.backgroundImage = 'url(' + EDP.url[id] + ')'; el.classList.add('has'); }); }
    catch (e) { EDP.url[id] = ''; } finally { EDP.busy--; pump(); } })(); } }
  const thumb = it => { const id = posterId(it.pw), u = id && EDP.url[id]; return `<span class="el-th${u ? ' has' : ''}" style="--h:${hue(it.name)}${u ? `;background-image:url(${u})` : ''}"${id ? ` data-edp="${esc(id)}"` : ''}><span class="ini">${esc(String(it.name || 'V').trim().charAt(0).toUpperCase())}</span>`; };

  /* ---- paparan ---- */
  /* 26 Nov (Mira): footage tambahan yang di-AirDrop selepas projek dibuat (sync/edextra, ditulis mac-mini/airdrop.py) */
  const xOf = it => Object.entries((T.extra || {}).items || {}).filter(([k, e]) => e && e.vid === it.pw.id && (e.files || []).length).map(([k, e]) => Object.assign({ k }, e));
  const xPct = e => Math.max(1, Math.min(95, Math.round((Date.now() - (e.t0 || 0)) / (Math.max(1, e.n || e.files.length) * 25000 + 15000) * 100)));
  function xtra(it) { if (!it.pw.id) return ''; return xOf(it).map(e => { const n = e.files.length, run = e.status === 'proses' && Date.now() - (e.t0 || 0) < 30 * 6e4;
    return run ? `<div class="el-xtra run"><i class="el-xspin"></i>Masukkan ${n} footage · ${xPct(e)}%</div>`
      : `<div class="el-xtra"><button data-act="xGo" data-k="${esc(e.k)}">+${n} footage baru · ${e.status === 'error' ? 'Cuba lagi' : 'Masukkan'}</button><button class="no" data-act="xNo" data-k="${esc(e.k)}" aria-label="Tak perlu">${IC.x}</button></div>`; }).join(''); }
  A.xGo = async el => { const k = el.dataset.k, x = (T.extra || {}).items || {}, e = x[k]; if (!e) return; el.disabled = true;
    try { await studioCall('job_add', { type: 'air_wait', input: { extra: k } }); x[k] = Object.assign({}, e, { status: 'proses', t0: Date.now(), n: e.files.length }); render(true); toast('Mac mini sedang masukkan footage ke projek'); }
    catch (err) { el.disabled = false; toast('Mac mini tak jawab'); } };
  A.xNo = async el => { const k = el.dataset.k, x = (T.extra || {}).items || {}, keep = x[k]; if (!keep) return; delete x[k]; render(true);
    try { await studioCall('job_add', { type: 'air_wait', input: { extra: k, drop: true } }); toast('Okay, footage kekal dalam folder sahaja'); } catch (err) { x[k] = keep; render(true); toast('Mac mini tak jawab'); } };
  function card(it) { const s = stat(it), ok = ready(it), tag = ok ? 'a' : 'div', href = ok ? ` href="./?v=${encodeURIComponent(it.pw.id)}"` : '';
    return `<div class="el-card"><${tag} class="lk"${href}>${thumb(it)}<span class="el-pill" style="${s.c ? `--pc:${s.c}` : ''}">${esc(s.t)}</span></span><div class="bd"><h4>${esc(it.name)}</h4>${s.pct ? `<div class="el-bar"><i style="width:${Math.min(100, s.pct)}%"></i></div>` : ''}<span class="el-meta">${esc(s.sub || (it.at ? ago(it.at) : ''))}</span></div></${tag}>${xtra(it)}${it.k[0] === 'w' ? '' : `<button class="el-dots" data-act="menu" data-k="${esc(it.k)}" aria-label="Lagi untuk ${esc(it.name)}">${IC.dots}</button>`}</div>`; }
  function sheetNew() { const n = T.nw, up = n.up, mb = f => f.size >= 1048576 ? Math.round(f.size / 1048576) + ' MB' : Math.max(1, Math.round(f.size / 1024)) + ' KB';
    const st = ((T.toedit || {}).stages) || [], opts = n.src === 'mac' ? st.flatMap(s => (s.items || []).filter(i => i.clips > 0).map(i => `<option value="${esc(s.name + '|' + i.name)}">${esc(s.name.replace(/^\d+\.\s*/, ''))} / ${esc(i.name)} (${i.clips} klip)</option>`)).join('') : '';
    const body = n.src === 'phone' ? (n.files.length ? `<div class="el-picks">${n.files.map((f, i) => `<div class="el-pk"><video src="${n.urls[i]}#t=0.1" muted playsinline preload="metadata"></video><span class="sz">${mb(f)}</span>${up ? '' : `<button class="rm" data-act="nwRm" data-i="${i}" aria-label="Buang ${esc(f.name)}">${IC.x}</button>`}</div>`).join('')}${up ? '' : `<button class="el-add" data-act="nwPick" aria-label="Tambah video lagi">${IC.plus}</button>`}</div>`
        : `<button class="el-add wide" data-act="nwPick">${IC.plus}<span>Pilih video dari Photos</span></button>`)
      : (opts ? `<label class="el-fld"><span>Folder footage</span><select class="inp" id="enF">${opts}</select></label>` : `<div class="el-note">Tiada folder footage. Tekan Sync dalam tab Edit di Studio dulu.</div>`);
    return `<div class="el-dim" ${up ? '' : 'data-act="nwClose"'}></div><div class="el-sheet" role="dialog" aria-modal="true" aria-label="New Video">
      <div class="hd"><b>New Video</b>${up ? '' : `<button class="el-ib" data-act="nwClose" aria-label="Tutup">${IC.x}</button>`}</div>
      <div class="el-src"><button data-act="nwSrc" data-s="phone" aria-pressed="${n.src === 'phone'}"${up ? ' disabled' : ''}><b>Dari phone</b><span>Pilih video dari Photos</span></button><button data-act="nwSrc" data-s="mac" aria-pressed="${n.src === 'mac'}"${up ? ' disabled' : ''}><b>Dari Mac mini</b><span>Pilih folder footage</span></button></div>
      ${body}
      <label class="el-fld"><span>Nama video</span><input class="inp" id="enN" value="${esc(n.name || '')}" placeholder="${n.src === 'mac' ? 'Ikut nama folder' : 'Contoh: Unboxing mesin canai'}" autocomplete="off"${up ? ' disabled' : ''}></label>
      <div class="el-fld"><span>Masuk timeline</span><div class="el-seg"><button data-act="nwWhole" data-w="1" aria-pressed="${!!n.whole}"${up ? ' disabled' : ''}>Seluruh klip</button><button data-act="nwWhole" data-w="" aria-pressed="${!n.whole}"${up ? ' disabled' : ''}>6 saat pertama</button></div>
        <span class="el-note">${n.whole ? 'Seluruh klip masuk timeline (paling panjang 5 minit setiap klip).' : '6 saat pertama setiap klip masuk timeline; boleh panjangkan dalam editor.'}</span></div>
      ${up ? `<div class="el-prog" role="status"><div class="r"><span id="enPt">Muat naik ${up.k} daripada ${up.n}</span><b id="enPp">${up.pct}%</b></div><div class="el-bar"><i id="enPb" style="width:${Math.max(2, up.pct)}%"></i></div><span class="el-note">Jangan tutup app Editor sampai muat naik siap.</span></div>`
        : `<button class="el-cta" data-act="nwGo">Mula edit</button>`}</div>`; }
  function sheetMenu() { const it = items().find(x => x.k === T.menu); if (!it) { T.menu = null; return ''; } const s = stat(it), e = it.e, du = draftUrl(it);
    return `<div class="el-dim" data-act="menuClose"></div><div class="el-sheet" role="dialog" aria-modal="true" aria-label="${esc(it.name)}"><div class="hd"><b>${esc(it.name)}</b><button class="el-ib" data-act="menuClose" aria-label="Tutup">${IC.x}</button></div>
      <span class="el-meta">${esc([s.t, s.sub, e && e.style].filter(Boolean).join(' · '))}</span>
      <div class="el-acts">${ready(it) ? `<a class="el-btn go" href="./?v=${encodeURIComponent(it.pw.id)}">${IC.cut}Buka editor</a>` : ''}${du ? `<a class="el-btn" href="${du}" target="_blank" rel="noopener">${IC.play}Tengok draf</a>` : ''}${e && isUrl(e.chat) ? `<a class="el-btn" href="${esc(e.chat)}" target="_blank" rel="noopener">Chat Claude</a>` : ''}</div>
      ${it.pw.id ? (T.delAsk === it.k ? `<div class="el-del"><span class="el-meta">Buang ${esc(it.name)} dari senarai Editor? Footage asal tak disentuh.</span><div class="el-acts"><button class="el-btn bad" data-act="delGo" data-k="${esc(it.k)}">Ya, buang</button><button class="el-btn" data-act="delNo">Batal</button></div></div>`
        : `<div class="el-acts"><button class="el-btn bad" data-act="delAsk" data-k="${esc(it.k)}">Buang projek</button></div>`) : ''}</div>`; }
  function render(force) {
    if (!root) return; const ae = document.activeElement;
    if (!force && ae && root.contains(ae) && /^(INPUT|SELECT)$/.test(ae.tagName)) { pending = true; return; }
    pending = false;
    const all = items(), sets = { all, own: all.filter(it => it.own), claude: all.filter(it => !it.own) }, F = T.F, q = T.q.trim();
    const cont = F === 'all' && !q ? all.find(ready) : null, list = (sets[F] || []).filter(it => it !== cont);
    const chip = (k, l, n) => `<button class="el-chip" data-act="filt" data-f="${k}" aria-pressed="${F === k}">${l}<i>${n}</i></button>`;
    const y = scrollY;
    root.innerHTML = `<div class="edlist">
      <div class="el-top"><b>Editor</b><button class="el-ib" data-act="search" aria-pressed="${!!(T.qOpen || q)}" aria-label="Cari">${IC.search}</button></div>
      ${T.qOpen || q ? `<div class="el-search">${IC.search}<input class="inp" id="elQ" value="${esc(T.q)}" placeholder="Cari video" autocomplete="off"></div>` : ''}
      <button class="el-new" data-act="nwOpen"><span class="p">${IC.plus}</span><span><b>New Video</b><span>Tambah video dari phone, atau pilih folder di Mac mini</span></span></button>
      <div class="el-chips">${chip('all', 'Semua', all.length)}${chip('own', 'Edit sendiri', sets.own.length)}${chip('claude', 'Dari Claude', sets.claude.length)}</div>
      ${cont ? `<p class="el-eye">Sambung edit</p><div class="el-cont">${thumb(cont)}</span><div class="inf"><h3>${esc(cont.name)}</h3><span class="el-meta">${esc([cont.e && cont.e.style, cont.at ? 'diedit ' + ago(cont.at) : ''].filter(Boolean).join(' · '))}</span>
        <div class="el-btns"><a class="el-btn go" href="./?v=${encodeURIComponent(cont.pw.id)}">${IC.cut}Buka editor</a>${draftUrl(cont) ? `<a class="el-btn" href="${draftUrl(cont)}" target="_blank" rel="noopener">${IC.play}Draf</a>` : ''}<button class="el-btn" data-act="menu" data-k="${esc(cont.k)}" aria-label="Lagi">${IC.dots}</button></div></div></div>${xtra(cont)}` : ''}
      ${cont && list.length ? '<p class="el-eye">Semua video</p>' : ''}${list.length ? `<div class="el-grid">${list.map(card).join('')}</div>` : (cont ? '' : `<div class="el-empty">${!T.loaded ? 'Memuatkan video…' : q ? 'Tiada video sepadan dengan carian.' : 'Tiada video lagi. Ketik New Video untuk mula.'}</div>`)}
      <p class="el-foot el-meta">App Editor berasingan dari Studio. Tukar antara dua app dengan app switcher.</p>
      ${T.nw ? sheetNew() : T.menu ? sheetMenu() : ''}</div>`;
    scrollTo(0, y);
    root.querySelectorAll('[data-edp]').forEach(el => { const id = el.dataset.edp; if (id && EDP.url[id] === undefined) { EDP.url[id] = null; EDP.q.push(id); } }); pump();
  }

  /* ---- tindakan ---- */
  const keep = () => { if (T.nw && $('#enN')) T.nw.name = $('#enN').value; };
  const free = () => { if (T.nw) (T.nw.urls || []).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} }); };
  A.filt = el => { T.F = el.dataset.f; render(true); };
  A.search = () => { T.qOpen = !T.qOpen; if (!T.qOpen) T.q = ''; render(true); const i = $('#elQ'); if (i) i.focus(); };
  A.menu = el => { T.menu = el.dataset.k; render(true); };
  A.menuClose = () => { T.menu = null; T.delAsk = null; render(true); };
  /* 26 Nov (Mira): buang projek yang tak nak. Doc edpwa ditanda hidden (hilang dari senarai di semua phone); fail Drive dan footage kekal. */
  A.delAsk = el => { T.delAsk = el.dataset.k; render(true); };
  A.delNo = () => { T.delAsk = null; render(true); };
  A.delGo = async el => { const it = items().find(x => x.k === el.dataset.k); if (!it || !it.pw.id) return; el.disabled = true;
    try { const db = await claude.use('db'); const d = Object.assign({}, it.pw, { hidden: true, hiddenAt: Date.now() }); delete d.id; await db.doc('edpwa/' + it.pw.id).set(d);
      T.menu = null; T.delAsk = null; toast(it.name + ' dibuang dari senarai'); render(true); }
    catch (e) { el.disabled = false; toast('Tak dapat buang. Cuba lagi'); } };
  A.nwOpen = () => { T.menu = null; T.nw = { src: 'phone', files: [], urls: [], name: '', whole: true, up: null }; render(true); };
  A.nwClose = () => { if (!T.nw || T.nw.up) return; free(); T.nw = null; render(true); };
  A.nwSrc = el => { if (!T.nw || T.nw.up) return; keep(); T.nw.src = el.dataset.s; render(true); };
  A.nwWhole = el => { if (!T.nw || T.nw.up) return; keep(); T.nw.whole = !!el.dataset.w; render(true); };
  A.nwPick = () => { if (!pick) { pick = document.createElement('input'); pick.type = 'file'; pick.accept = 'video/*'; pick.multiple = true; pick.hidden = true; document.body.appendChild(pick); }
    pick.value = ''; pick.onchange = () => { const n = T.nw; if (!n || n.up) return; keep();
      [...pick.files].forEach(f => { if (n.files.length >= 30) return; if (f.size > MAXMB * 1048576) { toast(f.name + ' lebih ' + MAXMB + ' MB, dilangkau'); return; } if (!f.size) return; n.files.push(f); n.urls.push(URL.createObjectURL(f)); }); render(true); }; pick.click(); };
  A.nwRm = el => { const n = T.nw; if (!n || n.up) return; keep(); const i = +el.dataset.i; try { URL.revokeObjectURL(n.urls[i]); } catch (e) {} n.files.splice(i, 1); n.urls.splice(i, 1); render(true); };
  /* Dari phone: setiap video dimuat naik ke Drive (ustart / uchunk 8 MB), kemudian job ed_new {name, files, whole}; Mac mini simpan ke
     CLAUDE EDITS/R3 OWN EDITS/<nama>/ dan sediakan editor (0 token Claude). Dari Mac mini: job ed_new {stage, item, name, whole}. */
  A.nwGo = async () => { const n = T.nw; if (!n || n.up) return; keep(); const nm = (n.name || '').trim();
    if (n.src === 'mac') { const v = (($('#enF') || {}).value || '').split('|'); if (!v[1]) { toast('Pilih folder footage'); return; }
      try { await studioCall('job_add', { type: 'ed_new', input: { stage: v[0], item: v[1], name: nm || v[1], whole: !!n.whole } }); T.wait.push({ name: nm || v[1], at: Date.now() }); free(); T.nw = null; toast('Mac mini sedang sediakan editor'); render(true); }
      catch (e) { toast('Tak dapat hantar ke Mac mini. Cuba lagi'); } return; }
    if (!n.files.length) { toast('Pilih video dulu'); return; }
    const dt = new Date(), name = nm || ('Video ' + dt.getDate() + ' ' + BULAN[dt.getMonth()] + ' ' + String(dt.getHours()).padStart(2, '0') + String(dt.getMinutes()).padStart(2, '0'));
    n.name = name; n.up = { k: 1, n: n.files.length, pct: 0 }; render(true);
    const tot = n.files.reduce((a, f) => a + f.size, 0) || 1, ids = []; let sent = 0;
    const b64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });
    const paint = () => { const a = $('#enPt'), b = $('#enPp'), c = $('#enPb'); if (a) a.textContent = 'Muat naik ' + n.up.k + ' daripada ' + n.up.n; if (b) b.textContent = n.up.pct + '%'; if (c) c.style.width = Math.max(2, n.up.pct) + '%'; };
    try { for (let k = 0; k < n.files.length; k++) { const f = n.files[k], fn = f.name || ('video' + (k + 1) + '.mov'); n.up.k = k + 1; paint();
        const s = await studioCall('ustart', { name: fn, mime: f.type || 'video/quicktime', size: f.size }); const CH = 8 * 1048576; let pos = 0, id = null, tries = 0;
        while (pos < f.size && !id) { try { const r = await studioCall('uchunk', { url: s.url, start: pos, total: f.size, b64: await b64(f.slice(pos, pos + CH)) }); if (r.id) id = r.id; else pos = r.next; tries = 0; } catch (e) { if (++tries > 3) throw e; await new Promise(r => setTimeout(r, 2000 * tries)); }
          n.up.pct = Math.min(99, Math.round((sent + (id ? f.size : pos)) / tot * 100)); paint(); }
        if (!id) throw new Error('Drive tak bagi id fail'); sent += f.size; ids.push({ id, name: fn, size: f.size }); }
      await studioCall('job_add', { type: 'ed_new', input: { name, files: ids, whole: !!n.whole } });
      T.wait.push({ name, at: Date.now() }); free(); T.nw = null; toast('Siap muat naik. Mac mini sedang sediakan editor'); render(true); }
    catch (e) { ids.forEach(x => studioCall('file_delete', { id: x.id }).catch(() => {})); n.up = null; toast('Muat naik tak jadi: ' + String((e && e.message) || 'semak internet').slice(0, 70)); render(true); } };

  window.EdList = { T, A, render,
    async start(box) { root = box; document.body.classList.add('edapp'); render(true);
      root.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el || el.disabled) return; const f = A[el.dataset.act]; if (f) f(el); });
      root.addEventListener('input', e => { if (e.target.id === 'elQ') { T.q = e.target.value; pending = true; } });
      root.addEventListener('focusout', () => setTimeout(() => { const ae = document.activeElement; if (pending && !(ae && root.contains(ae) && /^(INPUT|SELECT)$/.test(ae.tagName))) render(); }, 250));
      root.addEventListener('keydown', e => { if (e.target.id === 'elQ' && e.key === 'Enter') e.target.blur(); });
      await Studio.ready(); const db = await claude.use('db');
      const col = (name, key) => db.collection(name).onSnapshot(snap => { T[key] = snap.docs.map(d => Object.assign({}, d.data(), { id: d.id })); if (name === 'edpwa') T.loaded = true; render(); });
      col('edpwa', 'edpwa'); col('editor', 'tracker');
      db.doc('sync/edextra').onSnapshot(s => { T.extra = s.exists ? s.data() : null; render(); });
      setInterval(() => { if (Object.values((T.extra || {}).items || {}).some(e => e && e.status === 'proses') && document.visibilityState === 'visible' && !T.nw && !T.menu) render(); }, 5000);
      db.doc('sync/toedit').onSnapshot(s => { T.toedit = s.exists ? s.data() : null; if (T.nw && T.nw.src === 'mac') render(); });
      setInterval(() => { if (T.wait.length && document.visibilityState === 'visible') render(); }, 20000); } };
})();
