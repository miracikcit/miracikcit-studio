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
Thread sendiri, semak Downloads setiap 5 saat; tulis ke Sheet hanya bila ada perubahan.

27 Nov 2026 (Mira: video AirDrop lalu kad tak masuk folder; "aku tak nak mix up footage"):
- Kad TAK ditutup 30 saat selepas fail pertama lagi (video besar sampai lambat): QUIET_S 3 minit.
- Video yang sampai selepas kad ditutup TAK dipindah sendiri: masuk senarai menunggu dengan gambar kecil + `last` (kad terakhir, 1 jam),
  Studio tanya "Masukkan ke <kad terakhir>?" / kad lain, dan phone dapat notifikasi.
- Resit: doc footin ada `list` [{n, s, th}] (gambar kecil), `have` (bilangan video sebenar dalam folder), `manual` (ditambah terus
  dalam folder, bukan melalui Studio), `gone` (hilang dari folder), `ack` (Mac mini dah terima arahan).
- Semak folder setiap minit (`_recon`): video ditambah terus dalam Finder dikesan, ditawarkan ke projek Editor; sisa `.part` > 24 jam ke Trash.
- Job air_wait {move:1, item, files, to:{item, stage, name}} = pindah video yang tersalah kad (hanya fail yang masuk melalui AirDrop).
- Tulisan ke Sheet yang gagal (Sheet terkunci) disimpan dan dicuba semula; pemindahan fail tak bergantung pada Sheet."""
import base64, json, logging, os, re, shutil, subprocess, tempfile, threading, time

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
QUIET_S = 180     # tiada fail baru selama ni selepas fail terakhir masuk = kad Diterima (27 Nov: 30 s terlalu cepat, video besar sampai lambat)
RECON_S = 60      # semak isi folder kad
LAST_S = 3600     # video lewat ditawarkan kepada kad terakhir selama ni
CARD_S = 14 * 86400

_lock = threading.RLock()
_started = threading.Event()
_xa = {}          # (nama, saiz, ctime) -> bool AirDrop
_sizes = {}       # nama -> saiz pada imbasan lepas
_last_pending = {"sig": None}
_warned = {"perm": False}
_incoming = {"n": 0}   # fail media dalam Downloads yang belum stabil (masih diterima)
_out = []         # tulisan Sheet yang gagal: [(path, data)], dicuba semula setiap pusingan
_th = {}          # (nama, saiz) -> gambar kecil base64
_recon_at = {"t": 0}
_pend_n = {"n": 0}


def _send(sheet, path, data):
    try:
        sheet.call("dset", path=path, data=data)
        return True
    except Exception as e:
        _out[:] = [o for o in _out if o[0] != path] + [(path, data)]
        log.warning("AirDrop: Sheet tak jawab, %s disimpan untuk cuba semula (%s)", path, str(e)[:80])
        return False


def _flush(sheet):
    while _out:
        path, data = _out[0]
        try:
            sheet.call("dset", path=path, data=data)
        except Exception:
            return
        _out.pop(0)


def _thumb(path, key=None):
    """Gambar kecil 72 px (base64 JPEG ~1.5 KB) untuk resit dalam Studio. Gagal = kosong."""
    key = key or (os.path.basename(path), os.path.getsize(path) if os.path.exists(path) else 0)
    if key in _th:
        return _th[key]
    out = ""
    try:
        ff = shutil.which("ffmpeg") or "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name
        vid = path.lower().endswith(VIDEO)
        cmd = [ff, "-y", "-v", "error"] + (["-ss", "0.5"] if vid else []) + ["-i", path, "-frames:v", "1", "-vf", "scale=72:-2", "-q:v", "12", tmp]
        subprocess.run(cmd, capture_output=True, timeout=25)
        if os.path.getsize(tmp) > 0:
            out = base64.b64encode(open(tmp, "rb").read()).decode()
        os.remove(tmp)
    except Exception:
        pass
    if len(_th) > 400:
        _th.clear()
    _th[key] = out if len(out) < 3500 else ""
    return _th[key]


def _listdir(folder):
    try:
        return sorted(n for n in os.listdir(folder) if not n.startswith(".") and n.lower().endswith(VIDEO + IMAGE) and os.path.isfile(os.path.join(folder, n)))
    except OSError:
        return None


def _card(st, item, stage=None, name=None, W=None):
    """Rekod tempatan setiap kad: folder, fail yang masuk melalui AirDrop, isi folder terakhir dilihat."""
    cs = st.setdefault("cards", {})
    c = cs.get(item)
    if c is None or (stage and (c.get("stage") != stage or c.get("name") != name)):
        c = {"stage": stage, "name": name, "air": [], "seen": None, "manual": [], "gone": [], "doc": {}}
        if W and stage:
            try:
                c["seen"] = _listdir(os.path.join(W._edit_main(stage)[0], name))
            except Exception:
                pass
        cs[item] = c
    c["t"] = time.time()
    return c


def _card_put(sheet, st, item, **kw):
    """Tulis doc footin/<item>, sentiasa dengan keadaan folder sebenar (have / manual / gone)."""
    c = (st.get("cards") or {}).get(item)
    doc = dict((c or {}).get("doc") or {}, **kw)
    if c:
        seen = c.get("seen") or []
        doc.update(have=len([n for n in seen if n.lower().endswith(VIDEO)]), manual=(c.get("manual") or [])[-20:], gone=(c.get("gone") or [])[-20:])
        c["doc"] = doc
    doc.update(at=int(time.time() * 1000), air=True, ack=1)
    _send(sheet, "footin/" + item, doc)


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
    out, seen, now, busy = [], {}, time.time(), 0
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
        if st.st_size > 0 and (_sizes.get(n) not in (None, st.st_size) or now - st.st_ctime < STABLE_S):
            busy += 1
        if not stable or not _is_airdrop(p, (n, st.st_size, int(st.st_ctime))):
            continue
        out.append({"name": n, "path": p, "size": st.st_size, "at": st.st_ctime, "video": low.endswith(VIDEO)})
    _sizes.clear()
    _sizes.update(seen)
    _incoming["n"] = busy
    return sorted(out, key=lambda f: f["at"])


def _move(files, dest):
    os.makedirs(dest, exist_ok=True)
    done = []
    for f in files:
        out = os.path.join(dest, f["name"])
        if os.path.exists(out) and os.path.getsize(out) == f["size"]:
            # fail sama dihantar dua kali: jangan simpan dua salinan
            tr = os.path.expanduser("~/.Trash")
            b, e = os.path.splitext(f["name"])
            try:
                shutil.move(f["path"], os.path.join(tr, "%s_dup%d%s" % (b, int(time.time() * 1000) % 10000000, e)))
            except Exception:
                os.remove(f["path"])
            continue
        if os.path.exists(out):
            b, e = os.path.splitext(f["name"])
            out = os.path.join(dest, "%s_%d%s" % (b, int(time.time()) % 100000, e))
        shutil.move(f["path"], out)
        done.append(os.path.basename(out))
    return done


def _put(sheet, item, **kw):
    kw["at"] = int(time.time() * 1000)
    kw["air"] = True
    kw["ack"] = 1
    _send(sheet, "footin/" + item, kw)


def _pending_put(sheet, files, force=False, last=None, W=None):
    lst = [{"name": f["name"], "size": f["size"], "at": int(f["at"] * 1000), "th": _thumb(f["path"], (f["name"], f["size"])) if i < 8 else ""}
           for i, f in enumerate(files)]
    data = {"files": lst}
    if last and lst:
        data["last"] = {k: last.get(k) for k in ("item", "stage", "name")}
    sig = json.dumps(data, sort_keys=True)
    if force or sig != _last_pending["sig"]:
        if _send(sheet, "sync/airdrop", dict(data, updated=int(time.time() * 1000))):
            _last_pending["sig"] = sig
        if lst and not _pend_n["n"] and W is not None:
            try:
                W.push_send(sheet, "Video sampai tanpa kad", "%d video menunggu di Mac mini. Buka Studio dan pilih kad." % len(lst))
            except Exception:
                pass
    _pend_n["n"] = len(lst)


_sess = {"sig": None}


def _sessions(sheet):
    """Sesi Claude (EDIT NOW, Remote Control) yang masih hidup dalam Terminal Mac mini -> sync/sessions {ids:[id tracker editor]}.
    Kad Edit guna ni untuk tahu link chat dah mati (27 Nov, Mira tak dapat buka kerja pending GENTING). Ditulis hanya bila berubah.
    (Diletak di sini supaya worker.py tak perlu diubah; thread AirDrop memang jalan setiap minit.)"""
    r = subprocess.run(["/bin/ps", "-axo", "command"], capture_output=True, text=True, timeout=10, env=dict(os.environ, LC_ALL="en_US.UTF-8"))
    ids = sorted(set(re.findall(r"tracker Studio: editor/([\w-]+)", "\n".join(l for l in r.stdout.splitlines() if "remote-control" in l))))
    sig = ",".join(ids)
    if sig != _sess["sig"] and _send(sheet, "sync/sessions", {"ids": ids, "at": int(time.time() * 1000)}):
        _sess["sig"] = sig


def _recon(sheet, W, st, now):
    """Setiap minit: banding isi folder setiap kad dengan kali terakhir. Video ditambah / hilang di luar Studio ditanda pada kad."""
    cs = st.setdefault("cards", {})
    for item in [k for k, c in cs.items() if now - c.get("t", 0) > CARD_S]:
        cs.pop(item, None)
    for item, c in cs.items():
        if not c.get("stage"):
            continue
        try:
            folder = os.path.join(W._edit_main(c["stage"])[0], c["name"])
        except Exception:
            continue
        cur = _listdir(folder)
        if cur is None:
            continue
        try:   # sisa upload yang gagal
            for n in os.listdir(folder):
                p = os.path.join(folder, n)
                if n.endswith(".part") and now - os.path.getmtime(p) > 86400:
                    W.trash_local(p)
                    log.info("AirDrop: sisa upload %s dibuang ke Trash", n)
        except Exception:
            pass
        prev = c.get("seen")
        if prev is None:
            c["seen"] = cur
            continue
        if cur == prev:
            continue
        added = [n for n in cur if n not in prev and n not in (c.get("air") or [])]
        gone = [n for n in prev if n not in cur]
        c["seen"] = cur
        c["manual"] = [n for n in (c.get("manual") or []) if n in cur] + added
        c["gone"] = [n for n in (c.get("gone") or []) if n not in cur] + gone
        c["air"] = [n for n in (c.get("air") or []) if n in cur]
        c["t"] = now
        if c.get("doc"):
            c["doc"]["list"] = [e for e in c["doc"].get("list") or [] if e.get("n") in cur]
        _card_put(sheet, st, item, **({} if c.get("doc") else {"status": "sedia", "done": 0, "folder": c["stage"] + "/" + c["name"]}))
        log.info("AirDrop: folder %s berubah di luar Studio (+%d, -%d)", c["name"], len(added), len(gone))
        vids = [n for n in added if n.lower().endswith(VIDEO)]
        if vids:
            try:
                _extra_note(st, sheet, W, {"stage": c["stage"], "name": c["name"], "item": item}, vids)
            except Exception:
                log.exception("AirDrop: semak projek Editor gagal")
        try:
            W._scan_last["t"] = 0
            W.push_scan(sheet, force=True)
        except Exception:
            pass


def tick(sheet, W, down=None):
    """Satu pusingan. Pulang (bilangan dipindah, bilangan menunggu kad)."""
    with _lock:
        st, now = _load(), time.time()
        _flush(sheet)
        cand = _candidates(down)
        w = st.get("wait")
        moved = 0
        if w:
            mine = [f for f in cand if f["at"] >= w["t0"] - 5 or (w.get("take") and f["name"] in w["take"])]
            folder = w["stage"] + "/" + w["name"]
            if mine:
                try:
                    main, _ = W._edit_main(w["stage"])
                    dest = os.path.join(main, w["name"])
                    c = _card(st, w["item"], w["stage"], w["name"], W)
                    names = _move(mine, dest)
                    moved = len(names)
                    w["done"] = w.get("done", 0) + moved
                    w["files"] = (w.get("files") or []) + names
                    w["take"] = []
                    w["last"] = now
                    c["air"] = (c.get("air") or []) + names
                    c["seen"] = _listdir(dest) or []
                    c["gone"] = [n for n in (c.get("gone") or []) if n not in c["seen"]]
                    w["list"] = ((w.get("list") or []) + [{"n": n, "s": os.path.getsize(os.path.join(dest, n)), "th": _thumb(os.path.join(dest, n))} for n in names])[-8:]
                    _save(st)   # fail dah berpindah: rekod dulu, Sheet kemudian (Sheet gagal tak boleh hilangkan rekod)
                    _card_put(sheet, st, w["item"], status="tunggu", done=w["done"], until=int(w["until"] * 1000), folder=folder, files=w["files"][-50:], list=w["list"])
                    try:
                        W._set_item(sheet, w["item"], folder=folder)
                        W._scan_last["t"] = 0
                        W.push_scan(sheet, force=True)
                    except Exception as e:
                        log.warning("AirDrop: fail dah masuk folder, tapi Studio belum dikemas kini (%s)", str(e)[:80])
                    try:
                        _extra_note(st, sheet, W, w, [n for n in names if n.lower().endswith(VIDEO)])
                    except Exception:
                        log.exception("AirDrop: semak projek Editor gagal")
                    log.info("AirDrop: %d fail masuk %s", moved, folder)
                except Exception as e:
                    log.exception("AirDrop gagal pindah")
                    _put(sheet, w["item"], status="error", msg=str(e)[:200], done=w.get("done", 0), folder=folder)
                    w = None
                cand = [f for f in cand if f not in mine]
            if w and w.get("done"):
                w.setdefault("last", now)
            quiet = w and w.get("done") and not mine and not _incoming["n"] and now - w.get("last", now) >= QUIET_S
            if w and (now > w["until"] or quiet):
                _card(st, w["item"], w["stage"], w["name"], W)
                _card_put(sheet, st, w["item"], status="sedia" if w.get("done") else "tamat", done=w.get("done", 0), n=w.get("done", 0),
                          folder=folder, files=(w.get("files") or [])[-50:], list=w.get("list") or [])
                st["last"] = {"item": w["item"], "stage": w["stage"], "name": w["name"], "at": now}
                w = None
            if w:
                st["wait"] = w
            else:
                st.pop("wait", None)
        ign = set(st.get("ignore") or [])
        pend = [f for f in cand if f["video"] and now - f["at"] < PENDING_S and (f["name"] + "|" + str(f["size"])) not in ign
                and not (w and f["at"] >= w["t0"] - 5)]
        live = {k + "|" + str(v) for k, v in _sizes.items()}   # semua fail dalam Downloads, bukan yang stabil sahaja (elak hilang lepas restart)
        st["ignore"] = sorted(ign & live)
        if now - _recon_at["t"] >= RECON_S and down is None:
            _recon_at["t"] = now
            try:
                _recon(sheet, W, st, now)
            except Exception:
                log.exception("AirDrop: semak folder gagal")
            try:
                _sessions(sheet)
            except Exception:
                log.exception("Semak sesi Claude gagal")
        last = st.get("last")
        if last and now - last.get("at", 0) > LAST_S:
            st.pop("last", None)
            last = None
        _save(st)
        _pending_put(sheet, pend, last=last, W=W)
        return moved, len(pend)


# ---- Footage tambahan untuk projek yang DAH ada dalam Editor (26 Nov, Mira pilih cadangan A) ----
# Bila video AirDrop masuk folder kad dan folder tu dah ada projek Editor yang belum final, catat dalam sync/edextra
# {items:{<kunci>:{vid, base, title, folder, item, files[], at, status?}}}. Studio (kad Shoot, baris Edit) dan app Editor
# tunjuk "+N footage baru" dengan butang Masukkan ke projek -> job air_wait {extra:<kunci>} -> edfoot._add (klip masuk
# Klip simpanan, maks 15 s setiap klip; edit sedia ada tak berubah). {extra, drop:true} = abaikan.
def _projects(sheet, W, stage, name):
    import edpwa
    main, _ = W._edit_main(stage)
    root, out = os.path.join(main, name), []
    for dp, dn, fn in os.walk(root):
        depth = dp[len(root):].count(os.sep)
        dn[:] = [] if depth >= 5 else [d for d in dn if not d.startswith(".")]
        if "data.json" not in fn or "proxy.mp4" not in fn:
            continue
        dn[:] = []
        for d, base in ((dp, ""), (os.path.dirname(dp), os.path.basename(dp))):
            vid = edpwa.vid_of(d)
            doc = (sheet.call("dget", path="edpwa/" + vid) or {}).get("doc") or {}
            if doc.get("dir") and os.path.realpath(doc["dir"]) == os.path.realpath(d):
                if doc.get("status") == "sedia" and not doc.get("pub") and doc.get("final") != "siap":
                    out.append((vid, base, doc))
                break
    return out


def _extra_put(sheet, st):
    sheet.call("dset", path="sync/edextra", data={"items": st.get("extra") or {}, "updated": int(time.time() * 1000)})


def _extra_note(st, sheet, W, w, vids):
    if not vids:
        return
    ex = st.setdefault("extra", {})
    hit = False
    for vid, base, doc in _projects(sheet, W, w["stage"], w["name"]):
        key = vid + ("~" + re.sub(r"[^\w-]", "", base) if base else "")
        e = ex.get(key) or {"vid": vid, "base": base, "title": str(doc.get("title") or vid)[:80], "folder": w["stage"] + "/" + w["name"],
                            "item": w["item"], "files": []}
        if e.get("status") == "proses":
            e = dict(e, files=[], status=None)   # yang sedang dimasukkan kekal dalam thread; ni kumpulan baru
        e["files"] = e["files"] + [w["name"] + "/" + n for n in vids if w["name"] + "/" + n not in e["files"]]
        e["at"] = int(time.time() * 1000)
        e.pop("msg", None)
        if e.get("status") != "proses":
            e.pop("status", None)
        ex[key] = e
        hit = True
    if hit:
        _extra_put(sheet, st)
        log.info("AirDrop: %d footage tambahan dicatat untuk projek Editor dalam %s", len(vids), w["name"])


def _extra_job(inp, sheet, W):
    key = re.sub(r"[^\w~-]", "", str(inp.get("extra")))
    with _lock:
        st = _load()
        e = (st.get("extra") or {}).get(key)
        if not e:
            _extra_put(sheet, st)
            return {"ok": True, "none": True}
        if inp.get("drop"):
            st["extra"].pop(key, None)
            _save(st)
            _extra_put(sheet, st)
            return {"ok": True}
        if e.get("status") == "proses" and time.time() * 1000 - e.get("t0", 0) < 30 * 60000:
            return {"ok": True, "busy": True}
        files = list(e.get("files") or [])
        e.update(status="proses", t0=int(time.time() * 1000), n=len(files))
        e.pop("msg", None)
        _save(st)
        _extra_put(sheet, st)
    threading.Thread(target=_extra_run, args=(sheet, W, key, dict(e), files), daemon=True).start()
    return {"ok": True, "n": len(files)}


def _extra_run(sheet, W, key, e, files):
    err = None
    try:
        import edfoot
        doc = (sheet.call("dget", path="edpwa/" + e["vid"]) or {}).get("doc") or {}
        if not doc.get("dir") or not os.path.isdir(doc["dir"]):
            raise RuntimeError("Projek Editor tak dijumpai dalam Mac mini")
        for i in range(0, len(files), 12):
            edfoot._add({"vid": e["vid"], "base": e.get("base") or "", "files": files[i:i + 12]}, sheet, None, W, e["vid"], doc)
        log.info("AirDrop: %d footage tambahan masuk projek %s", len(files), e["vid"])
    except Exception as ex:
        log.exception("Footage tambahan gagal")
        err = str(ex)[:200]
    with _lock:
        st = _load()
        cur = (st.get("extra") or {}).get(key)
        if cur:
            if err:
                cur.update(status="error", msg=err)
            else:
                cur["files"] = [f for f in cur.get("files") or [] if f not in files]
                if cur["files"]:
                    cur.pop("status", None)
                else:
                    st["extra"].pop(key, None)
            _save(st)
        _extra_put(sheet, st)


def job_wait(inp, sheet, W):
    """Kad ditekan: 30 minit seterusnya, fail AirDrop masuk folder kad ni."""
    item = re.sub(r"[^\w-]", "", str(inp.get("item") or ""))
    if inp.get("extra"):
        return _extra_job(inp, sheet, W)
    if inp.get("move"):
        return _move_job(inp, sheet, W)
    if inp.get("cancel"):
        with _lock:
            st = _load()
            w = st.get("wait")
            if w and w.get("item") == item:
                _card(st, item, w["stage"], w["name"], W)
                _card_put(sheet, st, item, status="sedia" if w.get("done") else "batal", done=w.get("done", 0), n=w.get("done", 0),
                          folder=w["stage"] + "/" + w["name"], files=(w.get("files") or [])[-50:], list=w.get("list") or [])
                st["last"] = {"item": item, "stage": w["stage"], "name": w["name"], "at": time.time()}
                st.pop("wait", None)
                _save(st)
        tick(sheet, W)
        return {"ok": True}
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
        if old and old.get("item") != item and now <= old.get("until", 0):
            # satu kad sahaja menunggu pada satu masa (Mira 26 Nov: elak tercampur folder)
            _put(sheet, item, status="error", msg="Kad lain masih menunggu AirDrop. Tunggu Diterima atau Batal dulu.", done=0)
            raise RuntimeError("Kad lain masih menunggu AirDrop")
        take = []
        if inp.get("take"):
            take = [f["name"] for f in _candidates() if f["video"] and now - f["at"] < PENDING_S]
        keep = old if (old and old.get("item") == item and old.get("stage") == stage and old.get("name") == name) else {}
        st["wait"] = {"item": item, "stage": stage, "name": name, "t0": keep.get("t0", t0), "until": now + WAIT_S, "take": take,
                      "done": keep.get("done", 0), "files": keep.get("files", []), "list": keep.get("list", [])}
        c = _card(st, item, stage, name, W)
        if not keep:
            c["doc"] = {}
        st.pop("last", None)
        _save(st)
        _card_put(sheet, st, item, status="tunggu", done=keep.get("done", 0), until=int((now + WAIT_S) * 1000), folder=stage + "/" + name, list=keep.get("list", []))
    tick(sheet, W)
    return {"folder": stage + "/" + name, "until": int((now + WAIT_S) * 1000)}


def _move_job(inp, sheet, W):
    """Salah kad: pindah video dari folder kad A ke folder kad B. Hanya fail yang masuk melalui AirDrop ke kad A boleh dipindah."""
    src_item = re.sub(r"[^\w-]", "", str(inp.get("item") or ""))
    to = inp.get("to") or {}
    dst_item = re.sub(r"[^\w-]", "", str(to.get("item") or ""))
    stage, name = str(to.get("stage") or ""), W._safe_name(to.get("name"))
    with _lock:
        st = _load()
        a = (st.get("cards") or {}).get(src_item)
        if not a or not dst_item or dst_item == src_item:
            raise RuntimeError("Kad asal tak dijumpai")
        if (st.get("wait") or {}).get("item") in (src_item, dst_item):
            raise RuntimeError("Kad masih menunggu AirDrop. Tekan Selesai dulu.")
        src = os.path.join(W._edit_main(a["stage"])[0], a["name"])
        dst = os.path.join(W._edit_main(stage)[0], name)
        if os.path.realpath(src) == os.path.realpath(dst):
            raise RuntimeError("Folder sama")
        want = [os.path.basename(str(n)) for n in (inp.get("files") or [])]
        files = [{"name": n, "path": os.path.join(src, n), "size": os.path.getsize(os.path.join(src, n))}
                 for n in want if n in (a.get("air") or []) and os.path.isfile(os.path.join(src, n))]
        if not files:
            raise RuntimeError("Tiada video yang boleh dipindah")
        b = _card(st, dst_item, stage, name, W)
        names = _move(files, dst)
        gone = [f["name"] for f in files]
        a["air"] = [n for n in a.get("air") or [] if n not in gone]
        a["seen"] = _listdir(src) or []
        b["air"] = (b.get("air") or []) + names
        b["seen"] = _listdir(dst) or []
        ad, bd = a.get("doc") or {}, b.get("doc") or {}
        al = [e for e in ad.get("list") or [] if e.get("n") not in gone]
        bl = ((bd.get("list") or []) + [{"n": n, "s": os.path.getsize(os.path.join(dst, n)), "th": _thumb(os.path.join(dst, n))} for n in names])[-8:]
        _save(st)
        _card_put(sheet, st, src_item, status="sedia", done=max(0, (ad.get("done") or 0) - len(gone)), list=al,
                  files=[n for n in ad.get("files") or [] if n not in gone], folder=a["stage"] + "/" + a["name"])
        _card_put(sheet, st, dst_item, status="sedia", done=(bd.get("done") or 0) + len(names), list=bl,
                  files=((bd.get("files") or []) + names)[-50:], folder=stage + "/" + name)
        _save(st)
        try:
            W._set_item(sheet, dst_item, folder=stage + "/" + name)
            W._scan_last["t"] = 0
            W.push_scan(sheet, force=True)
        except Exception:
            pass
        log.info("AirDrop: %d fail dipindah dari %s ke %s", len(names), a["name"], name)
        return {"moved": len(names)}


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
