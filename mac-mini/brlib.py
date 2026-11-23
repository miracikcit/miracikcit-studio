"""B-roll library di Studio (2026-11-23). Kod biasa, tiada token Claude. Dipanggil oleh worker.py setiap pusingan (~30 s).

1. Kiraan B-roll terus dari Picker: berapa lagi perlu swipe (wakil shot serupa sahaja), keep, berapa dah Final, % kerja Final.
   Bila semua yang di-keep dah Final -> doc broll status 'stok' sendiri (tiada butang Dah semak lagi).
2. Klip Final (index.json Picker) -> doc brlib/<tempat> untuk tab Library klip: gambar / preview dari salinan Drive,
   Mira ubah tag dalam Studio -> ditulis balik ke index.json dan tab Sheet B-ROLL INDEX.
3. Ruang: Mac, hard disk PERTAMA, Google Drive -> doc sync/storage.
4. Hard disk: salin klip Final + klip terbaik ke PERTAMA sendiri bila disambung; selepas 30 hari, salinan Mac ke Trash
   (hanya bila salinan hard disk saiz sama DAN salinan Drive ada). index.json ikut lokasi baru.
"""
import json, logging, os, re, shutil, sys, threading, time

log = logging.getLogger("transcribe")
PICKER = os.path.expanduser("~/Desktop/WORK 2026/CLAUDE EDITS/.claude/broll-picker")
if PICKER not in sys.path:
    sys.path.insert(0, PICKER)
import library_sync as LS   # noqa: E402

BR_DATA = os.path.expanduser("~/Library/Application Support/BRollPicker")
THD = os.path.expanduser("~/Desktop/WORK 2026/TO HARD DRIVE")
DISK = "/Volumes/PERTAMA"
DISK_ROOT = os.path.join(DISK, "MIRA/WORK ARCHIVE/WORK 2026")      # sama susunan dengan arkib WORK 2022-2024
KEEP_DAYS = 30
_st = {"sig": {}, "store": 0, "disk": 0}
_disk_busy = threading.Event()
_prog = {"running": False, "done": 0, "total": 0, "msg": ""}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")[:60] or "x"


def _rj(p, d):
    try:
        return json.load(open(p))
    except Exception:
        return d


def _put(sheet, path, data, merge=False):
    sig = json.dumps(data, sort_keys=True)
    if _st["sig"].get(path) == sig:
        return
    if merge:
        cur = sheet.call("dget", path=path).get("doc") or {"created": int(time.time() * 1000)}
        cur.update(data)
        data2 = cur
    else:
        data2 = dict(data)
    data2["updated"] = int(time.time() * 1000)
    sheet.call("dset", path=path, data=data2)
    _st["sig"][path] = sig


# ---------------------------------------------------------------- 1. kiraan B-roll
def counts(job):
    d = os.path.join(BR_DATA, "cache", job)
    meta = _rj(os.path.join(d, "moments.json"), {"moments": []})
    st = _rj(os.path.join(d, "state.json"), {"dec": {}})
    dec, ex = st.get("dec", {}), st.get("exported") or {}
    moms = [m for m in meta.get("moments", []) if not m.get("junk") and not m.get("aroll")]
    reps = [m for m in moms if m.get("rep") is not False]
    left = sum(1 for m in reps if m["id"] not in dec)
    keep = [k for k, v in dec.items() if v.get("action") == "keep"]
    final = sum(1 for k in keep if ex.get(k) and ex[k].get("pv") == dec[k].get("pv") and all(os.path.exists(p) for p in ex[k].get("paths", [])))
    return {"moments": len(reps), "left": left, "kept": len(keep), "final": final}


def refresh_broll(sheet):
    import footage
    with footage._lock:
        fst = footage._st()
    ix = LS.load()
    for key, r in fst.get("broll", {}).items():
        if r.get("skip") or not r.get("job") or r.get("status") not in ("ready", "stok"):
            continue
        c = counts(r["job"])
        try:
            e = (footage.br("/api/status?id=" + r["job"], timeout=5).get("export") or {})
        except Exception:
            e = {}
        c["exp"] = {"running": bool(e.get("running")), "done": e.get("done", 0), "total": e.get("total", 0),
                    "msg": str(e.get("msg") or "")[:90]}
        doc = dict(c)
        if r.get("status") == "ready" and c["kept"] and not c["left"] and c["final"] >= c["kept"] and not e.get("running"):
            mine = [x for x in ix["clips"] if x["kunci"].startswith(r["job"] + "/")]
            doc.update(status="stok", msg="", kept=len(mine) or c["kept"],
                       clips=[{"name": x["fail"], "path": x["path"], "labels": x.get("tag") or [], "len": x["len"],
                               "video": x["raw"].split("/")[-1], "thumb": x.get("drive"), "prev": x.get("drive"),
                               "backup": x.get("drive")} for x in mine],
                       backedUp=all(x.get("drive") for x in mine), lib=os.path.dirname(mine[0]["path"]) if mine else "")
            with footage._lock:
                s2 = footage._st(); s2["broll"][key]["status"] = "stok"; footage._save_st(s2)
            log.info("B-roll %s: semua klip Final, status stok", key)
        _put(sheet, "broll/" + r["slug"], doc, merge=True)


