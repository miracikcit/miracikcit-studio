#!/usr/bin/env python3
"""Raw footage projek yang dah published (2026-11-25, Mira): salin ke hard disk PERTAMA, kemudian buang dari Mac.

App Studio tulis doc `sync/rawplan` {folders: {"<folder utama>/<projek>": {since: ms, hold: bool, names: [...]}}}:
hanya folder yang SEMUA videonya dah published; `since` = tarikh post terakhir (atau "tahan 30 hari lagi");
`hold` = masih ada kad Shoot / Edit / Video baru yang guna footage tu.

Worker (setiap ~10 minit, thread sendiri, 0 token):
1. PERTAMA disambung: salin video yang belum ada ke PERTAMA/MIRA/WORK ARCHIVE/WORK 2026/RAW FOOTAGE/<folder>/<projek>/...
   (susunan sama, saiz disemak).
2. Buang dari Mac (ke Trash, boleh pulih) HANYA bila semua ini benar: PERTAMA disambung dan setiap fail ada di sana dengan
   saiz sama, tiada `hold`, dan dah KEEP_DAYS hari sejak `since`, sejak salinan PERTAMA lengkap, sejak fail terbaru diubah,
   dan sejak disalin balik.
3. Tulis `sync/rawfoot` {folders: {key: {n, size, disk, state mac|wait|hd|hdonly|none, left, hold}}, mounted, copy}.

Hanya fail VIDEO yang disalin / dibuang. Gambar, VO, nota, fail projek dan folder kerja Claude kekal dalam Mac.
Job `raw_back` salin balik dari PERTAMA (untuk START EDIT pada footage yang dah dibuang dari Mac)."""
import json, logging, os, re, shutil, threading, time

log = logging.getLogger("miracikcit")
HOME = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.expanduser("~/Desktop/WORK 2026/CLAUDE EDITS")
DISK = "/Volumes/PERTAMA"
DEST = os.path.join(DISK, "MIRA/WORK ARCHIVE/WORK 2026", "RAW FOOTAGE")
TRASH = os.path.expanduser("~/.Trash")
STATE = os.path.join(HOME, "rawfoot_state.json")
KEEP_DAYS = 30
AUTO_TRASH = True                 # Mira setuju 25 Nov 2026: "Ya auto buang"
EVERY = 600
VIDEO = (".mp4", ".mov", ".m4v", ".mts", ".avi", ".mkv")
SKIP_DIR = re.compile(r"^(videos|build|editor|page|render|renders|draft|tmp|VO)$|-(edit|build|draft)$", re.I)
DAY = 86400.0

_busy = threading.Event()
_last = {"t": 0.0}
_prog = {"running": False, "key": "", "kind": "", "done": 0, "total": 0, "msg": ""}


def _ok_key(key):
    p = str(key or "").split("/")
    return len(p) == 2 and bool(re.match(r"^[2-4]\d\. ", p[0])) and bool(p[1].strip()) and ".." not in key and not p[1].startswith(".")


def _files(root):
    """Semua fail video projek: [(laluan relatif, saiz, mtime)]. Folder kerja Claude, folder tersembunyi dan pautan dilangkau."""
    out = []
    for d, dirs, fs in os.walk(root):
        dirs[:] = [x for x in dirs if not x.startswith(".") and not SKIP_DIR.search(x)]
        for f in fs:
            p = os.path.join(d, f)
            if f.startswith(".") or not f.lower().endswith(VIDEO) or os.path.islink(p):
                continue
            try:
                st = os.stat(p)
            except OSError:
                continue
            out.append((os.path.relpath(p, root), st.st_size, st.st_mtime))
    return sorted(out)


def _dst(key, rel):
    return os.path.join(DEST, key, rel)


def _on_disk(key, rel, size):
    try:
        return os.path.getsize(_dst(key, rel)) == size
    except OSError:
        return False


