#!/usr/bin/env python3
"""Footage dari folder lain untuk Editor PWA Studio (Mira 2026-11-23). 0 token Claude, dijalankan oleh worker.py (job ed_foot).

mode "list": {vid, path}  -> senarai subfolder + video dalam <folder utama>/<path> (gambar kecil satu jalur, dimuat naik ke Drive,
             ditambah ke manifest edpwa/<vid> sebagai foot/<slug>.jpg). Status dalam doc edfoot/<vid>.
mode "add":  {vid, base, files[]} -> setiap video dipotong (maks 15 s) dan DISAMBUNG di hujung proxy.mp4 bahagian tu (pStart klip lama
             tak berubah, jadi edit tersimpan kekal betul), strip.jpg dibina semula, klip baru masuk data.json bin, kemudian edpwa.py
             muat naik fail yang berubah. Editor muat semula dan klip baru keluar dalam ⇄ Tukar / Klip simpanan.
Folder dibenarkan: dalam folder utama projek (cth 29. VLOG BATCH) sahaja.
"""
import json, os, re, shutil, subprocess, sys, tempfile, threading, time

ROOT = os.path.expanduser("~/Desktop/WORK 2026/CLAUDE EDITS")
TPL = os.path.expanduser("~/.claude/assets/reel-page-template")
EXT = (".mp4", ".mov", ".m4v")
SKIPD = {"build", "editor", "page", "render", "renders", "draft", "__pycache__"}
MAXSEG = 15.0


def _main_of(d):
    rel = os.path.relpath(d, ROOT)
    if rel.startswith(".."):
        raise RuntimeError("Folder editor bukan dalam CLAUDE EDITS")
    return os.path.join(ROOT, rel.split(os.sep)[0])


def _inside(base, p):
    rb, rp = os.path.realpath(base), os.path.realpath(p)
    return rp == rb or rp.startswith(rb + os.sep)


def _put(sh, vid, **kw):
    kw["at"] = int(time.time() * 1000)
    sh.call("dset", path="edfoot/" + vid, data=kw)


def run(inp, sheet, cfg, W):
    vid = re.sub(r"[^a-z0-9-]", "", str(inp.get("vid") or ""))
    doc = sheet.call("dget", path="edpwa/" + vid).get("doc") or {}
    if not doc.get("dir") or not os.path.isdir(doc["dir"]):
        raise RuntimeError("Folder editor tak dijumpai dalam Mac mini")
    mode = inp.get("mode") or "list"
    _put(sheet, vid, mode=mode, status="proses", path=str(inp.get("path") or ""))
    t = threading.Thread(target=_safe, args=(_list if mode == "list" else _add, inp, sheet, cfg, W, vid, doc), daemon=True)
    t.start()
    return {"vid": vid, "mode": mode}


def _safe(fn, inp, sheet, cfg, W, vid, doc):
    try:
        fn(inp, sheet, cfg, W, vid, doc)
    except Exception as e:
        W.log.warning("ed_foot gagal (%s): %s", vid, e)
        try:
            _put(sheet, vid, mode=inp.get("mode") or "list", status="error", msg=str(e)[:300], path=str(inp.get("path") or ""))
        except Exception:
            pass


