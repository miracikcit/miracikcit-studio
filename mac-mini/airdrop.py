#!/usr/bin/env python3
"""Footage melalui AirDrop (2026-11-26, Mira): "aku nak transfer files je".

Mira tekan Footage pada kad Shoot > AirDrop, kemudian AirDrop video dari Photos ke Mac mini. Worker pindahkan fail
yang sampai dalam ~/Downloads ke <folder utama>/<nama kad> dalam CLAUDE EDITS dan pautkan folder ke kad. 0 token.

- Hanya fail yang betul-betul datang dari AirDrop (xattr com.apple.quarantine ada "sharingd") disentuh.
- Job `air_wait` {item, stage, name, t0, take}: 30 minit selepas t0, setiap video / gambar AirDrop yang sampai masuk
  folder kad tu. `take` = ambil juga video yang dah sampai sebelum kad ditekan (senarai "belum ada kad").
- Tiada kad menunggu: video AirDrop 48 jam terakhir disenaraikan dalam `sync/airdrop` {files:[{name,size,at}]};
  Home tanya "untuk kad mana?". Job `air_ignore` buang senarai tu (fail kekal dalam Downloads).
- Status kad dalam doc footin/<item>: tunggu (until) / sedia (done) / error.
Thread sendiri, semak Downloads setiap 5 saat; tulis ke Sheet hanya bila ada perubahan."""
import json, logging, os, re, shutil, subprocess, threading, time

log = logging.getLogger("transcribe")
HOME = os.path.dirname(os.path.abspath(__file__))
DOWN = os.path.expanduser("~/Downloads")
STATE = os.path.join(HOME, "airdrop_state.json")
VIDEO = (".mp4", ".mov", ".m4v")
IMAGE = (".jpg", ".jpeg", ".heic", ".png")
WAIT_S = 30 * 60
PENDING_S = 48 * 3600
EVERY = 5
STABLE_S = 6

_lock = threading.RLock()
_started = threading.Event()
_xa = {}          # (nama, saiz, ctime) -> bool AirDrop
_sizes = {}       # nama -> saiz pada imbasan lepas
_last_pending = {"sig": None}
_warned = {"perm": False}


def _load():
    try:
        return json.load(open(STATE, encoding="utf-8"))
    except Exception:
        return {}


def _save(st):
    tmp = STATE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(st, fh, ensure_ascii=False)
    os.replace(tmp, STATE)


def _is_airdrop(path, key):
    if key not in _xa:
        try:
            r = subprocess.run(["/usr/bin/xattr", "-p", "com.apple.quarantine", path], capture_output=True, text=True, timeout=10)
            _xa[key] = r.returncode == 0 and "sharingd" in r.stdout
        except Exception:
            return False
        if len(_xa) > 2000:
            _xa.clear()
    return _xa[key]


def _candidates(down=None):
    """Fail AirDrop yang dah habis diterima: [{name, path, size, at(saat tiba), video}]."""
    down = down or DOWN
    out, seen, now = [], {}, time.time()
    try:
        names = os.listdir(down)
    except OSError as e:
        if not _warned["perm"]:
            _warned["perm"] = True
            log.warning("AirDrop: tak boleh baca Downloads (%s). Beri kebenaran Files and Folders > Downloads.", e)
        return out
    for n in names:
        low = n.lower()
        if n.startswith(".") or not low.endswith(VIDEO + IMAGE):
            continue
        p = os.path.join(down, n)
        try:
            st = os.stat(p)
        except OSError:
            continue
        if not os.path.isfile(p) or os.path.islink(p):
            continue
        seen[n] = st.st_size
        stable = _sizes.get(n) == st.st_size and now - st.st_ctime >= STABLE_S and st.st_size > 0
        if not stable or not _is_airdrop(p, (n, st.st_size, int(st.st_ctime))):
            continue
        out.append({"name": n, "path": p, "size": st.st_size, "at": st.st_ctime, "video": low.endswith(VIDEO)})
    _sizes.clear()
    _sizes.update(seen)
    return sorted(out, key=lambda f: f["at"])


def _move(files, dest):
    os.makedirs(dest, exist_ok=True)
    done = []
    for f in files:
        out = os.path.join(dest, f["name"])
        if os.path.exists(out):
            b, e = os.path.splitext(f["name"])
            out = os.path.join(dest, "%s_%d%s" % (b, int(time.time()) % 100000, e))
        shutil.move(f["path"], out)
        done.append(os.path.basename(out))
    return done


def _put(sheet, item, **kw):
    kw["at"] = int(time.time() * 1000)
    kw["air"] = True
    sheet.call("dset", path="footin/" + item, data=kw)


