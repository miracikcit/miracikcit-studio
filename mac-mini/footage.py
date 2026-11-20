"""Aliran footage Miracikcit Studio (dipanggil oleh worker.py). Semua kod biasa, tiada token Claude.

1. Folder edit baru (ada video) -> B-Roll Picker pre-cut sendiri -> doc broll/<slug> status precut -> ready.
2. Mira swipe Keep/Skip dalam B-Roll Picker, tekan Dah semak dalam Studio -> job broll_done:
   simpan klip ke Movies/B-ROLL LIBRARY, gambar kecil + preview 540p ke Drive (boleh tengok di mana-mana),
   salinan penuh ke Drive FOOTAGE/BACKUP (backup kalau hard disk rosak). Status stok.
3. Klip terbaik lepas final (Claude simpan dalam TO HARD DRIVE/<video>) -> doc footage/<slug> status semak,
   gambar kecil + preview ke Drive. Mira tanda simpan / buang, Dah semak -> job best_done: yang dibuang ke Trash,
   yang disimpan dibackup penuh ke Drive. Status stok.
"""
import json, logging, os, re, shutil, subprocess, tempfile, threading, time, urllib.request

log = logging.getLogger("transcribe")
BASE = os.path.expanduser("~/Desktop/WORK 2026/CLAUDE EDITS")
THD = os.path.expanduser("~/Desktop/WORK 2026/TO HARD DRIVE")
BR = "http://127.0.0.1:8787"
BR_DATA = os.path.expanduser("~/Library/Application Support/BRollPicker")
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "footage_state.json")
FFMPEG = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
VID = (".mov", ".mp4", ".m4v")
IMG = (".jpg", ".jpeg", ".png", ".heic")
SKIP_STAGES = {"29", "41"}          # 29: Footage Sorter urus; 41: tunggu VO
START_MS = 1795165200000             # 2026-11-20: auto pre-cut hanya folder baru selepas ni; folder lama guna butang Pre-cut dalam Studio
_lock = threading.Lock()
_busy = set()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")[:60] or "x"


def _st():
    try:
        return json.load(open(STATE))
    except Exception:
        return {"broll": {}, "best": {}}


def _save_st(st):
    with open(STATE + ".tmp", "w") as fh:
        json.dump(st, fh, ensure_ascii=False, indent=1)
    os.replace(STATE + ".tmp", STATE)


def br(path, body=None, timeout=20):
    req = urllib.request.Request(BR + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"}, method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def br_up():
    try:
        br("/api/folders?path=", timeout=5)
        return True
    except Exception:
        return False


def _merge(sheet, path, fields):
    cur = sheet.call("dget", path=path).get("doc") or {"created": int(time.time() * 1000)}
    cur.update(fields)
    cur["updated"] = int(time.time() * 1000)
    sheet.call("dset", path=path, data=cur)
    return cur


def _thumb_prev(src, tmp, start=0.0, dur=3.0, image=False):
    """Gambar kecil 320px + preview 540p (3 s, tanpa bunyi) untuk Studio."""
    stem = os.path.join(tmp, slug(os.path.basename(src)))
    th = stem + ".jpg"
    if image:
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src, "-vf", "scale=320:-2", th], timeout=60)
        return th, None
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-ss", f"{start + min(0.5, dur / 2):.2f}", "-i", src, "-frames:v", "1",
                    "-vf", "scale=320:-2", th], timeout=60)
    pv = stem + "_p.mp4"
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-ss", f"{start:.2f}", "-t", f"{min(dur, 3.0):.2f}", "-i", src,
                    "-vf", "scale=-2:540", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", pv], timeout=180)
    return th, (pv if os.path.exists(pv) else None)


def _upload(sheet, up, path, folder_id):
    try:
        return up(sheet, path, folder_id)
    except Exception as e:
        log.warning("Upload Drive gagal %s: %s", path, e)
        return None


# ---------------------------------------------------------------- tick (setiap scan 5 minit)
def tick(sheet, up):
    with _lock:
        st = _st()
        try:
            _auto_precut(sheet, st)
            _adopt_manual(sheet, st)
            _refresh_broll(sheet, up, st)
            _scan_best(sheet, up, st)
        except Exception:
            log.exception("Footage tick gagal")
        _save_st(st)


