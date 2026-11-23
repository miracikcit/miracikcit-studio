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
AUTO_TYPES = {"vlog", "product"}    # vlog: semua footage B-roll untuk VO; product: suara dari video bercakap + B-roll / close-up
START_MS = 1795165200000             # 2026-11-20: auto pre-cut hanya folder baru selepas ni; folder lama guna butang Pre-cut dalam Studio
_lock = threading.Lock()
_busy = set()


def ftype(rel):
    """Sama dengan engine.folder_type: jenis ikut nama folder utama."""
    main = (rel or "").split("/")[0].upper()
    if re.search(r"VLOG|\+ ?VO|TUNGGU VO", main):
        return "vlog"
    if re.search(r"SHOP|UNBOXING|COOK", main):
        return "product"
    if "TALK" in main:
        return "talk"
    return "other"


def _targets(key):
    """(Folder hasil edit Claude seperti draft / editor / render / build dilangkau.) Folder yang perlu di-pre-cut untuk satu projek: projek itu sendiri (kalau ada video terus) dan setiap
    subfolder yang ada video (cth GENTING/04 Sky Avenue). Folder kabur / duplicate dilangkau."""
    root = os.path.join(BASE, key)
    out = []
    try:
        names = sorted(os.listdir(root))
    except Exception:
        return out
    if any(n.lower().endswith(VID) and not n.startswith(".") for n in names):
        out.append(key)
    for n in names:
        sub = os.path.join(root, n)
        if n.startswith(".") or not os.path.isdir(sub) or re.search(r"kabur|duplicate|draft|draf\b|editor|render|final|export|output|storyboard|^sb$|transcript|sheet|proxy|cache|^page$|build", n, re.I):
            continue
        try:
            if any(f.lower().endswith(VID) and not f.startswith(".") for f in os.listdir(sub)):
                out.append(key + "/" + n)
        except Exception:
            pass
    return out


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
            _write_targets(sheet, st)
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
        if ftype(stg["name"]) not in AUTO_TYPES:
            continue
        for it in stg.get("items") or []:
            key = stg["name"] + "/" + it["name"]
            if key in gone or (it.get("mtime") or 0) < START_MS or st.setdefault("proj", {}).get(key):
                continue
            tg = _targets(key)
            if not tg:
                continue
            for rel in tg:
                if rel not in st["broll"]:
                    _start(sheet, st, rel, stg["name"], it["name"] + ("" if rel == key else " · " + rel.split("/")[-1]), key)
            st["proj"][key] = len(tg)


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
                                     "project": "/".join(parts[:2]), "type": ftype(rel),
                                     "status": "precut", "msg": "Pre-cut dari B-Roll Picker"})
        log.info("B-roll dari Picker masuk Studio: %s", rel)


def _start(sheet, st, key, stage, name, project=None):
    try:
        jid = br("/api/scan", {"path": key})["id"]
    except Exception as e:
        log.info("Pre-cut %s tak boleh: %s", key, e)
        st["broll"][key] = {"skip": str(e)[:120]}
        return False
    s = slug(key)
    st["broll"][key] = {"slug": s, "job": jid, "status": "precut"}
    _merge(sheet, "broll/" + s, {"key": key, "name": name, "stage": stage, "job": jid, "status": "precut", "msg": "Sedang pre-cut",
                                 "project": project or key, "type": ftype(key)})
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
                _merge(sheet, "broll/" + r["slug"], {"status": "ready", "moments": len(moms), "thumbs": thumbs, "msg": "",
                                                     "type": d["meta"].get("type") or ftype(key), "aroll": js.get("aroll", 0),
                                                     "arollVideos": len(js.get("aroll_videos") or []),
                                                     "closeups": js.get("closeups", 0), "pub": 0})
                _publish_bg(sheet, up, key, r)
            elif js.get("status") == "error":
                r["status"] = "error"
                _merge(sheet, "broll/" + r["slug"], {"status": "error", "msg": str(js.get("msg"))[:160]})
            else:
                _merge(sheet, "broll/" + r["slug"], {"progress": js.get("progress", 0), "msg": js.get("msg", "")[:80]})
        else:
            if not r.get("pubDone"):
                _publish_bg(sheet, up, key, r)
            _sync_dec(sheet, r)
            sp = os.path.join(BR_DATA, "cache", r["job"], "state.json")
            stt = json.load(open(sp)) if os.path.exists(sp) else {"dec": {}}
            dec = stt.get("dec", {})
            kept = sum(1 for v in dec.values() if v.get("action") == "keep")
            pdec = {k: ("k" if v.get("action") == "keep" else "s") for k, v in dec.items()}
            sig = str(sorted(pdec.items()))
            if kept != r.get("kept") or len(dec) != r.get("seen") or sig != r.get("psig"):
                r["kept"], r["seen"], r["psig"] = kept, len(dec), sig
                _merge(sheet, "broll/" + r["slug"], {"kept": kept, "seen": len(dec), "pdec": pdec})
            _aroll_step(r)