def _dur(W, p):
    ffprobe = W.find_tool("ffprobe") or "ffprobe"
    r = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", p], capture_output=True, text=True, timeout=60)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def _list(inp, sheet, cfg, W, vid, doc):
    main = _main_of(doc["dir"])
    rel = str(inp.get("path") or "").strip("/")
    here = os.path.join(main, rel) if rel else main
    if not _inside(main, here) or not os.path.isdir(here):
        raise RuntimeError("Folder tak dijumpai")
    dirs, vids = [], []
    for n in sorted(os.listdir(here), key=str.lower):
        p = os.path.join(here, n)
        if n.startswith("."):
            continue
        if os.path.isdir(p) and n not in SKIPD:
            dirs.append(n)
        elif n.lower().endswith(EXT):
            vids.append(n)
    vids = vids[:40]
    ffmpeg = W.find_tool("ffmpeg") or "ffmpeg"
    items, sheet_path = [], ""
    if vids:
        tmp = tempfile.mkdtemp(prefix="edfoot-")
        try:
            k = 0
            for n in vids:
                p = os.path.join(here, n)
                d = _dur(W, p)
                if d < 0.4:
                    continue
                k += 1
                subprocess.run([ffmpeg, "-v", "error", "-y", "-ss", str(min(1.0, d / 2)), "-i", p, "-frames:v", "1",
                                "-vf", "scale=90:160:force_original_aspect_ratio=increase,crop=90:160", "-q:v", "5", os.path.join(tmp, "t%04d.jpg" % k)], timeout=120)
                if not os.path.exists(os.path.join(tmp, "t%04d.jpg" % k)):
                    subprocess.run([ffmpeg, "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=gray:s=90x160", "-frames:v", "1", os.path.join(tmp, "t%04d.jpg" % k)], timeout=60)
                items.append({"f": os.path.join(rel, n) if rel else n, "name": n, "d": round(d, 1)})
            if items:
                cols = 6
                rows = (len(items) + cols - 1) // cols
                out = os.path.join(tmp, "sheet.jpg")
                subprocess.run([ffmpeg, "-v", "error", "-y", "-framerate", "1", "-i", os.path.join(tmp, "t%04d.jpg"), "-vf", f"tile={cols}x{rows}", "-frames:v", "1", "-q:v", "5", out], timeout=120, check=True)
                slug = re.sub(r"[^a-z0-9]+", "-", rel.lower()).strip("-")[:50] or "utama"
                sheet_path = f"foot/{slug}-{int(time.time())}.jpg"
                pid = sheet.call("dpath", base="studio", path=["EDITOR PWA", vid])["id"]
                fid = W.drive_upload(sheet, out, pid, sheet_path.replace("/", "__"))
                cur = sheet.call("dget", path="edpwa/" + vid).get("doc") or doc
                cur.setdefault("files", {})
                for key in [x for x in cur["files"] if x.startswith("foot/")]:   # satu jalur gambar sahaja dalam manifest
                    del cur["files"][key]
                cur["files"][sheet_path] = fid
                sheet.call("dset", path="edpwa/" + vid, data=cur)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    _put(sheet, vid, mode="list", status="sedia", path=rel, main=os.path.basename(main), dirs=dirs, items=items, sheet=sheet_path, cols=6)