def _pending_put(sheet, files, force=False):
    lst = [{"name": f["name"], "size": f["size"], "at": int(f["at"] * 1000)} for f in files]
    sig = json.dumps(lst, sort_keys=True)
    if force or sig != _last_pending["sig"]:
        sheet.call("dset", path="sync/airdrop", data={"files": lst, "updated": int(time.time() * 1000)})
        _last_pending["sig"] = sig


def tick(sheet, W, down=None):
    """Satu pusingan. Pulang (bilangan dipindah, bilangan menunggu kad)."""
    with _lock:
        st, now = _load(), time.time()
        cand = _candidates(down)
        w = st.get("wait")
        moved = 0
        if w:
            mine = [f for f in cand if f["at"] >= w["t0"] - 5 or (w.get("take") and f["name"] in w["take"])]
            folder = w["stage"] + "/" + w["name"]
            if mine:
                try:
                    main, _ = W._edit_main(w["stage"])
                    names = _move(mine, os.path.join(main, w["name"]))
                    moved = len(names)
                    w["done"] = w.get("done", 0) + moved
                    w["files"] = (w.get("files") or []) + names
                    w["take"] = []
                    W._set_item(sheet, w["item"], folder=folder)
                    _put(sheet, w["item"], status="tunggu", done=w["done"], until=int(w["until"] * 1000), folder=folder, files=w["files"][-50:])
                    W._scan_last["t"] = 0
                    W.push_scan(sheet, force=True)
                    log.info("AirDrop: %d fail masuk %s", moved, folder)
                except Exception as e:
                    log.exception("AirDrop gagal pindah")
                    _put(sheet, w["item"], status="error", msg=str(e)[:200], done=w.get("done", 0), folder=folder)
                    w = None
                cand = [f for f in cand if f not in mine]
            if w and now > w["until"]:
                _put(sheet, w["item"], status="sedia" if w.get("done") else "tamat", done=w.get("done", 0), n=w.get("done", 0),
                     folder=folder, files=(w.get("files") or [])[-50:])
                w = None
            if w:
                st["wait"] = w
            else:
                st.pop("wait", None)
        ign = set(st.get("ignore") or [])
        pend = [f for f in cand if f["video"] and now - f["at"] < PENDING_S and (f["name"] + "|" + str(f["size"])) not in ign
                and not (w and f["at"] >= w["t0"] - 5)]
        live = {f["name"] + "|" + str(f["size"]) for f in cand}
        st["ignore"] = sorted(ign & live)
        _save(st)
        _pending_put(sheet, pend)
        return moved, len(pend)


def job_wait(inp, sheet, W):
    """Kad ditekan: 30 minit seterusnya, fail AirDrop masuk folder kad ni."""
    item = re.sub(r"[^\w-]", "", str(inp.get("item") or ""))
    stage, name = str(inp.get("stage") or ""), W._safe_name(inp.get("name"))
    W._edit_main(stage)
    if not item:
        raise RuntimeError("Tiada kad")
    now = time.time()
    t0 = min(now, float(inp.get("t0") or 0) / 1000.0 or now)
    if now - t0 > WAIT_S:
        t0 = now
    with _lock:
        st = _load()
        old = st.get("wait")
        if old and old.get("item") != item:
            _put(sheet, old["item"], status="sedia" if old.get("done") else "tamat", done=old.get("done", 0), n=old.get("done", 0),
                 folder=old["stage"] + "/" + old["name"])
        take = []
        if inp.get("take"):
            take = [f["name"] for f in _candidates() if f["video"] and now - f["at"] < PENDING_S]
        keep = old if (old and old.get("item") == item and old.get("stage") == stage and old.get("name") == name) else {}
        st["wait"] = {"item": item, "stage": stage, "name": name, "t0": keep.get("t0", t0), "until": now + WAIT_S, "take": take,
                      "done": keep.get("done", 0), "files": keep.get("files", [])}
        _save(st)
        _put(sheet, item, status="tunggu", done=keep.get("done", 0), until=int((now + WAIT_S) * 1000), folder=stage + "/" + name)
    tick(sheet, W)
    return {"folder": stage + "/" + name, "until": int((now + WAIT_S) * 1000)}


def job_ignore(inp, sheet, W):
    """Home: 'Bukan footage'. Fail kekal dalam Downloads, cuma tak ditanya lagi."""
    with _lock:
        st = _load()
        st["ignore"] = sorted(set(st.get("ignore") or []) | {f["name"] + "|" + str(f["size"]) for f in _candidates()})
        _save(st)
    tick(sheet, W)
    return {"ok": True}


def quick(sheet, W):
    """Dipanggil dari gelung utama worker: mulakan thread sekali sahaja."""
    if _started.is_set():
        return
    _started.set()

    def loop():
        while True:
            try:
                tick(sheet, W)
            except Exception:
                log.exception("AirDrop tick gagal")
            time.sleep(EVERY)
    threading.Thread(target=loop, daemon=True).start()
