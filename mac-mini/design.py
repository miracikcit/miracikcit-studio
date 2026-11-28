#!/usr/bin/env python3
"""Job `design` (Studio > Design: carousel, single, cover reel, warna). 0 token.
   (Nama modul `design`, bukan `carousel`: carousel.py ialah carousel footage dari Published, doc carousel/<id>.)

Mira upload gambar dalam Studio (fail masuk Drive "Miracikcit Studio Files"), pilih setting, tekan Generate.
Mac mini:
  1. muat turun gambar (file_get), simpan dalam carousel_cache/files supaya Shuffle tak muat turun semula
  2. jalankan carousel_engine.py dalam venv sendiri (carousel_env, pasang dengan carousel_setup.sh)
  3. upload slide + preview ke Drive "Miracikcit Studio Files/DESIGN/<tarikh> <tajuk>" (folder dikongsi
     dengan link, supaya gambar boleh dipapar dalam Studio)
  4. tulis hasil ke doc `design/<id>`: status run -> done / error, pct, msg, out {slides, preview, thumb,
     folder, recipe, warnings}, old [versi sebelum ni, maks 3]

Input job: {id, title, photos:[{id:"fid~i", name, star}], opts:{..}, seed, avoid:[[tpl..]..], lock:[i..], recipe}
"""
import base64, json, os, re, shutil, subprocess, tempfile, time

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
    """Kemas kini doc design/<id> (gabung dengan apa yang phone dah tulis)."""

    def __init__(self, sheet, cid):
        self.sheet, self.path, self.last, self.seen = sheet, "design/" + cid, 0, False

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
        folder = sheet.call("dpath", base="studio", path=["DESIGN", time.strftime("%Y-%m-%d ") + safe], share=True)["id"]
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
   dan kemas kini senarai kit: python3 studio.py put sync/kits '<JSON {{"kits":[{{"id","name","formats","editor"}}...]}} semua kit>'.
   "editor" = preset Style Board Editor untuk kit ni, guna id editor SEDIA ADA sahaja (render_draft.py tak perlu ubah):
   {{"pal":..,"font":..,"capStyle":..,"trans":..,"punch":true/false,"titlePos":"top"/"left","titleOutline":false,"titleFx":..,"capFx":..}}
   pal: brand butter rose terra olive krim putih tanah sage pink lilac bathgarden aerocool kathwi tjean
   font: campur paper luxe italic marker viral retro scriptt bigb pop caslon mont serif gothic h1 h2 h3 h4 caveat
   capStyle: biasa bigbold script hl bigkey underline paper kotak pill karaoke   trans: cut dip flash push paper whip zoomin
   titleFx/capFx: land fade rise slam heavy sling hop drop tumble roll type. Pilih yang paling dekat dengan rupa kit.
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
    muka paling jelas, jana cover reel 9:16 ikut Kit Gaya. Hasil dalam doc design/<id> (tab Design)."""
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


# ---------------------------------------------------------------- Rujukan: Claude label + Rasa Mira
REF_PROMPT = """Kau pembantu design untuk Mira (@miracikcit, content creator Malaysia). Dia dump gambar rujukan design yang dia suka.
Baca SEMUA fail ni dengan tool Read (serentak dalam satu langkah), jangan baca fail lain:
{files}

Untuk setiap fail tentukan:
- kind: "carousel" (post berbilang slide / seamless), "single" (satu gambar), "cover" (cover reel), "reel" (screenshot video reel),
  "ayat" (screenshot tulisan / caption), atau "lain"
- group: label pendek Bahasa Melayu 2 hingga 5 perkataan untuk RUPA dia. Rujukan yang rupanya sama MESTI dapat label yang sama.
  Guna semula label sedia ada kalau sesuai: {groups}
- kit: id kit sedia ada yang paling dekat ({kits}), atau null kalau tiada yang dekat
- elements: 3 hingga 6 ciri ringkas (font, susunan, warna, cutout, hiasan, tulisan)

Kemudian kemas kini RASA MIRA (citarasa keseluruhan dari semua rujukan setakat ni). Rasa semasa:
{rasa}