def _add(inp, sheet, cfg, W, vid, doc):
    sys.path.insert(0, TPL)
    import make_page as M
    main = _main_of(doc["dir"])
    base = str(inp.get("base") or "").strip("/")
    pdir = os.path.join(doc["dir"], base) if base else doc["dir"]
    if not _inside(doc["dir"], pdir) or not os.path.isfile(os.path.join(pdir, "data.json")):
        raise RuntimeError("data.json bahagian ni tak dijumpai")
    files = [str(f) for f in (inp.get("files") or [])][:12]
    srcs = []
    for f in files:
        p = os.path.join(main, f)
        if not _inside(main, p) or not os.path.isfile(p):
            raise RuntimeError("Fail tak dijumpai: " + f)
        srcs.append(os.path.realpath(p))
    if not srcs:
        raise RuntimeError("Tiada video dipilih")
    full = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"   # ada zscale untuk tonemap video HDR iPhone (sama dengan make_page)
    ffmpeg = full if os.path.exists(full) else (W.find_tool("ffmpeg") or "ffmpeg")
    proxy = os.path.join(pdir, "proxy.mp4")
    data = json.load(open(os.path.join(pdir, "data.json")))
    t0 = _vdur(W, proxy)
    tmp = tempfile.mkdtemp(prefix="edfoot-")
    try:
        args, fc = [ffmpeg, "-v", "error", "-y", "-i", proxy], []
        fc.append(f"[0:v]trim=duration={t0:.3f},setpts=PTS-STARTPTS,fps=24,format=yuv420p[v0]")
        fc.append(f"[0:a]aresample=48000,apad,atrim=duration={t0:.3f},asetpts=PTS-STARTPTS[a0]")
        new, t = [], t0
        for i, p in enumerate(srcs, 1):
            d = min(MAXSEG, M.duration(Path(p)))
            if d < 0.4:
                continue
            args += ["-t", f"{d:.3f}", "-i", p]
            k = len(new) + 1
            tm = M.TM if M.is_hlg(Path(p)) else ""
            fc.append(f"[{k}:v]scale={M.W}:{M.H}:force_original_aspect_ratio=increase,crop={M.W}:{M.H},{tm}fps=24,setsar=1,trim=duration={d:.3f},setpts=PTS-STARTPTS,format=yuv420p[v{k}]")
            if M.has_audio(Path(p)):
                fc.append(f"[{k}:a]aresample=48000,apad,atrim=duration={d:.3f},asetpts=PTS-STARTPTS[a{k}]")
            else:
                fc.append(f"anullsrc=r=48000:cl=mono,atrim=duration={d:.3f}[a{k}]")
            stem = os.path.splitext(os.path.basename(p))[0]
            folder = os.path.basename(os.path.dirname(p))
            n0 = len([c for c in data.get("bin", []) if str(c.get("id", "")).startswith("f")])
            new.append({"id": f"f{n0 + len(new) + 1}t{int(time.time()) % 100000}", "name": f"{folder[:12]} · {stem[-12:]}", "file": p, "srcMin": 0, "srcMax": round(d, 3),
                        "pStart": round(t, 3), "in": 0, "out": round(min(d, 6.0), 3), "muted": False})
            t += d
        if not new:
            raise RuntimeError("Video dipilih tak dapat dibaca")
        n = len(new) + 1
        fc.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[v][a]")
        outp = os.path.join(tmp, "proxy.mp4")
        args += ["-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "baseline", "-crf", "30",
                 "-g", "12", "-c:a", "aac", "-b:a", "48k", "-ac", "1", "-movflags", "+faststart", outp]
        r = subprocess.run(args, capture_output=True, text=True, timeout=3600)
        if r.returncode != 0 or not os.path.isfile(outp):
            raise RuntimeError("proxy: " + (r.stderr or "")[-200:])
        strip_n = int(M.duration(Path(outp))) + 1
        strip = os.path.join(tmp, "strip.jpg")
        subprocess.run([ffmpeg, "-v", "error", "-y", "-i", outp, "-vf", f"fps=4,scale=48:85,tile=40x{-(-strip_n * 4 // 40)}", "-frames:v", "1", "-q:v", "6", strip], check=True, timeout=600)
        shutil.copy(proxy, os.path.join(tmp, "proxy.old.mp4"))   # salinan keselamatan sampai semua siap
        shutil.move(outp, proxy)
        shutil.move(strip, os.path.join(pdir, "strip.jpg"))
        data["bin"] = (data.get("bin") or []) + new
        data["stripN"] = strip_n; data["stripFps"] = 4; data["stripCols"] = 40   # 25 Nov: jalur gambar 4 sesaat dalam grid, sama dengan make_page.py
        json.dump(data, open(os.path.join(pdir, "data.json"), "w"), ensure_ascii=False)
        r = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "edpwa.py"), doc["dir"]] + (["--project", doc["project"]] if doc.get("project") else []),
                           capture_output=True, text=True, timeout=3600)
        if r.returncode != 0:
            raise RuntimeError("upload: " + (r.stderr or r.stdout)[-200:])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    _put(sheet, vid, mode="add", status="sedia", added=[c["name"] for c in new], ids=[c["id"] for c in new])


def _vdur(W, p):
    ffprobe = W.find_tool("ffprobe") or "ffprobe"
    r = subprocess.run([ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "default=nw=1:nk=1", p], capture_output=True, text=True, timeout=60)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return _dur(W, p)


from pathlib import Path  # noqa: E402  (make_page fungsi terima Path)