def _copy(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    tmp = dst + ".part"
    shutil.copyfile(src, tmp)          # copyfile sahaja: exFAT tolak flag / xattr macOS
    try:
        shutil.copystat(src, tmp, follow_symlinks=True)
    except OSError:
        pass
    os.replace(tmp, dst)


def _load():
    try:
        return json.load(open(STATE, encoding="utf-8"))
    except Exception:
        return {}


def _save(st):
    tmp = STATE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(st, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, STATE)


def _trash_all(key, files):
    """Pindah video ke satu folder dalam Trash (susunan sama), supaya senang dipulihkan."""
    root = os.path.join(BASE, key)
    box = os.path.join(TRASH, "Raw footage " + key.split("/")[1] + time.strftime(" %Y-%m-%d %H.%M.%S"))
    gone = []
    for rel, size, _ in files:
        if not _on_disk(key, rel, size):            # semak sekali lagi tepat sebelum buang
            raise RuntimeError("salinan PERTAMA tak lengkap: " + rel)
    for rel, size, _ in files:
        dst = os.path.join(box, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.move(os.path.join(root, rel), dst)
        gone.append({"rel": rel, "size": size})
    return gone, box


def _put(sheet, folders, mounted):
    now = int(time.time() * 1000)
    sheet.call("dset", path="sync/rawfoot", data={"folders": folders, "keepDays": KEEP_DAYS, "mounted": mounted, "auto": AUTO_TRASH,
                                                  "copy": dict(_prog), "updated": now})


def scan(sheet, plan=None):
    """Satu pusingan penuh. Pulang ringkasan setiap folder (juga ditulis ke sync/rawfoot)."""
    if plan is None:
        plan = (sheet.call("dget", path="sync/rawplan").get("doc") or {}).get("folders") or {}
    mounted = os.path.ismount(DISK)
    state, out, now = _load(), {}, time.time()
    for key, pe in sorted(plan.items()):
        if not _ok_key(key) or not isinstance(pe, dict):
            continue
        root = os.path.join(BASE, key)
        files = _files(root) if os.path.isdir(root) else []
        st = state.setdefault(key, {})
        n, size = len(files), sum(f[1] for f in files)
        if mounted and files:
            miss = [f for f in files if not _on_disk(key, f[0], f[1])]
            if miss:
                need = sum(f[1] for f in miss)
                free = shutil.disk_usage(DISK).free
                if free < need + 5 * 1024 ** 3:
                    _prog.update(msg="PERTAMA tak cukup ruang untuk " + key.split("/")[1])
                else:
                    _prog.update(running=True, key=key, kind="copy", done=0, total=len(miss), msg="")
                    for i, (rel, sz, _) in enumerate(miss):
                        try:
                            _copy(os.path.join(root, rel), _dst(key, rel))
                        except Exception as e:
                            log.warning("Raw footage: salin %s/%s gagal: %s", key, rel, e)
                            _prog["msg"] = "Salin gagal: " + str(e)[:120]
                            break
                        _prog["done"] = i + 1
                        if i % 5 == 4:
                            _put(sheet, out, mounted)
                    _prog.update(running=False)
            disk = sum(1 for f in files if _on_disk(key, f[0], f[1]))
            st.update(disk=disk, n=n, full=(disk == n))
            if disk == n and (miss or not st.get("fullAt")):
                st["fullAt"] = int(now * 1000)          # kiraan 30 hari bermula (semula) bila salinan PERTAMA lengkap
            elif disk != n:
                st.pop("fullAt", None)
        else:
            disk = st.get("disk", 0) if st.get("n") == n else 0
        full = bool(files) and (disk == n) and (mounted or st.get("full"))
        since = float(pe.get("since") or 0) / 1000.0
        ref = max([since, st.get("backAt", 0) / 1000.0, st.get("fullAt", 0) / 1000.0] + [f[2] for f in files])
        left = KEEP_DAYS - (now - ref) / DAY
        hold = bool(pe.get("hold"))
        gone = st.get("gone") or []
        cond = "hd" if full else "wait" if files else "hdonly" if gone else "none"
        if AUTO_TRASH and mounted and cond == "hd" and not hold and since > 0 and st.get("fullAt") and left <= 0:
            try:
                done, box = _trash_all(key, files)
                st.update(gone=gone + done, trashedAt=int(now * 1000), n=0, disk=0, full=False)
                st.pop("fullAt", None)
                log.info("Raw footage %s: %d video dibuang dari Mac (ada dalam PERTAMA), Trash: %s", key, len(done), box)
                gone, files, n, size, cond = st["gone"], [], 0, 0, "hdonly"
            except Exception as e:
                log.warning("Raw footage %s tak dibuang: %s", key, e)
        out[key] = {"n": n, "size": size, "disk": disk if files else len(gone), "state": cond, "left": max(0, int(left + 0.999)) if files else 0,
                    "hold": hold, "since": int(since * 1000), "gone": len(gone), "goneSize": sum(g.get("size", 0) for g in gone),
                    "trashedAt": st.get("trashedAt") or 0, "names": (pe.get("names") or [])[:12]}
    for key in list(state):                             # folder yang keluar dari pelan dan tiada rekod buang: lupakan
        if key not in plan and not state[key].get("gone"):
            state.pop(key)
    _save(state)
    _put(sheet, out, mounted)
    try:
        inventory(sheet, mounted, state)
    except Exception:
        log.exception("inventori footage gagal")
    return out


# ---------- Inventori SEMUA footage (2026-11-28, Mira: "senang aku tengok kedudukan footage aku sekarang") ----------
# Doc `sync/footinv` {rows:[{key, main, name, kind, n, size, disk, newest}], mounted, updated}. 0 token, hanya stat fail.
# kind: edit (projek CLAUDE EDITS), final (00. TO POST FINAL), raw (WORK 2026/RAW), best (TO HARD DRIVE).
# disk = bilangan video yang ada dalam PERTAMA dengan saiz sama (None = tiada tempat salinan dalam PERTAMA untuk jenis ni).
WORK = os.path.expanduser("~/Desktop/WORK 2026")
INV_CACHE = os.path.join(HOME, "footinv_cache.json")
BEST_DEST = os.path.join(DISK, "MIRA/WORK ARCHIVE/WORK 2026", "KLIP TERBAIK")


def _top_videos(root):
    out = []
    try:
        for f in sorted(os.listdir(root)):
            p = os.path.join(root, f)
            if f.startswith(".") or not f.lower().endswith(VIDEO) or not os.path.isfile(p) or os.path.islink(p):
                continue
            st = os.stat(p)
            out.append((f, st.st_size, st.st_mtime))
    except OSError:
        pass
    return out


def _subdirs(root):
    try:
        return sorted(d for d in os.listdir(root) if not d.startswith(".") and os.path.isdir(os.path.join(root, d)))
    except OSError:
        return []


def _disk_count(base, files):
    n = 0
    for rel, size, _ in files:
        try:
            if os.path.getsize(os.path.join(base, rel)) == size:
                n += 1
        except OSError:
            pass
    return n


def inventory(sheet, mounted=None, state=None):
    mounted = os.path.ismount(DISK) if mounted is None else mounted
    state = _load() if state is None else state
    try:
        cache = json.load(open(INV_CACHE, encoding="utf-8"))
    except Exception:
        cache = {}
    rows = []

    def add(key, main, name, kind, files, dest):
        n, size = len(files), sum(f[1] for f in files)
        if dest is None:
            disk = None
        elif mounted:
            disk = _disk_count(dest, files)
            cache[key] = disk
        else:
            disk = cache.get(key, 0) if n else 0
        rows.append({"key": key, "main": main, "name": name, "kind": kind, "n": n, "size": size, "disk": disk,
                     "newest": int(max([f[2] for f in files] or [0]) * 1000)})

    for main in _subdirs(BASE):
        if re.match(r"^R\d", main):                       # R1 product listing (gambar), R2 transfer
            continue
        mroot = os.path.join(BASE, main)
        if main.startswith("00."):
            add(main, main, "Video final", "final", _top_videos(mroot), None)
            continue
        loose = _top_videos(mroot)
        if loose:
            add(main + "/", main, "Fail terus dalam folder", "edit", loose, None)
        for proj in _subdirs(mroot):
            if SKIP_DIR.search(proj):
                continue
            key = main + "/" + proj
            files = _files(os.path.join(mroot, proj))
            if not files:
                continue
            add(key, main, proj, "edit", files, os.path.join(DEST, key))
    # projek yang video Mac dah dibuang (salinan dalam PERTAMA sahaja)
    seen = {r["key"] for r in rows}
    for key, st in state.items():
        if key in seen or not st.get("gone"):
            continue
        g = st["gone"]
        rows.append({"key": key, "main": key.split("/")[0], "name": key.split("/", 1)[1], "kind": "edit", "n": 0,
                     "size": 0, "disk": len(g), "diskSize": sum(x.get("size", 0) for x in g), "newest": 0})
        seen.add(key)
    if mounted:                                           # folder dalam PERTAMA › RAW FOOTAGE yang tiada di Mac langsung
        for main in _subdirs(DEST):
            for proj in _subdirs(os.path.join(DEST, main)):
                key = main + "/" + proj
                if key in seen:
                    continue
                files = _files(os.path.join(DEST, main, proj))
                if files:
                    rows.append({"key": key, "main": main, "name": proj, "kind": "edit", "n": 0, "size": 0,
                                 "disk": len(files), "diskSize": sum(f[1] for f in files), "newest": 0})
    raw = os.path.join(WORK, "RAW")
    for proj in _subdirs(raw):
        files = _files(os.path.join(raw, proj))
        if files:
            add("RAW/" + proj, "RAW", proj, "raw", files, None)
    thd = os.path.join(WORK, "TO HARD DRIVE")
    for proj in _subdirs(thd):
        files = _top_videos(os.path.join(thd, proj))
        if files:
            add("THD/" + proj, "TO HARD DRIVE", proj, "best", files, os.path.join(BEST_DEST, proj))
    try:
        with open(INV_CACHE + ".tmp", "w", encoding="utf-8") as fh:
            json.dump(cache, fh)
        os.replace(INV_CACHE + ".tmp", INV_CACHE)
    except OSError:
        pass
    doc = {"rows": rows, "mounted": mounted, "updated": int(time.time() * 1000)}
    sheet.call("dset", path="sync/footinv", data=doc)
    return doc


def quick(sheet, force=False):
    if _busy.is_set() or (not force and time.time() - _last["t"] < EVERY):
        return False
    _last["t"] = time.time()
    def run():
        _busy.set()
        try:
            scan(sheet)
        except Exception:
            log.exception("rawfoot gagal")
        finally:
            _prog.update(running=False)
            _busy.clear()
    threading.Thread(target=run, daemon=True).start()
    return True


def job_raw_now(inp, sheet):
    """Butang 'Simpan ke PERTAMA sekarang' / segar semula status."""
    if not os.path.ismount(DISK):
        raise RuntimeError("PERTAMA belum disambung ke Mac mini")
    return {"started": quick(sheet, force=True) or _busy.is_set()}


def _back(sheet, key):
    _busy.set()
    try:
        state = _load()
        st = state.setdefault(key, {})
        src_root, dst_root, todo = os.path.join(DEST, key), os.path.join(BASE, key), []
        for d, dirs, fs in os.walk(src_root):
            for f in fs:
                if f.startswith(".") or f.endswith(".part") or not f.lower().endswith(VIDEO):
                    continue
                rel = os.path.relpath(os.path.join(d, f), src_root)
                p = os.path.join(dst_root, rel)
                if not os.path.exists(p) or os.path.getsize(p) != os.path.getsize(os.path.join(d, f)):
                    todo.append(rel)
        _prog.update(running=True, key=key, kind="back", done=0, total=len(todo), msg="")
        _put(sheet, (sheet.call("dget", path="sync/rawfoot").get("doc") or {}).get("folders") or {}, True)
        for i, rel in enumerate(sorted(todo)):
            os.makedirs(os.path.dirname(os.path.join(dst_root, rel)), exist_ok=True)
            tmp = os.path.join(dst_root, rel) + ".part"
            shutil.copyfile(os.path.join(src_root, rel), tmp)
            try:
                shutil.copystat(os.path.join(src_root, rel), tmp)
            except OSError:
                pass
            os.replace(tmp, os.path.join(dst_root, rel))
            _prog["done"] = i + 1
            if i % 5 == 4:
                _put(sheet, (sheet.call("dget", path="sync/rawfoot").get("doc") or {}).get("folders") or {}, True)
        st.update(gone=[], backAt=int(time.time() * 1000))
        st.pop("fullAt", None)
        _save(state)
        log.info("Raw footage %s: %d video disalin balik dari PERTAMA", key, len(todo))
    except Exception as e:
        log.exception("Salin balik %s gagal", key)
        _prog["msg"] = "Salin balik gagal: " + str(e)[:120]
    finally:
        _prog.update(running=False)
        _busy.clear()
    try:
        scan(sheet)
    except Exception:
        log.exception("rawfoot gagal lepas salin balik")


def job_raw_back(inp, sheet):
    """Salin balik raw footage dari PERTAMA ke folder projek dalam Mac (untuk edit semula)."""
    key = str(inp.get("key") or "")
    if not _ok_key(key):
        raise RuntimeError("folder tak sah")
    if not os.path.ismount(DISK):
        raise RuntimeError("Sambung PERTAMA ke Mac mini dulu")
    if not os.path.isdir(os.path.join(DEST, key)):
        raise RuntimeError("Tiada salinan folder ni dalam PERTAMA")
    if _busy.is_set():
        raise RuntimeError("Mac mini sedang salin footage lain. Cuba sekejap lagi")
    threading.Thread(target=_back, args=(sheet, key), daemon=True).start()
    return {"started": True}
