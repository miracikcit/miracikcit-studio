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
  return { id: ev.getId() };
}

/* ================= helpers ================= */
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function withLock(fn) { const l = LockService.getScriptLock(); l.waitLock(25000); try { return fn(); } finally { l.releaseLock(); } }
function safe(v) { try { return v === '' ? null : JSON.parse(v); } catch (e) { return v; } }
function openSs(id) { return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive(); }
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
function izinkan() { folder(); CalendarApp.getDefaultCalendar().getName(); return 'OK'; }