# ---------------------------------------------------------------- swipe dalam Studio
def _publish_bg(sheet, up, key, r):
    if ("pub", key) in _busy:
        return
    _busy.add(("pub", key))
    threading.Thread(target=_publish, args=(sheet, up, key, r), daemon=True).start()


def _publish(sheet, up, key, r):
    """Preview kecil setiap moment ke Drive (gambar 4 frame + video 360p) dan senarai moment ke doc brm/<slug>-<n>,
    supaya Mira boleh swipe dalam Studio di mana-mana (tanpa Wi-Fi rumah). Kod biasa, tiada token."""
    try:
        d = br("/api/moments?id=" + r["job"], timeout=60)
        moms = [m for m in d["meta"].get("moments", []) if not m.get("junk") and not m.get("aroll")][:240]
        cache = os.path.join(BR_DATA, "cache", r["job"], "m")
        pid = sheet.call("dpath", base="studio", path=["FOOTAGE", "PREVIEW", "B-ROLL", r["slug"], "swipe"], share=True)["id"]
        done = dict(r.get("pubIds") or {})
        rows = []
        with tempfile.TemporaryDirectory(prefix="brp-") as tmp:
            for i, m in enumerate(moms):
                mid = m["id"]
                if mid not in done:
                    src = os.path.join(cache, mid + ".mp4")
                    if not os.path.exists(src):
                        continue
                    sp, pv = os.path.join(tmp, mid + "_s.jpg"), os.path.join(tmp, mid + "_v.mp4")
                    ln = max(0.5, float(m["end"]) - float(m["start"]))
                    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src, "-vf",
                                    f"fps={4 / ln:.4f},scale=-2:200,tile=4x1", "-frames:v", "1", "-q:v", "6", sp], timeout=60)
                    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src, "-vf", "scale='if(gt(iw,ih),-2,360)':'if(gt(iw,ih),360,-2)'",
                                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p", "-an",
                                    "-movflags", "+faststart", pv], timeout=120)
                    done[mid] = [_upload(sheet, up, sp, pid) if os.path.exists(sp) else None,
                                 _upload(sheet, up, pv, pid) if os.path.exists(pv) else None]
                    if i % 10 == 9:
                        r["pubIds"] = done
                        _merge(sheet, "broll/" + r["slug"], {"pub": len(done), "msg": f"Sediakan swipe dalam Studio {len(done)}/{len(moms)}"})
                sid, vid = done.get(mid) or [None, None]
                rows.append([mid, m.get("video", ""), round(float(m["start"]), 2), round(float(m["end"]) - float(m["start"]), 1),
                             m.get("kind", "broll"), m.get("badge", ""), sid, vid,
                             None if m.get("p") is None else round(m["p"], 2)])
        r["pubIds"] = done
        n = 0
        for n, i in enumerate(range(0, max(1, len(rows)), 120)):
            sheet.call("dset", path=f"brm/{r['slug']}-{n}", data={"key": key, "slug": r["slug"], "job": r["job"], "part": n,
                                                               "type": d["meta"].get("type"), "m": rows[i:i + 120],
                                                               "updated": int(time.time() * 1000)})
        r["pubDone"] = True
        _merge(sheet, "broll/" + r["slug"], {"pub": len(rows), "pubParts": n + 1, "msg": ""})
        with _lock:
            st = _st(); x = st["broll"].get(key)
            if x:
                x.update(pubIds=done, pubDone=True); _save_st(st)
        log.info("Swipe Studio sedia: %s (%d moment)", key, len(rows))
    except Exception as e:
        log.exception("Preview swipe gagal %s", key)
        try:
            _merge(sheet, "broll/" + r["slug"], {"msg": "Preview swipe gagal: " + str(e)[:100]})
        except Exception:
            pass
    finally:
        _busy.discard(("pub", key))


def _sync_dec(sheet, r):
    """Keputusan swipe dari Studio (doc brd/<slug>) -> B-Roll Picker. Undo dalam Studio = buang keputusan."""
    try:
        doc = sheet.call("dget", path="brd/" + r["slug"]).get("doc") or {}
    except Exception:
        return
    want = doc.get("d") or {}
    got = r.setdefault("applied", {})
    for mid, v in want.items():
        a = "keep" if (v or {}).get("a") == "k" else "skip"
        lab = [str(x)[:30] for x in ((v or {}).get("l") or [])][:6]
        sig = a + "|" + ",".join(lab)
        if got.get(mid) == sig:
            continue
        try:
            br("/api/decide", {"id": r["job"], "mid": mid, "action": a, "labels": lab})
            got[mid] = sig
        except Exception as e:
            log.info("Keputusan Studio tak dapat dipakai %s: %s", mid, e)
    for mid in [m for m in got if m not in want]:
        try:
            br("/api/clear", {"id": r["job"], "mid": mid})
        except Exception:
            pass
        got.pop(mid, None)