# ---------------------------------------------------------------- 2. library + tag
def publish_library(sheet):
    ix = LS.load()
    by = {}
    for c in ix["clips"]:
        by.setdefault(c["tempat"], []).append(c)
    dfold = ix.get("driveFolders") or {}
    for place, cl in by.items():
        clips = [{"k": c["kunci"], "f": c["fail"], "tag": c.get("tag") or [], "len": c["len"], "sp": c.get("speed", 1),
                  "star": bool(c.get("star")), "drive": c.get("drive"), "shot": c.get("shot"), "raw": c["raw"].split("/")[-1],
                  "mac": os.path.exists(c["path"]) and not c["path"].startswith("/Volumes/"), "disk": c.get("disk"),
                  "size": (c.get("sig") or [0])[0], "final": c.get("final")}
                 for c in sorted(cl, key=lambda c: c.get("nn", 0))]
        _put(sheet, "brlib/" + slug(place), {"place": place, "clips": clips, "driveFolder": dfold.get(place)})


def job_brtag(inp, sheet):
    """Studio: Mira tambah / buang tag satu klip. Tulis ke index.json, kemudian tab Sheet B-ROLL INDEX."""
    k = str(inp.get("k") or "")
    tags = list(dict.fromkeys(str(t).strip() for t in (inp.get("tag") or []) if str(t).strip()))[:20]
    with LS._lock:
        ix = LS.load()
        c = next((x for x in ix["clips"] if x["kunci"] == k), None)
        if not c:
            raise RuntimeError("Klip tak dijumpai dalam index")
        c["tag"] = tags
        LS.save(ix)
    publish_library(sheet)
    LS.sync_bg()
    return {"ok": True, "tag": tags}


# ---------------------------------------------------------------- 3. ruang
def _du(p):
    tot = 0
    for root, _, files in os.walk(p):
        for f in files:
            try:
                tot += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return tot


def _tree(lib):
    """Setiap folder dalam B-ROLL LIBRARY: berapa klip dalam Mac dan berapa dah ada dalam PERTAMA (susunan sama)."""
    out = []
    ix = LS.load()
    for name in sorted(os.listdir(lib)) if os.path.isdir(lib) else []:
        d = os.path.join(lib, name)
        if not os.path.isdir(d):
            continue
        fs = [f for f in os.listdir(d) if not f.startswith(".") and not f.endswith((".part.mp4", ".tmp"))]
        on = sum(1 for f in fs if os.path.exists(os.path.join(DISK_ROOT, "B-ROLL LIBRARY", name, f)))
        gone = [c for c in ix["clips"] if c["tempat"] == name and c["path"].startswith("/Volumes/")]
        out.append({"name": name, "mac": len(fs), "disk": on + len(gone), "size": sum(os.path.getsize(os.path.join(d, f)) for f in fs),
                    "n": len(fs) + len(gone)})
    return out


def storage(sheet, force=False):
    if not force and time.time() - _st["store"] < 600 and not _prog["running"]:
        return
    _st["store"] = time.time()
    def disk(p):
        try:
            u = shutil.disk_usage(p)
            return {"used": u.used, "total": u.total, "pct": round(u.used / u.total * 100)}
        except Exception:
            return None
    lib = str(LS.LIB)
    doc = {"mac": dict(disk(os.path.expanduser("~")) or {}, path="~/Movies/B-ROLL LIBRARY", lib=_du(lib), tohd=_du(THD) if os.path.isdir(THD) else 0),
           "disk": dict(disk(DISK) or {}, name="PERTAMA", path=DISK_ROOT.replace(DISK, "PERTAMA"), mounted=os.path.ismount(DISK)),
           "copy": dict(_prog), "keepDays": KEEP_DAYS, "tree": _tree(lib)}
    try:
        q = LS.call("dquota")
        doc["drive"] = {"used": q["used"], "total": q["limit"], "pct": round(q["used"] / q["limit"] * 100) if q.get("limit") else None}
    except Exception:
        doc["drive"] = {"used": None, "total": None, "pct": None, "note": "Apps Script belum ada dquota"}
    doc["drive"]["path"] = "Miracikcit Studio Files / B-ROLL LIBRARY"
    doc["drive"]["lib"] = sum((c.get("sig") or [0])[0] for c in LS.load()["clips"] if c.get("drive"))
    _put(sheet, "sync/storage", doc)