def _auto_precut(sheet, st):
    if not br_up():
        return
    te = sheet.call("dget", path="sync/toedit").get("doc") or {}
    mk = sheet.call("dget", path="sync/toeditmarks").get("doc") or {}
    gone = set((mk.get("done") or {}).keys()) | set((mk.get("hidden") or {}).keys())
    for stg in te.get("stages") or []:
        no = stg["name"].split(".")[0]
        if no in SKIP_STAGES:
            continue
        for it in stg.get("items") or []:
            key = stg["name"] + "/" + it["name"]
            if key in gone or not it.get("clips") or key in st["broll"] or (it.get("mtime") or 0) < START_MS:
                continue
            _start(sheet, st, key, stg["name"], it["name"])


def _adopt_manual(sheet, st):
    """Folder yang Mira (atau Claude) pre-cut terus dalam B-Roll Picker juga masuk Studio untuk disemak."""
    cache = os.path.join(BR_DATA, "cache")
    if not os.path.isdir(cache):
        return
    for jid in sorted(os.listdir(cache)):
        try:
            j = json.load(open(os.path.join(cache, jid, "job.json")))
        except Exception:
            continue
        rel = j.get("rel") or ""
        if (not rel or rel in st["broll"] or j.get("status") != "ready" or not j.get("good")
                or (j.get("t") or 0) * 1000 < START_MS or rel.startswith("00.")):
            continue
        parts = rel.split("/")
        s = slug(rel)
        st["broll"][rel] = {"slug": s, "job": jid, "status": "precut"}
        _merge(sheet, "broll/" + s, {"key": rel, "name": " · ".join(parts[1:]) or rel, "stage": parts[0], "job": jid,
                                     "status": "precut", "msg": "Pre-cut dari B-Roll Picker"})
        log.info("B-roll dari Picker masuk Studio: %s", rel)


def _start(sheet, st, key, stage, name):
    try:
        jid = br("/api/scan", {"path": key})["id"]
    except Exception as e:
        log.info("Pre-cut %s tak boleh: %s", key, e)
        st["broll"][key] = {"skip": str(e)[:120]}
        return False
    s = slug(key)
    st["broll"][key] = {"slug": s, "job": jid, "status": "precut"}
    _merge(sheet, "broll/" + s, {"key": key, "name": name, "stage": stage, "job": jid, "status": "precut", "msg": "Sedang pre-cut"})
    log.info("B-roll pre-cut dimulakan: %s", key)
    return True


def _refresh_broll(sheet, up, st):
    for key, r in st["broll"].items():
        if r.get("skip") or r.get("status") not in ("precut", "ready"):
            continue
        try:
            js = br("/api/job?id=" + r["job"])
        except Exception:
            continue
        if r["status"] == "precut":
            if js.get("status") == "ready":
                d = br("/api/moments?id=" + r["job"], timeout=60)
                moms = [m for m in d["meta"].get("moments", []) if not m.get("junk") and not m.get("aroll")]
                thumbs = []
                pid = sheet.call("dpath", base="studio", path=["FOOTAGE", "PREVIEW", "B-ROLL", r["slug"]], share=True)["id"]
                for m in moms[:4]:
                    p = os.path.join(BR_DATA, "cache", r["job"], "m", f"{m['id']}.jpg")
                    if os.path.exists(p):
                        fid = _upload(sheet, up, p, pid)
                        if fid:
                            thumbs.append(fid)
                r["status"] = "ready"
                _merge(sheet, "broll/" + r["slug"], {"status": "ready", "moments": len(moms), "thumbs": thumbs, "msg": ""})
            elif js.get("status") == "error":
                r["status"] = "error"
                _merge(sheet, "broll/" + r["slug"], {"status": "error", "msg": str(js.get("msg"))[:160]})
            else:
                _merge(sheet, "broll/" + r["slug"], {"progress": js.get("progress", 0), "msg": js.get("msg", "")[:80]})
        else:
            stt = json.load(open(os.path.join(BR_DATA, "cache", r["job"], "state.json"))) if os.path.exists(os.path.join(BR_DATA, "cache", r["job"], "state.json")) else {"dec": {}}
            kept = sum(1 for v in stt.get("dec", {}).values() if v.get("action") == "keep")
            seen = len(stt.get("dec", {}))
            if kept != r.get("kept") or seen != r.get("seen"):
                r["kept"], r["seen"] = kept, seen
                _merge(sheet, "broll/" + r["slug"], {"kept": kept, "seen": seen})