def _aroll_step(r):
    """Folder produk: transkrip video bercakap (A-roll), satu video setiap pusingan, ke cache/<job>/aroll.json.
    Edit-reel guna fail ni untuk suara dan padan B-roll ikut ayat (tak perlu transkrip semula)."""
    jd = os.path.join(BR_DATA, "cache", r["job"])
    try:
        meta = json.load(open(os.path.join(jd, "moments.json")))
    except Exception:
        return
    vids = meta.get("aroll_videos") or []
    if meta.get("type") != "product" or not vids:
        return
    out_p = os.path.join(jd, "aroll.json")
    out = json.load(open(out_p)) if os.path.exists(out_p) else {}
    todo = [v for v in vids if v not in out]
    if not todo:
        return
    try:
        import __main__ as W
        src = os.path.join(BASE, meta["rel"], todo[0])
        with tempfile.TemporaryDirectory(prefix="ar-") as tmp:
            wav = W.to_wav(src, tmp)
            lang, segs = W.transcribe(wav, W.load_cfg())
        out[todo[0]] = {"lang": lang, "segs": [[round(a, 2), round(b, 2), t] for a, b, t in segs]}
        with open(out_p + ".tmp", "w") as fh:
            json.dump(out, fh, ensure_ascii=False)
        os.replace(out_p + ".tmp", out_p)
        log.info("Transkrip A-roll %s/%s siap", meta["rel"], todo[0])
    except Exception as e:
        log.info("Transkrip A-roll gagal %s: %s", todo[0], e)
        out[todo[0]] = {"error": str(e)[:200]}
        with open(out_p, "w") as fh:
            json.dump(out, fh, ensure_ascii=False)


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
    proj = "/".join(key.split("/")[:2])
    with _lock:
        st = _st()
    tg = _targets(key) if key == proj else [key]
    if key == proj and len(tg) > 1:           # projek: hanya subfolder yang belum (yang dah siap tak diusik)
        tg = [t for t in tg if t not in st["broll"] or st["broll"][t].get("skip")]
    if not tg:
        raise RuntimeError("Semua folder dalam projek ni dah di-pre-cut")
    with _lock:
        st = _st()
        ok = False
        for rel in tg:
            st["broll"].pop(rel, None)
            nm = name if rel == key else name + " · " + rel.split("/")[-1]
            ok = _start(sheet, st, rel, stage, nm, proj) or ok
        st.setdefault("proj", {})[proj] = len(tg)
        _save_st(st)
    if not ok:
        raise RuntimeError(st["broll"].get(tg[0], {}).get("skip") or "Tak dapat pre-cut")
    return {"ok": True, "folders": len(tg)}


def job_broll_start_main(inp, sheet, up):
    """Butang Pre-cut satu folder utama (cth 21. EDIT SHOP): semua projek dan subfolder yang belum."""
    stage = str(inp.get("stage") or "")
    if not br_up():
        raise RuntimeError("B-Roll Picker tak jalan dalam Mac mini")
    te = sheet.call("dget", path="sync/toedit").get("doc") or {}
    items = next((s.get("items") or [] for s in te.get("stages") or [] if s["name"] == stage), [])
    n = 0
    with _lock:
        st = _st()
        for it in items:
            key = stage + "/" + it["name"]
            for rel in _targets(key):
                if rel in st["broll"] and not st["broll"][rel].get("skip"):
                    continue
                st["broll"].pop(rel, None)
                if _start(sheet, st, rel, stage, it["name"] + ("" if rel == key else " · " + rel.split("/")[-1]), key):
                    n += 1
        _save_st(st)
    if not n:
        raise RuntimeError("Semua folder dalam " + stage + " dah di-pre-cut")
    return {"ok": True, "folders": n}


def _write_targets(sheet, st):
    """Senarai subfolder setiap projek (untuk kad projek dalam Studio) ke sync/brfolders bila berubah."""
    te = sheet.call("dget", path="sync/toedit").get("doc") or {}
    out = {}
    for stg in te.get("stages") or []:
        for it in stg.get("items") or []:
            key = stg["name"] + "/" + it["name"]
            tg = _targets(key)
            if tg:
                out[key] = [[t, "" if t == key else t.split("/")[-1]] for t in tg]
    sig = json.dumps(out, sort_keys=True)
    if sig != st.get("tgsig"):
        sheet.call("dset", path="sync/brfolders", data={"p": out, "updated": int(time.time() * 1000)})
        st["tgsig"] = sig


def job_broll_done(inp, sheet, up):
    key = inp.get("key")
    with _lock:
        st = _st()
        r = st["broll"].get(key)
    if not r or not r.get("job"):
        raise RuntimeError("Projek B-roll tak dijumpai: " + str(key))
    _sync_dec(sheet, r)                      # swipe terakhir dalam Studio masuk dulu sebelum simpan
    with _lock:
        st = _st(); st["broll"].setdefault(key, r)["applied"] = r.get("applied", {}); _save_st(st)
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
        msg = str(s.get("msg") or "")
        if msg.startswith("Error"):              # Picker could not cut the clips: say so, don't report 0 clips as done
            raise RuntimeError(msg.replace("\n", " ")[:100])
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
        if not clips:
            raise RuntimeError("Tiada klip Final keluar dari Picker")
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
