/**
 * Miracikcit Studio + Transcribe: backend dalam Google Sheet CONTENT 2026.
 * Satu web app untuk tiga pengguna:
 *   - Mac mini worker (kunci WORKER_KEY, sama dengan config.json)
 *   - app Studio PWA (kod rahsia APP_CODE yang Mira cipta sendiri dalam app)
 * Tiada rahsia dalam kod ni. Kunci disimpan dalam Script Properties.
 */
const TZ = 'Asia/Kuala_Lumpur';
const TR_TAB = 'Transcribe';
const TR_COLS = ['id', 'link', 'tarikh_tambah', 'status', 'platform', 'tajuk', 'tempoh', 'bahasa',
                 'transkrip', 'transkrip_timestamp', 'isi_penting', 'ralat', 'tarikh_siap'];
const DATA_TAB = 'STUDIO_DATA';   // path | json | updated(ms) | deleted
const JOB_TAB = 'STUDIO_JOBS';    // id | type | status | input | output | created | done
const CAL_MARK = '#miracikcitstudio';
const DRIVE_FOLDER = 'Miracikcit Studio Files';

function doGet() { return out({ ok: true, msg: 'Miracikcit Studio aktif' }); }

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'permintaan rosak' }); }
  const props = PropertiesService.getScriptProperties();
  try {
    // ---- Mac mini worker ----
    if (b.key !== undefined) {
      let wk = props.getProperty('WORKER_KEY');
      if (!wk && String(b.key).length >= 20) { props.setProperty('WORKER_KEY', String(b.key)); wk = String(b.key); }
      if (b.key !== wk) return out({ ok: false, error: 'kunci salah' });
      return out(worker(b));
    }
    // ---- app Studio ----
    const code = props.getProperty('APP_CODE');
    if (b.action === 'hello') return out({ ok: true, hasCode: !!code });
    if (b.action === 'setup') {
      if (code) return out({ ok: false, error: 'kod dah wujud' });
      if (!b.code || String(b.code).length < 6) return out({ ok: false, error: 'kod terlalu pendek' });
      props.setProperty('APP_CODE', String(b.code));
      return out({ ok: true });
    }
    if (!code || b.code !== code) return out({ ok: false, error: 'kod salah', auth: true });
    return out(app(b));
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

/* ================= worker ================= */
function worker(b) {
  const ss = SpreadsheetApp.getActive();
  if (b.action === 'ping') { seen(); return { ok: true }; }
  if (b.action === 'poll' || b.action === 'update') return withLock(() => {
    seen();
    const sh = ss.getSheetByName(TR_TAB);
    if (!sh) return { ok: false, error: 'tab Transcribe tiada' };
    if (b.action === 'poll') {
      const last = sh.getLastRow(), jobs = [];
      if (last >= 2) sh.getRange(2, 1, last - 1, TR_COLS.length).getDisplayValues().forEach((r, i) => {
        const st = r[3];
        if (!r[0] || !r[1]) return;
        if (st === 'Dalam giliran' || st === 'Jana semula' || (b.reset && st === 'Sedang transkrip'))
          jobs.push({ row: i + 2, id: r[0], link: r[1], status: st === 'Sedang transkrip' ? 'Dalam giliran' : st,
                      transkrip: st === 'Jana semula' ? r[8] : '', bahasa: r[7] });
      });
      return { ok: true, jobs };
    }
    let row = Number(b.row);
    if (!(row >= 2) || sh.getRange(row, 1).getDisplayValue() !== b.id) {
      const ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getDisplayValues().map(r => r[0]);
      row = ids.indexOf(String(b.id)) + 1;
      if (row < 2) return { ok: false, error: 'baris dengan id ni tiada' };
    }
    Object.keys(b.fields || {}).forEach(k => {
      const c = TR_COLS.indexOf(k);
      if (c >= 0) sh.getRange(row, c + 1).setNumberFormat('@').setValue(String(b.fields[k]).slice(0, 49000));
    });
    return { ok: true, row };
  });
  if (b.action === 'jpoll') { seen(); return { ok: true, jobs: jobList('queued').map(j => ({ id: j.id, type: j.type, input: j.input })) }; }
  if (b.action === 'jstart') return withLock(() => jobSet(b.id, { status: 'running' }));
  if (b.action === 'jdone') return withLock(() => jobSet(b.id, { status: b.error ? 'error' : 'done', output: b.output || { error: b.error }, done: Date.now() }));
  if (b.action === 'dget') return { ok: true, doc: dataGet(b.path) };
  if (b.action === 'dset') return withLock(() => ({ ok: true, u: dataPut(b.path, b.data) }));
  if (b.action === 'upload') return app(b);
  // Drive untuk Mac mini: video final (00. TO POST FINAL) dan arkib product listing. Token kekal dalam Google;
  // Mac mini hanya dapat link muat naik sekali guna untuk satu fail.
  if (b.action === 'dpath') return { ok: true, id: drivePath(b.base, b.path || [], b.share) };
  if (b.action === 'rstart') {
    const r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
      method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
      payload: JSON.stringify({ name: String(b.name), parents: [String(b.parent)] }),
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': b.mime || 'application/octet-stream', 'X-Upload-Content-Length': String(b.size) } });
    const loc = r.getHeaders().Location || r.getHeaders().location;
    return loc ? { ok: true, url: loc } : { ok: false, error: 'Drive tolak: ' + r.getContentText().slice(0, 200) };
  }
  if (b.action === 'dquota') return { ok: true, used: DriveApp.getStorageUsed(), limit: DriveApp.getStorageLimit() };
  if (b.action === 'dtrash') { try { DriveApp.getFileById(String(b.id)).setTrashed(true); } catch (e) { try { DriveApp.getFolderById(String(b.id)).setTrashed(true); } catch (e2) {} } return { ok: true }; }
  if (b.action === 'dcount') return { ok: true, n: countFiles(DriveApp.getFolderById(String(b.id))) };
  if (b.action === 'dchunk') {   // Tiru Gaya: Mac mini muat turun video rujukan dari Drive, sekeping-sekeping
    const f = DriveApp.getFileById(String(b.id));
    const total = f.getSize(), start = Math.max(0, Number(b.start) || 0);
    if (start >= total) return { ok: true, total: total, start: start, name: f.getName(), b64: '' };
    const end = Math.min(total, start + Math.min(Number(b.len) || 15000000, 20000000)) - 1;
    const r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + f.getId() + '?alt=media', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=' + start + '-' + end }, muteHttpExceptions: true });
    if (r.getResponseCode() >= 300) return { ok: false, error: 'Drive ' + r.getResponseCode() };
    return { ok: true, total: total, start: start, name: f.getName(), mime: f.getMimeType(), b64: Utilities.base64Encode(r.getBlob().getBytes()) };
  }
  if (b.action === 'file_get') {
    const f = DriveApp.getFileById(String(b.id).split('~')[0]);
    if (f.getSize() > 35 * 1048576) return { ok: false, error: 'fail terlalu besar' };
    return { ok: true, name: f.getName(), mime: f.getMimeType(), b64: Utilities.base64Encode(f.getBlob().getBytes()) };
  }
  return app(b);   // Mac mini (pemilik sama) boleh guna semua tindakan app, untuk ujian dan migrasi
}

function seen() {
  const sh = SpreadsheetApp.getActive().getSheetByName(TR_TAB);
  if (!sh) return;
  sh.getRange('O1').setValue('mac_last_seen');
  sh.getRange('P1').setNumberFormat('@').setValue(new Date().toISOString());
}

/* ================= app ================= */
function app(b) {
  switch (b.action) {
    case 'check': return { ok: true };
    case 'pull': {
      const since = Number(b.since) || 0, rows = dataRows(), docs = [];
      rows.forEach(r => { if (r.u > since) docs.push({ p: r.p, d: r.del ? null : JSON.parse(r.j || 'null'), u: r.u }); });
      return { ok: true, docs, now: Date.now() };
    }
    case 'put': return withLock(() => {
      const res = (b.writes || [{ p: b.p, d: b.d }]).map(w => dataPut(w.p, w.d));
      return { ok: true, u: res[res.length - 1] };
    });
    case 'get_values': {
      const rng = openSs(b.spreadsheetId).getRange(b.range);
      return { ok: true, payload: { values: trimValues(rng.getDisplayValues()) } };
    }
    case 'update_values': return withLock(() => {
      const ss = openSs(b.spreadsheetId);
      const vals = b.values || [[]], w = Math.max.apply(null, vals.map(r => r.length).concat([1]));
      const pad = vals.map(r => { const a = r.slice(); while (a.length < w) a.push(''); return a; });
      ss.getRange(b.range).offset(0, 0, pad.length, w).setValues(pad);
      return { ok: true, payload: {} };
    });
    case 'cal_list': return { ok: true, payload: { events: calList(b) } };
    case 'cal_create': return { ok: true, payload: calSave(null, b) };
    case 'cal_update': return { ok: true, payload: calSave(b.eventId, b) };
    case 'cal_delete': { const ev = CalendarApp.getDefaultCalendar().getEventById(b.eventId); if (ev) ev.deleteEvent(); return { ok: true, payload: {} }; }
    case 'upload': {
      const blob = Utilities.newBlob(Utilities.base64Decode(b.b64), b.mime || 'application/octet-stream', b.name || 'fail');
      const f = folder().createFile(blob);
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const kind = /^image\//.test(b.mime) ? 'i' : /^audio\//.test(b.mime) ? 'a' : /pdf/.test(b.mime) ? 'p' : 'f';
      return { ok: true, id: f.getId() + '~' + kind };
    }
    case 'file_chunk': {   // video final ke phone, sekeping-sekeping (Google sekat fetch terus dari app)
      const f = DriveApp.getFileById(String(b.id));
      const ps = f.getParents(); let okp = false;
      while (ps.hasNext()) if (ps.next().getName() === 'TO POST FINAL') { okp = true; break; }
      if (!okp) return { ok: false, error: 'fail ni bukan video final' };
      const total = f.getSize(), start = Math.max(0, Number(b.start) || 0);
      const end = Math.min(total, start + Math.min(Number(b.len) || 8000000, 20000000)) - 1;
      const r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + f.getId() + '?alt=media', {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=' + start + '-' + end }, muteHttpExceptions: true });
      if (r.getResponseCode() >= 300) return { ok: false, error: 'Drive ' + r.getResponseCode() };
      return { ok: true, total: total, start: start, b64: Utilities.base64Encode(r.getBlob().getBytes()) };
    }
    case 'ed_chunk': {   // Editor reel PWA: media editor (Drive EDITOR PWA/...) ke phone, sekeping-sekeping
      const f = DriveApp.getFileById(String(b.id));
      let okp = false, lv = [f.getParents()];
      for (let d = 0; d < 3 && !okp; d++) { const nx = []; lv.forEach(ps => { while (ps.hasNext()) { const x = ps.next(); if (x.getName() === 'EDITOR PWA') okp = true; nx.push(x.getParents()); } }); lv = nx; }
      if (!okp) return { ok: false, error: 'fail ni bukan media editor' };
      const total = f.getSize(), start = Math.max(0, Number(b.start) || 0);
      if (start >= total) return { ok: true, total: total, start: start, b64: '' };
      const end = Math.min(total, start + Math.min(Number(b.len) || 8000000, 20000000)) - 1;
      const r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + f.getId() + '?alt=media', {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=' + start + '-' + end }, muteHttpExceptions: true });
      if (r.getResponseCode() >= 300) return { ok: false, error: 'Drive ' + r.getResponseCode() };
      return { ok: true, total: total, start: start, b64: Utilities.base64Encode(r.getBlob().getBytes()) };
    }
    case 'ustart': {   // Tiru Gaya: upload video rujukan dari phone terus ke Drive FOOTAGE/GAYA/_UPLOAD (sekeping-sekeping)
      const parent = drivePath('studio', ['FOOTAGE', 'GAYA', '_UPLOAD']);
      const r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
        method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
        payload: JSON.stringify({ name: String(b.name || 'rujukan.mp4'), parents: [parent] }),
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': b.mime || 'video/mp4', 'X-Upload-Content-Length': String(b.size) } });
      const loc = r.getHeaders().Location || r.getHeaders().location;
      return loc ? { ok: true, url: loc } : { ok: false, error: 'Drive tolak: ' + r.getContentText().slice(0, 200) };
    }
    case 'uchunk': {
      if (!/^https:\/\/www\.googleapis\.com\/upload\/drive\//.test(String(b.url))) return { ok: false, error: 'link upload tak sah' };
      const bytes = Utilities.base64Decode(b.b64), start = Number(b.start) || 0, end = start + bytes.length - 1;
      const r = UrlFetchApp.fetch(String(b.url), { method: 'put', payload: bytes, contentType: 'application/octet-stream', muteHttpExceptions: true,
        headers: { 'Content-Range': 'bytes ' + start + '-' + end + '/' + b.total } });
      const code = r.getResponseCode();
      if (code === 308) return { ok: true, next: end + 1 };
      if (code === 200 || code === 201) return { ok: true, id: JSON.parse(r.getContentText()).id };
      return { ok: false, error: 'Drive ' + code + ': ' + r.getContentText().slice(0, 150) };
    }
    case 'product_add': return withLock(() => productAdd(b));   // Caption: simpan produk / VID baru ke tab PRODUCTS
    case 'file_delete': { try { DriveApp.getFileById(String(b.id).split('~')[0]).setTrashed(true); } catch (e) {} return { ok: true }; }
    case 'job_add': return withLock(() => {
      const sh = sheet(JOB_TAB, ['id', 'type', 'status', 'input', 'output', 'created', 'done']);
      const id = 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      sh.appendRow([id, b.type, 'queued', JSON.stringify(b.input || {}), '', Date.now(), '']);
      return { ok: true, id };
    });
    case 'job_get': { const j = jobList().find(x => x.id === b.id); return j ? { ok: true, job: j } : { ok: false, error: 'kerja tiada' }; }
    case 'status': {
      const sh = SpreadsheetApp.getActive().getSheetByName(TR_TAB);
      return { ok: true, macSeen: sh ? sh.getRange('P1').getDisplayValue() : '', queued: jobList('queued').length };
    }
  }
  return { ok: false, error: 'tindakan tak dikenali' };
}

/* ================= data store ================= */
function dataRows() {
  const sh = sheet(DATA_TAB, ['path', 'json', 'updated', 'deleted']);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 4).getValues().map((r, i) => ({ row: i + 2, p: String(r[0]), j: String(r[1]), u: Number(r[2]) || 0, del: r[3] === true || r[3] === 'TRUE' }));
}
function dataGet(path) { const r = dataRows().find(x => x.p === path && !x.del); return r ? JSON.parse(r.j) : null; }
function dataPut(path, data) {
  if (!/^[A-Za-z0-9_\-.~:@+]+(\/[A-Za-z0-9_\-.~:@+]+)+$/.test(String(path))) throw new Error('path salah');
  const sh = sheet(DATA_TAB, ['path', 'json', 'updated', 'deleted']);
  const json = data === null || data === undefined ? '' : JSON.stringify(data);
  if (json.length > 49000) throw new Error('dokumen terlalu besar');
  let u = Date.now();
  const rows = dataRows(), r = rows.find(x => x.p === path);
  const maxU = rows.reduce((m, x) => Math.max(m, x.u), 0);
  if (u <= maxU) u = maxU + 1;             // masa sentiasa naik, supaya pull tak terlepas
  const vals = [[path, json, u, json === '']];
  if (r) sh.getRange(r.row, 1, 1, 4).setValues(vals); else sh.getRange(sh.getLastRow() + 1, 1, 1, 4).setValues(vals);
  return u;
}

/* ================= jobs ================= */
function jobList(status) {
  const sh = sheet(JOB_TAB, ['id', 'type', 'status', 'input', 'output', 'created', 'done']);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 7).getValues()
    .map((r, i) => ({ row: i + 2, id: String(r[0]), type: String(r[1]), status: String(r[2]), input: safe(r[3]), output: safe(r[4]), created: Number(r[5]) || 0, done: Number(r[6]) || 0 }))
    .filter(j => !status || j.status === status);
}
function jobSet(id, patch) {
  const j = jobList().find(x => x.id === id);
  if (!j) return { ok: false, error: 'kerja tiada' };
  const sh = SpreadsheetApp.getActive().getSheetByName(JOB_TAB);
  if (patch.status) sh.getRange(j.row, 3).setValue(patch.status);
  if (patch.output !== undefined) sh.getRange(j.row, 5).setValue(JSON.stringify(patch.output).slice(0, 49000));
  if (patch.done) sh.getRange(j.row, 7).setValue(patch.done);
  return { ok: true };
}

/* ================= calendar ================= */
function fmt(d) { return Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
function parse(s) { return new Date(String(s).slice(0, 19) + '+08:00'); }
function calList(b) {
  const cal = CalendarApp.getDefaultCalendar();
  return cal.getEvents(parse(b.startTime), parse(b.endTime), { search: b.fullText || 'miracikcitstudio' })
    .filter(ev => String(ev.getDescription() || '').indexOf(CAL_MARK) >= 0 || !b.fullText)
    .map(ev => ({
      id: ev.getId(), summary: ev.getTitle(), description: ev.getDescription(), status: 'confirmed',
      start: ev.isAllDayEvent() ? { date: Utilities.formatDate(ev.getAllDayStartDate(), TZ, 'yyyy-MM-dd') } : { dateTime: fmt(ev.getStartTime()) }
    }));
}
function calSave(id, b) {
  const cal = CalendarApp.getDefaultCalendar();
  const s = parse(b.startTime), e = parse(b.endTime);
  let ev = id ? cal.getEventById(id) : null;
  if (ev) {
    ev.setTitle(b.summary || ''); ev.setDescription(b.description || '');
    if (b.allDay) ev.setAllDayDate(s); else ev.setTime(s, e);
  } else {
    ev = b.allDay ? cal.createAllDayEvent(b.summary || '', s, { description: b.description || '' })
                  : cal.createEvent(b.summary || '', s, e, { description: b.description || '' });
  }
  if (b.noRemind) { try { ev.removeAllReminders(); } catch (x) {} }   /* 24 Nov: jadual posting / deadline tanpa notifikasi */
  return { id: ev.getId() };
}

/* ================= helpers ================= */
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function withLock(fn) { const l = LockService.getScriptLock(); l.waitLock(25000); try { return fn(); } finally { l.releaseLock(); } }
function safe(v) { try { return v === '' ? null : JSON.parse(v); } catch (e) { return v; } }
function openSs(id) { const a = SpreadsheetApp.getActive(); return !id || id === a.getId() ? a : SpreadsheetApp.openById(id); }
function sheet(name, header) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, header.length).setValues([header]); sh.hideSheet(); }
  return sh;
}
function folder() {
  const it = DriveApp.getFoldersByName(DRIVE_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(DRIVE_FOLDER);
}
function trimValues(v) {
  const outv = v.map(r => { let n = r.length; while (n > 0 && r[n - 1] === '') n--; return r.slice(0, n); });
  let m = outv.length; while (m > 0 && outv[m - 1].length === 0) m--;
  return outv.slice(0, m);
}

/** Jalankan sekali dari editor (butang Run) untuk beri kebenaran Drive dan Calendar. */
function izinkan() { folder(); CalendarApp.getDefaultCalendar().getName(); UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true }); return 'OK'; }
function drivePath(base, path, share) {
  let f;
  if (base === 'archive') { const it = DriveApp.getFoldersByName('ARCHIVE PRODUCT LISTING'); f = it.hasNext() ? it.next() : DriveApp.createFolder('ARCHIVE PRODUCT LISTING'); }
  else f = folder();
  path.forEach(n => { n = String(n); const it = f.getFoldersByName(n); f = it.hasNext() ? it.next() : f.createFolder(n); });
  if (share) f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return f.getId();
}
/* Tambah caption ke PRODUCTS ikut format sedia ada.
   Produk dah ada (b.start = baris produk): sisip satu baris VID di bawah produk tu dan naikkan TOTAL VID.
   Produk baru: dua baris di hujung (baris produk + baris link beli), selepas satu baris kosong. Format, checkbox
   dan senarai akaun disalin dari baris produk terakhir. */