Balas JSON sahaja:
{{"items":[{{"file":"r1.jpg","kind":"..","group":"..","kit":null,"elements":[".."]}}],
  "rasa":{{"summary":"2 hingga 3 ayat BM","elements":["5 hingga 8 ciri yang selalu ada"],"palette":["#hex 4 hingga 6 warna"],"fonts":["jenis font"]}}}}"""


def _small(src, dst):
    """Kecilkan gambar (sips dalam Mac) supaya token Claude sikit."""
    try:
        r = subprocess.run(["/usr/bin/sips", "-Z", "1024", src, "--out", dst], capture_output=True, timeout=60)
        if r.returncode == 0 and os.path.exists(dst):
            return dst
    except Exception:
        pass
    shutil.copy(src, dst)
    return dst


def run_ref_tag(inp, sheet, cfg, W):
    """Job ref_tag: Claude baca rujukan gambar baru, letak label (jenis, koleksi, kit dekat) dan kemas kini sync/rasa."""
    import gaya
    items = (inp.get("items") or [])[:12]
    if not items:
        return {"ok": True, "n": 0}
    tmp = tempfile.mkdtemp(prefix="reftag-")
    try:
        files, by = [], {}
        for k, it in enumerate(items, 1):
            src = _fetch(sheet, it["asset"])
            dst = _small(src, os.path.join(tmp, f"r{k}.jpg"))
            files.append(dst)
            by[os.path.basename(dst)] = it
        rasa = sheet.call("dget", path="sync/rasa").get("doc") or {}
        groups = ", ".join(inp.get("groups") or []) or "(belum ada)"
        kits = ", ".join(inp.get("kits") or ["doodle", "comel", "majalah"])
        prompt = REF_PROMPT.format(files="\n".join(files), groups=groups, kits=kits,
                                   rasa=json.dumps({k: rasa.get(k) for k in ("summary", "elements", "palette", "fonts")}, ensure_ascii=False))
        c2 = dict(cfg, gaya_model=cfg.get("ref_model", "sonnet"), gaya_effort="low")
        out, usage = gaya._ask(c2, W, tmp, prompt, read=True)
        n = 0
        for r in out.get("items") or []:
            it = by.get(os.path.basename(str(r.get("file") or "")))
            if not it:
                continue
            path = "inspo/" + it["id"]
            cur = sheet.call("dget", path=path).get("doc")
            if cur is None:
                continue
            cur.update({"kind": str(r.get("kind") or "lain")[:20], "group": str(r.get("group") or "")[:60],
                        "kit": r.get("kit") or "", "els": [str(x)[:60] for x in (r.get("elements") or [])][:6],
                        "tagged": int(time.time() * 1000), "updated": int(time.time() * 1000)})
            sheet.call("dset", path=path, data=cur)
            n += 1
        nr = out.get("rasa") or {}
        if nr.get("summary"):
            nr = {k: nr.get(k) for k in ("summary", "elements", "palette", "fonts")}
            nr.update({"at": int(time.time() * 1000), "n": int(rasa.get("n") or 0) + n})
            sheet.call("dset", path="sync/rasa", data=nr)
        return {"ok": True, "n": n, "usage": usage}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------- Sticker PNG Mira (kit Comel)
def run_stk_save(inp, sheet, cfg, W):
    """Job stk_save: sticker PNG dari Studio disimpan dalam stickers/ (dipakai kit Comel). 0 token."""
    d = os.path.join(HOME, "stickers")
    os.makedirs(d, exist_ok=True)
    n = 0
    for fid in inp.get("files") or []:
        f = sheet.call("file_get", id=str(fid).split("~")[0])
        name = re.sub(r"[^A-Za-z0-9._-]+", "_", f.get("name") or (str(fid) + ".png"))
        if not name.lower().endswith(".png"):
            name += ".png"
        with open(os.path.join(d, name), "wb") as fh:
            fh.write(base64.b64decode(f["b64"]))
        n += 1
        try:
            sheet.call("dtrash", id=str(fid).split("~")[0])   # salinan Drive tak perlu lagi
        except Exception:
            pass
    total = len([x for x in os.listdir(d) if x.lower().endswith(".png")])
    sheet.call("dset", path="sync/stickers", data={"n": total, "at": int(time.time() * 1000)})
    return {"ok": True, "n": n, "total": total}


# ---------------------------------------------------------------- Font kit dalam enjin render Editor
FONT_PROMPT = """Mira nak tulisan dalam video Editor guna font Kit Gaya yang sama dengan Design (bukan anggaran).
Font kit ada dalam {home}/fonts (Chewy, Caveat, Fredoka, Playfair Display, DM Sans) dan senarai kit dalam {home}/design_kits.py.

1. Cari sumber enjin Editor dan render: ~/.claude/assets/reel-page-template (src editor + render_draft.py + build_editor.py).
   Kalau tiada, berhenti dan beritahu Mira.
2. Untuk setiap kit (doodle, comel, majalah dan kit lain dalam design_kits.KITS), tambah satu pilihan font baru dalam OPTS.font
   editor DAN dalam render_draft.py dengan id "kit<id kit>" (contoh "kitdoodle"), padan dengan font tajuk / kata kunci / caption kit
   dalam design_kits.py. Pastikan render_draft.py boleh jumpa fail font (salin ke tempat font render atau rujuk {home}/fonts) dan
   pratonton editor muat font yang sama (Google Fonts css2 dalam editor).
3. Bina semula editor PWA: python3 ~/.claude/assets/reel-page-template/build_editor.py --pwa
4. Uji: render satu draf pendek dengan setiap font kit, buka hasil dan semak tulisan betul dan sama dengan pratonton.
5. Kemas kini sync/kits: setiap kit dapat "editor": {{..."font": "kit<id>"...}} (python3 {home}/studio.py get sync/kits, ubah, put semula).
   ed-boot.js dalam Studio akan guna font kit tu sendiri bila id wujud.
6. Kalau ada clone repo miracikcit-studio dalam Mac ni: commit editor/editor.html yang baru di branch baru (jangan push ke main).
Beritahu Mira ringkas dalam Bahasa Melayu apa yang berubah."""


def run_kit_fonts(inp, sheet, cfg, W):
    """Job kit_fonts: buka sesi Claude Code yang pasang font kit dalam enjin render Editor (render_draft.py)."""
    W.open_claude_session(HOME, "Font kit dalam Editor", FONT_PROMPT.format(home=HOME), "kit-fonts", cfg)
    sheet.call("dset", path="sync/kitfonts", data={"status": "dibuat", "at": int(time.time() * 1000)})
    return {"ok": True}
