#!/usr/bin/env python3
"""Job `carousel` (Studio > Lagi > Carousel). 0 token.

Mira upload gambar dalam Studio (fail masuk Drive "Miracikcit Studio Files"), pilih setting, tekan Generate.
Mac mini:
  1. muat turun gambar (file_get), simpan dalam carousel_cache/files supaya Shuffle tak muat turun semula
  2. jalankan carousel_engine.py dalam venv sendiri (carousel_env, pasang dengan carousel_setup.sh)
  3. upload slide + preview ke Drive "Miracikcit Studio Files/CAROUSEL/<tarikh> <tajuk>" (folder dikongsi
     dengan link, supaya gambar boleh dipapar dalam Studio)
  4. tulis hasil ke doc `carousel/<id>`: status run -> done / error, pct, msg, out {slides, preview, thumb,
     folder, recipe, warnings}, old [versi sebelum ni, maks 3]

Input job: {id, title, photos:[{id:"fid~i", name, star}], opts:{..}, seed, avoid:[[tpl..]..], lock:[i..], recipe}
"""
import base64, json, os, shutil, subprocess, tempfile, time

HOME = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HOME, "carousel_cache")
ENGINE = os.path.join(HOME, "carousel_engine.py")
KEEP_OLD = 3


def _python(cfg):
    for c in (cfg.get("carousel_python"), os.path.join(HOME, "carousel_env", "bin", "python")):
        if c and os.path.isfile(c):
            return c
    raise RuntimeError("Carousel belum dipasang di Mac mini. Jalankan: bash ~/MiracikcitTranscribe/carousel_setup.sh")


class Doc:
    """Kemas kini doc carousel/<id> (gabung dengan apa yang phone dah tulis)."""

    def __init__(self, sheet, cid):
        self.sheet, self.path, self.last, self.seen = sheet, "carousel/" + cid, 0, False

    def set(self, force=True, **fields):
        now = time.time()
        if not force and now - self.last < 6:
            return
        self.last = now
        try:
            cur = self.sheet.call("dget", path=self.path).get("doc")
        except Exception:
            cur = {}
        if cur is None and self.seen:   # Mira padam carousel semasa Mac mini bekerja
            raise RuntimeError("Carousel dah dipadam")
        cur = cur or {}
        self.seen = True
        cur.update(fields)
        cur["updated"] = int(now * 1000)
        self.sheet.call("dset", path=self.path, data=cur)
        return cur


def _purge_cache():
    d = os.path.join(CACHE, "files")
    if not os.path.isdir(d):
        return
    cut = time.time() - 30 * 86400
    for f in os.listdir(d):
        p = os.path.join(d, f)
        try:
            if os.path.getatime(p) < cut:
                os.remove(p)
        except OSError:
            pass


def _fetch(sheet, fid):
    """Gambar dari Drive (cache ikut id fail)."""
    raw = str(fid).split("~")[0]
    d = os.path.join(CACHE, "files")
    os.makedirs(d, exist_ok=True)
    for ext in (".jpg", ".png", ".webp", ".heic", ".jpeg"):
        p = os.path.join(d, raw + ext)
        if os.path.exists(p):
            os.utime(p)
            return p
    f = sheet.call("file_get", id=raw)
    ext = os.path.splitext(f.get("name") or "")[1].lower() or ".jpg"
    p = os.path.join(d, raw + ext)
    with open(p, "wb") as fh:
        fh.write(base64.b64decode(f["b64"]))
    return p