# ---------------------------------------------------------------- 4. hard disk
def _copy(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    tmp = dst + ".part"
    shutil.copyfile(src, tmp)          # copyfile only: the disk (exFAT) refuses macOS flags / xattrs
    try:
        shutil.copystat(src, tmp, follow_symlinks=True)
    except OSError:
        pass
    os.replace(tmp, dst)


def _trash(p):
    dst = os.path.join(os.path.expanduser("~/.Trash"), os.path.basename(p))
    if os.path.exists(dst):
        dst += time.strftime(" %H.%M.%S")
    shutil.move(p, dst)


def disk_run(sheet):
    if _disk_busy.is_set() or not os.path.ismount(DISK) or time.time() - _st["disk"] < 600:
        return
    _st["disk"] = time.time()
    threading.Thread(target=_disk, args=(sheet,), daemon=True).start()


def _disk(sheet):
    _disk_busy.set()
    try:
        ix = LS.load()
        todo = []
        for c in ix["clips"]:
            dst = os.path.join(DISK_ROOT, "B-ROLL LIBRARY", c["tempat"], c["fail"])
            src = c["path"] if not c["path"].startswith("/Volumes/") else None
            if src and os.path.exists(src) and (not os.path.exists(dst) or os.path.getsize(dst) != os.path.getsize(src)):
                todo.append((c["kunci"], src, dst))
        known = {c["path"] for c in ix["clips"]}
        lib = str(LS.LIB)
        for root, _, files in os.walk(lib):          # klip lama dalam library (sebelum index) pun disalin, ikut susunan sama
            for f in files:
                s = os.path.join(root, f)
                if f.startswith(".") or f.endswith((".json", ".tmp", ".part.mp4")) or s in known:
                    continue
                t = os.path.join(DISK_ROOT, "B-ROLL LIBRARY", os.path.relpath(s, lib))
                if not os.path.exists(t) or os.path.getsize(t) != os.path.getsize(s):
                    todo.append((None, s, t))
        best = []
        if os.path.isdir(THD):
            for name in sorted(os.listdir(THD)):
                d = os.path.join(THD, name)
                if not os.path.isdir(d):
                    continue
                for f in sorted(os.listdir(d)):
                    s = os.path.join(d, f)
                    t = os.path.join(DISK_ROOT, "KLIP TERBAIK", name, f)
                    if os.path.isfile(s) and not f.startswith(".") and (not os.path.exists(t) or os.path.getsize(t) != os.path.getsize(s)):
                        best.append((None, s, t))
        jobs = todo + best
        _prog.update(running=bool(jobs), done=0, total=len(jobs), msg="Salin ke PERTAMA")
        done = {}
        for i, (k, s, t) in enumerate(jobs):
            if not os.path.ismount(DISK):
                _prog["msg"] = "Hard disk dicabut, sambung semula nanti"
                break
            _prog["msg"] = "Salin " + os.path.basename(s)
            try:
                _copy(s, t)
                if k:
                    done[k] = t
            except Exception as e:
                log.warning("Salin ke hard disk gagal %s: %s", s, e)
            _prog["done"] = i + 1
        # rekod lokasi hard disk + buang salinan Mac lepas 30 hari
        now = time.time()
        with LS._lock:
            ix = LS.load()
            for c in ix["clips"]:
                dst = done.get(c["kunci"]) or os.path.join(DISK_ROOT, "B-ROLL LIBRARY", c["tempat"], c["fail"])
                if os.path.exists(dst):
                    c["disk"] = dst
                mac = c["path"] if not c["path"].startswith("/Volumes/") else None
                try:
                    age = (now - time.mktime(time.strptime(c.get("final", ""), "%Y-%m-%d"))) / 86400
                except Exception:
                    age = 0
                if mac and os.path.exists(mac) and c.get("disk") and c.get("drive") and age >= KEEP_DAYS \
                        and os.path.exists(c["disk"]) and os.path.getsize(c["disk"]) == os.path.getsize(mac):
                    _trash(mac)
                    c["macPath"], c["path"] = mac, c["disk"]
                    log.info("Klip %s: %d hari, salinan Mac ke Trash (ada dalam PERTAMA + Drive)", c["fail"], age)
            LS.save(ix)
        for name in (sorted(os.listdir(THD)) if os.path.isdir(THD) else []):
            d = os.path.join(THD, name)
            if not os.path.isdir(d):
                continue
            for f in os.listdir(d):
                s, t = os.path.join(d, f), os.path.join(DISK_ROOT, "KLIP TERBAIK", name, f)
                if os.path.isfile(s) and os.path.exists(t) and os.path.getsize(t) == os.path.getsize(s) \
                        and (now - os.path.getmtime(s)) / 86400 >= KEEP_DAYS:
                    _trash(s)
        _prog.update(running=False, msg="Siap" if jobs else "")
    except Exception:
        log.exception("Hard disk gagal")
        _prog.update(running=False, msg="Ralat salin")
    finally:
        _disk_busy.clear()
        try:
            storage(sheet, force=True)
        except Exception:
            pass


# ---------------------------------------------------------------- pusingan
_busy = threading.Event()


def quick(sheet):
    if _busy.is_set():
        return
    def run():
        _busy.set()
        try:
            for f in (refresh_broll, publish_library, storage, disk_run):
                try:
                    f(sheet)
                except Exception:
                    log.exception("brlib %s gagal", f.__name__)
        finally:
            _busy.clear()
    threading.Thread(target=run, daemon=True).start()