def _scan_best(sheet, up, st):
    if not os.path.isdir(THD):
        return
    for name in sorted(os.listdir(THD)):
        full = os.path.join(THD, name)
        if not os.path.isdir(full) or name.startswith(".") or name in st["best"]:
            continue
        files = sorted(f for f in os.listdir(full) if f.lower().endswith(VID + IMG) and not f.startswith("."))
        if not files or time.time() - os.path.getmtime(full) < 120:   # tunggu Claude habis salin
            continue
        s = slug(name)
        st["best"][name] = {"slug": s, "status": "semak"}
        pid = sheet.call("dpath", base="studio", path=["FOOTAGE", "PREVIEW", name], share=True)["id"]
        out = []
        with tempfile.TemporaryDirectory(prefix="ft-") as tmp:
            for f in files:
                src = os.path.join(full, f)
                th, pv = _thumb_prev(src, tmp, image=f.lower().endswith(IMG))
                out.append({"name": f, "thumb": _upload(sheet, up, th, pid) if os.path.exists(th) else None,
                            "prev": _upload(sheet, up, pv, pid) if pv else None, "size": os.path.getsize(src),
                            "kind": (f.split("_")[1] if f.count("_") >= 2 else "")})
        prev = sheet.call("dget", path="footage/" + s).get("doc") or {}
        _merge(sheet, "footage/" + s, {"name": prev.get("name") or name.replace("_", " "), "product": prev.get("product") or name.split("_")[0],
                                       "folder": "TO HARD DRIVE/" + name, "files": out, "clips": str(len(out)), "status": "semak",
                                       "source": "best", "tags": prev.get("tags") or [], "moved": prev.get("moved", False),
                                       "size": sum(x["size"] for x in out)})
        log.info("Klip terbaik untuk disemak: %s (%d fail)", name, len(out))


# ---------------------------------------------------------------- job dari Studio
def job_broll_start(inp, sheet, up):
    """Butang Pre-cut dalam Studio (folder lama, atau buat semula)."""
    key = str(inp.get("key") or "")
    stage, _, name = key.partition("/")
    if not br_up():
        raise RuntimeError("B-Roll Picker tak jalan dalam Mac mini")
    with _lock:
        st = _st()
        st["broll"].pop(key, None)
        ok = _start(sheet, st, key, stage, name)
        _save_st(st)
    if not ok:
        raise RuntimeError(st["broll"].get(key, {}).get("skip") or "Tak dapat pre-cut")
    return {"ok": True}


def job_broll_done(inp, sheet, up):
    key = inp.get("key")
    with _lock:
        st = _st()
        r = st["broll"].get(key)
    if not r or not r.get("job"):
        raise RuntimeError("Projek B-roll tak dijumpai: " + str(key))
    br("/api/export", {"id": r["job"]})
    _merge(sheet, "broll/" + r["slug"], {"status": "backup", "msg": "Simpan klip dan backup ke Drive"})
    threading.Thread(target=_broll_backup, args=(sheet, up, key, r), daemon=True).start()
    return {"ok": True}