def run(inp, sheet, cfg, W):
    cid = str(inp.get("id") or "").strip()
    if not cid:
        raise RuntimeError("id carousel tiada")
    doc = Doc(sheet, cid)
    doc.set(status="run", pct=2, msg="Mac mini mula", err="")
    tmp = tempfile.mkdtemp(prefix="carousel-")
    try:
        py = _python(cfg)
        _purge_cache()
        photos = inp.get("photos") or []
        if not photos:
            raise RuntimeError("Tiada gambar")
        plist = []
        for i, p in enumerate(photos):
            doc.set(force=False, pct=2 + int(10 * i / len(photos)), msg=f"Ambil gambar {i + 1}/{len(photos)}")
            path = p.get("path") if p.get("path") and os.path.exists(p.get("path")) else _fetch(sheet, p["id"])
            plist.append({"path": path, "name": p.get("name") or p.get("id") or os.path.basename(path), "star": bool(p.get("star"))})
        out = os.path.join(tmp, "out")
        job = {"photos": plist, "out": out, "cache": os.path.join(CACHE, "analysis"), "opts": inp.get("opts") or {},
               "seed": inp.get("seed"), "avoid": inp.get("avoid") or [], "lock": inp.get("lock") or [],
               "recipe": inp.get("recipe") or {}}
        jp = os.path.join(tmp, "job.json")
        with open(jp, "w") as fh:
            json.dump(job, fh)
        proc = subprocess.Popen([py, ENGINE, "--job", jp], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                text=True, cwd=tmp)
        t0 = time.time()
        for line in proc.stdout:
            if line.startswith("PROG "):
                parts = line.strip().split(" ", 2)
                try:
                    pct = 12 + int(int(parts[1]) * 0.7)
                except ValueError:
                    continue
                doc.set(force=False, pct=pct, msg=parts[2] if len(parts) > 2 else "")
            if time.time() - t0 > 1500:
                proc.kill()
                raise RuntimeError("Enjin carousel terlalu lama (25 minit)")
        err = proc.stderr.read()
        proc.wait()
        rp = os.path.join(out, "result.json")
        if proc.returncode != 0 or not os.path.exists(rp):
            tail = [l for l in err.strip().splitlines() if l.strip()][-3:]
            raise RuntimeError("Enjin gagal: " + " | ".join(tail)[-300:])
        res = json.load(open(rp))
        title = (inp.get("title") or cid).strip()[:60]
        safe = "".join(ch if ch.isalnum() or ch in " -_" else " " for ch in title).strip() or cid
        folder = sheet.call("dpath", base="studio", path=["CAROUSEL", time.strftime("%Y-%m-%d ") + safe], share=True)["id"]
        stamp = time.strftime("%H%M%S")

        def up(path, name):
            return W.drive_upload(sheet, path, folder, name) + "~i"

        if (inp.get("opts") or {}).get("mode") == "enhance":
            files = res.get("photos") or []
            ids = []
            for i, pth in enumerate(files):
                doc.set(force=False, pct=84 + int(15 * i / max(1, len(files))), msg=f"Upload {i + 1}/{len(files)}")
                base = os.path.splitext(photos[i].get("name") or f"gambar_{i + 1}")[0]
                ids.append(up(pth, f"{base}_enhance_{stamp}.jpg"))
            new = {"photos": ids, "folder": folder, "warnings": res.get("warnings") or [], "at": int(time.time() * 1000)}
        else:
            files = res.get("slides") or []
            ids = []
            for i, pth in enumerate(files):
                doc.set(force=False, pct=84 + int(13 * i / max(1, len(files))), msg=f"Upload slide {i + 1}/{len(files)}")
                ids.append(up(pth, f"slide_{i + 1:02d}_{stamp}.jpg"))
            new = {"slides": ids, "preview": up(res["preview"], f"preview_{stamp}.jpg"),
                   "thumb": up(res["thumb"], f"thumb_{stamp}.jpg"), "folder": folder, "recipe": res.get("recipe"),
                   "warnings": res.get("warnings") or [], "at": int(time.time() * 1000)}
        cur = sheet.call("dget", path=doc.path).get("doc") or {}
        old = ([cur["out"]] if cur.get("out") else []) + (cur.get("old") or [])
        for o in old[KEEP_OLD:]:   # buang versi lama dari Drive (simpan 3 terakhir sahaja)
            for fid in (o.get("slides") or []) + (o.get("photos") or []) + [o.get("preview"), o.get("thumb")]:
                if fid:
                    try:
                        sheet.call("dtrash", id=str(fid).split("~")[0])
                    except Exception:
                        pass
        doc.set(status="done", pct=100, msg="Siap", out=new, old=old[:KEEP_OLD], err="")
        if res.get("kits"):   # Studio tunjuk templat yang ada dalam Mac mini
            try:
                cur_k = sheet.call("dget", path="sync/kits").get("doc") or {}
                if cur_k.get("kits") != res["kits"]:
                    sheet.call("dset", path="sync/kits", data={"kits": res["kits"], "at": int(time.time() * 1000)})
            except Exception:
                pass
        return {"ok": True, "n": len(ids)}
    except Exception as e:
        try:
            doc.set(status="error", msg="", err=str(e)[:300])
        except Exception:
            pass
        raise
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


TPL_PROMPT = """Mira minta templat Design baru (Kit Gaya) dari rujukan yang dia suka. Semua fail dalam folder {req}:
ref_*.jpg (rujukan) dan REQUEST.md (nota Mira). Kerja dalam folder ni ({home}).

1. Tengok SEMUA rujukan. Tulis ringkas rupa yang sama antara mereka: font, susunan, warna, cutout, hiasan, tulisan.
2. Tambah satu kit baru dalam design_kits.py ikut corak kit sedia ada ({kits}): masukkan dalam KITS (id pendek huruf kecil,
   nama Bahasa Melayu), sokong format carousel, single dan cover (cover: tajuk dan muka dalam kawasan selamat 285..1635).
   Guna font dalam fonts/ (boleh tambah font Google Fonts OFL ke fonts/ berserta fail lesen). Jangan guna gambar dari internet.
   Jangan ubah rupa kit lain.
3. Uji: pilih 3 hingga 5 gambar orang dalam carousel_cache/files, tulis job.json dan jalankan
   carousel_env/bin/python carousel_engine.py --job job.json (opts.kit = id baru, cuba carousel, single dan cover, dengan
   dan tanpa tajuk). Buka setiap hasil dan semak sendiri: kemas, tiada muka atas garis potong, tulisan tak bertindih
   muka. Betulkan sampai cantik dan dekat dengan rujukan.
4. Bila siap: python3 studio.py merge kitreq/{rid} '{{"status":"siap","kit":"<id baru>"}}'
   dan kemas kini senarai kit: python3 studio.py put sync/kits '<JSON {{"kits":[{{"id","name","formats"}}...]}} semua kit>'.
5. Kalau ada clone repo miracikcit-studio dalam Mac ni, salin design_kits.py dan font baru ke mac-mini/ dan commit
   di branch baru (jangan push ke main). Beritahu Mira ringkas apa yang dibuat dalam Bahasa Melayu."""