function productAdd(b) {
  const sh = SpreadsheetApp.getActive().getSheetByName('PRODUCTS');
  const last = sh.getLastRow(), W = 20;
  const vals = sh.getRange(1, 1, last, W).getValues();
  const caption = String(b.caption || '').trim(); if (!caption) return { ok: false, error: 'caption kosong' };
  const tmpl = 'TT: \n\nIG: \n\nFB: \n\nSV: ';
  const F = [false, false, false, false, false, false, false, false];
  const copyFmt = (from, to) => {
    [SpreadsheetApp.CopyPasteType.PASTE_FORMAT, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, SpreadsheetApp.CopyPasteType.PASTE_CONDITIONAL_FORMATTING]
      .forEach(t => sh.getRange(from, 1, 1, W).copyTo(sh.getRange(to, 1, 1, W), t, false));
  };
  if (b.start) {
    const st = Number(b.start); if (String(vals[st - 1][3]).trim() === '') return { ok: false, error: 'baris produk tak sah' };
    let end = st, maxVid = Number(vals[st - 1][4]) || 0;
    for (let r = st + 1; r <= last; r++) { const row = vals[r - 1]; if (String(row[3]).trim() !== '' || String(row[4]).trim() === '') break; end = r; maxVid = Math.max(maxVid, Number(row[4]) || 0); }
    sh.insertRowAfter(end); copyFmt(end, end + 1);
    sh.getRange(end + 1, 5, 1, 13).setValues([[maxVid + 1, caption].concat(F, ['', '', tmpl])]);
    sh.getRange(st, 4).setValue((Number(vals[st - 1][3]) || 0) + 1);
    return { ok: true, row: end + 1, vid: maxVid + 1, no: vals[st - 1][0] };
  }
  let maxNo = 0, lastProd = 0;
  vals.forEach((r, i) => { const n = Number(r[0]); if (n && String(r[3]).trim() !== '') { maxNo = Math.max(maxNo, n); lastProd = i + 1; } });
  const row = last + 2, no = maxNo + 1;
  copyFmt(lastProd, row); copyFmt(lastProd, row + 1);
  sh.getRange(row, 1, 1, 17).setValues([[no, String(b.name || '').toUpperCase(), String(b.shopee || ''), 1, 1, caption].concat(F, ['', '', tmpl])]);
  sh.getRange(row + 1, 1, 1, 17).setValues([['', b.shopee ? '✅ Beli di Shopee: ' + b.shopee + (b.tt ? '\n✅ Beli di Tiktok: ' + b.tt : '') : '', String(b.tt || ''), '', ''].concat(['', '', '', '', '', '', '', '', '', '', '', ''])]);
  sh.getRange(row + 1, 7, 1, 10).clearDataValidations();
  return { ok: true, row: row, vid: 1, no: no };
}
function countFiles(f) { let n = 0; const fi = f.getFiles(); while (fi.hasNext()) { fi.next(); n++; } const fo = f.getFolders(); while (fo.hasNext()) n += countFiles(fo.next()); return n; }