def _broll_backup(sheet, up, key, r):
    try:
        for _ in range(720):                       # tunggu export B-Roll Picker siap (sampai 1 jam)
            s = (br("/api/status?id=" + r["job"]).get("export") or {})
            if not s.get("running"):
                break
            time.sleep(5)
        stt = json.load(open(os.path.join(BR_DATA, "cache", r["job"], "state.json")))
        meta = json.load(open(os.path.join(BR_DATA, "cache", r["job"], "moments.json")))
        mom = {m["id"]: m for m in meta.get("moments", [])}
        pid = sheet.call("dpath", base="studio", path=["FOOTAGE", "PREVIEW", "B-ROLL", r["slug"]], share=True)["id"]
        bid = sheet.call("dpath", base="studio", path=["FOOTAGE", "BACKUP", "B-ROLL", r["slug"]])["id"]
        clips = []
        with tempfile.TemporaryDirectory(prefix="br-") as tmp:
            for mid, ex in (stt.get("exported") or {}).items():
                dec = stt["dec"].get(mid) or {}
                if dec.get("action") != "keep":
                    continue
                for p in ex.get("paths", []):
                    if not os.path.exists(p):
                        continue
                    ln = float(dec.get("len") or (float(dec.get("end", 3)) - float(dec.get("start", 0))))   # len = jumlah bila beberapa bahagian digabung
                    th, pv = _thumb_prev(p, tmp, dur=ln)
                    clips.append({"name": os.path.basename(p), "path": p, "labels": dec.get("labels") or [],
                                  "len": round(ln, 1), "parts": len(dec.get("parts") or []) or 1,
                                  "video": (mom.get(mid) or {}).get("video", ""), "size": os.path.getsize(p),
                                  "thumb": _upload(sheet, up, th, pid) if os.path.exists(th) else None,
                                  "prev": _upload(sheet, up, pv, pid) if pv else None,
                                  "backup": _upload(sheet, up, p, bid)})
        lib = os.path.dirname(clips[0]["path"]) if clips else ""
        _merge(sheet, "broll/" + r["slug"], {"status": "stok", "clips": clips, "kept": len(clips), "lib": lib.replace(os.path.expanduser("~"), "~"),
                                             "size": sum(c["size"] for c in clips), "backedUp": all(c.get("backup") for c in clips), "msg": ""})
        with _lock:
            st = _st(); st["broll"].setdefault(key, r)["status"] = "stok"; _save_st(st)
        log.info("B-roll %s: %d klip disimpan dan dibackup", key, len(clips))
    except Exception as e:
        log.exception("Backup B-roll gagal")
        _merge(sheet, "broll/" + r["slug"], {"status": "ready", "msg": "Backup gagal: " + str(e)[:120]})


def job_best_done(inp, sheet, up):
    name = inp.get("name")
    full = os.path.realpath(os.path.join(THD, str(name)))
    if os.path.dirname(full) != os.path.realpath(THD) or not os.path.isdir(full):
        raise RuntimeError("Folder tak dijumpai: " + str(name))
    drop = set(inp.get("drop") or [])
    trashed = []
    for f in drop:
        src = os.path.join(full, os.path.basename(f))
        if os.path.isfile(src):
            dest = os.path.join(os.path.expanduser("~/.Trash"), os.path.basename(src))
            if os.path.exists(dest):
                dest += time.strftime(" %H.%M.%S")
            shutil.move(src, dest)
            trashed.append(f)
    s = slug(name)
    doc = _merge(sheet, "footage/" + s, {"status": "backup", "msg": "Backup ke Drive"})
    threading.Thread(target=_best_backup, args=(sheet, up, name, full, s, doc, drop), daemon=True).start()
    return {"trashed": len(trashed)}


def _best_backup(sheet, up, name, full, s, doc, drop):
    try:
        bid = sheet.call("dpath", base="studio", path=["FOOTAGE", "BACKUP", name])["id"]
        files = []
        for x in doc.get("files") or []:
            if x["name"] in drop:
                continue
            p = os.path.join(full, x["name"])
            if os.path.exists(p):
                x = dict(x, backup=x.get("backup") or _upload(sheet, up, p, bid))
                files.append(x)
        _merge(sheet, "footage/" + s, {"status": "stok", "files": files, "clips": str(len(files)), "size": sum(f.get("size", 0) for f in files),
                                       "backedUp": all(f.get("backup") for f in files), "msg": ""})
        with _lock:
            st = _st(); st["best"].setdefault(name, {"slug": s})["status"] = "stok"; _save_st(st)
    except Exception as e:
        log.exception("Backup klip terbaik gagal")
        _merge(sheet, "footage/" + s, {"status": "semak", "msg": "Backup gagal: " + str(e)[:120]})