def run_tpl_req(inp, sheet, cfg, W):
    """Job tpl_req (Rujukan > Minta jadi templat): muat turun rujukan, buka sesi Claude Code yang tambah Kit Gaya baru."""
    rid = str(inp.get("id") or "").strip()
    refs = inp.get("refs") or []
    if not rid or not refs:
        raise RuntimeError("Tiada rujukan")
    req = os.path.join(HOME, "kit-requests", rid)
    os.makedirs(req, exist_ok=True)
    for i, fid in enumerate(refs[:8], 1):
        src = _fetch(sheet, fid)
        shutil.copy(src, os.path.join(req, f"ref_{i}" + os.path.splitext(src)[1]))
    with open(os.path.join(req, "REQUEST.md"), "w", encoding="utf-8") as fh:
        fh.write(f"# Permintaan templat {rid}\n\nNota Mira: {inp.get('note') or '(tiada)'}\n\nKit sedia ada: {', '.join(inp.get('kits') or [])}\n")
    prompt = TPL_PROMPT.format(req=req, home=HOME, kits=", ".join(inp.get("kits") or ["doodle", "comel", "majalah"]), rid=rid)
    W.open_claude_session(HOME, "Templat baru " + rid[-5:], prompt, "kit-" + rid, cfg)
    cur = sheet.call("dget", path="kitreq/" + rid).get("doc") or {}
    cur.update({"status": "dibuat", "updated": int(time.time() * 1000)})
    sheet.call("dset", path="kitreq/" + rid, data=cur)
    return {"ok": True, "folder": req}


def run_ed_cover(inp, sheet, cfg, W):
    """Job ed_cover (Studio > Editor > Cover): ambil 10 frame dari video projek Editor, enjin pilih frame dengan
    muka paling jelas, jana cover reel 9:16 ikut Kit Gaya. Hasil dalam doc carousel/<id> (tab Design)."""
    ed = str(inp.get("ed") or "").strip()
    cid = str(inp.get("id") or "").strip()
    doc = Doc(sheet, cid)
    doc.set(status="run", pct=2, msg="Cari video projek", err="")
    tmp = tempfile.mkdtemp(prefix="edcover-")
    try:
        e = sheet.call("dget", path="edpwa/" + ed).get("doc") or {}
        vid = None
        d = e.get("dir") or ""
        for name in ("proxy.mp4", "final.mp4", "draft.mp4"):
            if d and os.path.exists(os.path.join(d, name)):
                vid = os.path.join(d, name)
                break
        if not vid and d and os.path.isdir(d):
            mp4 = sorted(f for f in os.listdir(d) if f.lower().endswith((".mp4", ".mov")))
            vid = os.path.join(d, mp4[0]) if mp4 else None
        if not vid:
            fid = (e.get("files") or {}).get("proxy.mp4")
            if not fid:
                raise RuntimeError("Video projek tak dijumpai")
            f = sheet.call("file_get", id=fid)
            vid = os.path.join(tmp, "proxy.mp4")
            with open(vid, "wb") as fh:
                fh.write(base64.b64decode(f["b64"]))
        ff = W.find_tool("ffmpeg") or "ffmpeg"
        fp = W.find_tool("ffprobe") or "ffprobe"
        try:
            dur = float(subprocess.run([fp, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", vid],
                                       capture_output=True, text=True, timeout=60).stdout.strip() or 0)
        except Exception:
            dur = 0
        doc.set(pct=6, msg="Ambil frame dari video")
        frames = []
        for k in range(10):
            t = max(0.3, dur * (0.06 + 0.88 * k / 9)) if dur else 0.5 + k
            o = os.path.join(tmp, f"frame_{k:02d}.jpg")
            subprocess.run([ff, "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", vid, "-frames:v", "1", "-q:v", "2", o], timeout=120)
            if os.path.exists(o):
                frames.append({"path": o, "name": f"frame_{k:02d}.jpg"})
        if not frames:
            raise RuntimeError("Tak dapat ambil frame dari video")
        job = {"id": cid, "title": inp.get("title") or e.get("title") or "Cover", "photos": frames,
               "opts": dict(inp.get("opts") or {}, format="cover", slides=1), "seed": inp.get("seed")}
        return run(job, sheet, cfg, W)
    except Exception as ex:
        try:
            doc.set(status="error", msg="", err=str(ex)[:300])
        except Exception:
            pass
        raise
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
