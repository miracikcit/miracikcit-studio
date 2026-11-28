#!/usr/bin/env python3
"""Carousel gambar dari footage vlog (2026-11-25, Mira). Saiz 3:4 = 1080x1440. 0 token kecuali `car_text`.

Doc `carousel/<id>` {title, folder "<folder utama>/<projek>", status scan|pick|make|siap|error, pct, msg,
  cands[{i, kind img|vid, src (laluan relatif), t (saat, video), thumb (id Drive), w, h}], drive (folder Drive),
  picks[i...], texts[...], caption, slides[id Drive...], out (folder dalam 00. TO POST FINAL), posted}

car_scan : kumpul gambar dalam folder + SATU frame paling tajam setiap video (3 titik dicuba, ukur ketajaman), gambar kecil ke Drive.
car_make : ambil gambar / frame pada SAIZ PENUH dari fail asal dan susun 1080x1440. Gambar TAK dibesarkan lebih dari 15%:
           kalau sumber kecil atau melintang, ia duduk pada saiz asal di atas latar kabur (supaya tak pecah). Watermark wajib.
car_text : Claude Sonnet (low) tulis teks slide + caption dari nota / caption sedia ada (tanpa tengok gambar)."""
import json, logging, os, re, shutil, subprocess, tempfile, threading, time

log = logging.getLogger("miracikcit")
HOME = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.expanduser("~/Desktop/WORK 2026/CLAUDE EDITS")
OUT_BASE = os.path.join(BASE, "00. TO POST FINAL")
WATERMARK = os.path.expanduser("~/.claude/assets/watermark-miracikcit.png")
FONT = "/System/Library/Fonts/Avenir Next.ttc"
FONT_DEMI, FONT_BOLD = 2, 0
W, H = 1080, 1440
MAX_UP = 1.15                     # had besarkan gambar; lebih dari ni = latar kabur
VIDEO = (".mp4", ".mov", ".m4v")
IMAGE = (".jpg", ".jpeg", ".png", ".heic")
SKIP_DIR = re.compile(r"^(videos|build|editor|page|render|renders|draft|tmp|VO|Kabur & Duplicate)$|-(edit|build|draft)$", re.I)
MAX_VID, MAX_IMG = 60, 60
TEXT_MODEL, TEXT_EFFORT = "claude-sonnet-5-5", "low"
_lock = threading.Lock()
_running = set()


def _merge(sheet, cid, fields):
    doc = sheet.call("dget", path="carousel/" + cid).get("doc") or {}
    doc.update(fields)
    doc["updated"] = int(time.time() * 1000)
    sheet.call("dset", path="carousel/" + cid, data=doc)
    return doc


def _ok_id(cid):
    return bool(re.match(r"^[a-z0-9-]{4,40}$", str(cid or "")))


def _root(key):
    p = str(key or "").split("/")
    if len(p) != 2 or ".." in key or not re.match(r"^[2-4]\d\. ", p[0]) or not p[1].strip():
        raise RuntimeError("folder tak sah")
    root = os.path.join(BASE, p[0], p[1])
    if not os.path.isdir(root):
        raise RuntimeError("Folder footage tiada di Mac mini: " + p[1])
    return root


def _spread(L, n):
    if len(L) <= n:
        return L
    return [L[int(i * len(L) / n)] for i in range(n)]


def _collect(root):
    vids, imgs = [], []
    for d, dirs, fs in os.walk(root):
        dirs[:] = sorted(x for x in dirs if not x.startswith(".") and not SKIP_DIR.search(x))
        for f in sorted(fs):
            if f.startswith("."):
                continue
            rel = os.path.relpath(os.path.join(d, f), root)
            if f.lower().endswith(VIDEO):
                vids.append(rel)
            elif f.lower().endswith(IMAGE):
                imgs.append(rel)
    return _spread(vids, MAX_VID), _spread(imgs, MAX_IMG)


def _dur(ffprobe, p):
    r = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True, timeout=60)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def _sharp(path):
    import cv2
    im = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    return float(cv2.Laplacian(im, cv2.CV_64F).var()) if im is not None else 0.0


def _open_image(path, tmp):
    """Buka gambar pada saiz penuh, ikut orientasi EXIF. HEIC ditukar dengan sips (macOS)."""
    from PIL import Image, ImageOps
    if path.lower().endswith(".heic"):
        out = os.path.join(tmp, "h%d.jpg" % (time.time_ns() % 10 ** 9))
        subprocess.run(["/usr/bin/sips", "-s", "format", "jpeg", "-s", "formatOptions", "100", path, "--out", out], capture_output=True, timeout=120)
        path = out
    im = Image.open(path)
    return ImageOps.exif_transpose(im).convert("RGB")


def _frame(ff, src, t, out, width=None):
    cmd = [ff, "-v", "error", "-y", "-ss", "%.2f" % max(0, t), "-i", src, "-frames:v", "1"]
    cmd += ["-vf", "scale=%d:-2" % width, "-q:v", "4"] if width else ["-q:v", "1"]
    subprocess.run(cmd + [out], capture_output=True, timeout=180)
    return os.path.exists(out)


def _scan(sheet, cid, worker):
    try:
        doc = sheet.call("dget", path="carousel/" + cid).get("doc") or {}
        root = _root(doc.get("folder"))
        ff = worker.find_tool("ffmpeg") or "ffmpeg"
        ffprobe = os.path.join(os.path.dirname(ff), "ffprobe") if os.path.sep in ff else "ffprobe"
        vids, imgs = _collect(root)
        if not vids and not imgs:
            raise RuntimeError("Tiada gambar atau video dalam folder ni")
        fid = doc.get("drive") or sheet.call("dpath", base="studio", path=["FOOTAGE", "CAROUSEL", cid], share=True)["id"]
        cands, total = [], len(vids) + len(imgs)
        with tempfile.TemporaryDirectory(prefix="miracikcit-car-") as tmp:
            for k, rel in enumerate(imgs + vids):
                src, th = os.path.join(root, rel), os.path.join(tmp, "c%03d.jpg" % k)
                c = {"i": len(cands), "kind": "img" if rel in imgs else "vid", "src": rel}
                try:
                    if c["kind"] == "img":
                        im = _open_image(src, tmp)
                        c["w"], c["h"] = im.size
                        im.thumbnail((400, 600))
                        im.save(th, "JPEG", quality=72)
                    else:
                        d = _dur(ffprobe, src)
                        best = (-1.0, 0.0)
                        for frac in (0.25, 0.5, 0.75):
                            t = d * frac if d > 1 else 0
                            p = os.path.join(tmp, "s.jpg")
                            if os.path.exists(p):
                                os.remove(p)
                            if _frame(ff, src, t, p, width=400):
                                s = _sharp(p)
                                if s > best[0]:
                                    best = (s, t)
                                    shutil.copy(p, th)
                            if d <= 1:
                                break
                        if not os.path.exists(th):
                            continue
                        c["t"] = round(best[1], 2)
                        from PIL import Image
                        w0, h0 = Image.open(th).size
                        c["w"], c["h"] = w0, h0                 # nisbah sahaja; saiz penuh diambil masa render
                    c["thumb"] = worker.drive_upload(sheet, th, fid, name="t%03d.jpg" % c["i"])
                    cands.append(c)
                except Exception as e:
                    log.info("Carousel %s: langkau %s (%s)", cid, rel, e)
                if k % 3 == 2 or k == total - 1:
                    _merge(sheet, cid, {"pct": 5 + round(90 * (k + 1) / total), "msg": "Kumpul gambar %d/%d" % (k + 1, total)})
        if not cands:
            raise RuntimeError("Tak dapat baca gambar atau video dalam folder ni")
        _merge(sheet, cid, {"status": "pick", "pct": 100, "msg": "", "cands": cands, "drive": fid})
        log.info("Carousel %s: %d calon (%d gambar, %d video)", cid, len(cands), len(imgs), len(vids))
    except Exception as e:
        log.exception("Carousel %s scan gagal", cid)
        _merge(sheet, cid, {"status": "error", "msg": str(e)[:200]})
    finally:
        _running.discard(cid)


def compose(im, text="", first=False):
    """Satu slide 1080x1440 dari gambar saiz penuh. Tak besarkan lebih dari MAX_UP; kalau perlu, latar kabur."""
    from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
    w, h = im.size
    cover = max(W / w, H / h)
    if cover <= MAX_UP:
        nw, nh = max(W, round(w * cover)), max(H, round(h * cover))
        big = im.resize((nw, nh), Image.LANCZOS)
        x, y = (nw - W) // 2, max(0, min(nh - H, round((nh - H) * 0.42)))
        canvas = big.crop((x, y, x + W, y + H))
    else:
        bg = im.resize((max(W, round(w * cover)), max(H, round(h * cover))), Image.BILINEAR)
        bx, by = (bg.size[0] - W) // 2, (bg.size[1] - H) // 2
        canvas = ImageEnhance.Brightness(bg.crop((bx, by, bx + W, by + H)).filter(ImageFilter.GaussianBlur(38))).enhance(0.72)
        fit = min(W / w, H / h, MAX_UP)
        fg = im.resize((round(w * fit), round(h * fit)), Image.LANCZOS) if abs(fit - 1) > 0.002 else im
        canvas.paste(fg, ((W - fg.size[0]) // 2, (H - fg.size[1]) // 2))
    canvas = canvas.convert("RGBA")
    text = re.sub(r"\s+", " ", str(text or "")).strip()[:120]
    if text:
        grad = Image.new("L", (1, H), 0)
        for yy in range(H):
            a = (yy - H * 0.52) / (H * 0.48)
            grad.putpixel((0, yy), int(max(0, min(1, a)) ** 1.4 * 165))
        shade = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        shade.putalpha(grad.resize((W, H)))
        canvas = Image.alpha_composite(canvas, shade)
        size = 78 if first else 60
        font = ImageFont.truetype(FONT, size, index=FONT_BOLD if first else FONT_DEMI)
        d = ImageDraw.Draw(canvas)
        lines, cur = [], ""
        for word in text.split(" "):
            t = (cur + " " + word).strip()
            if d.textlength(t, font=font) <= W - 2 * 96 or not cur:
                cur = t
            else:
                lines.append(cur)
                cur = word
        lines = (lines + [cur])[:4]
        lh = round(size * 1.22)
        y = 1205 - lh * len(lines)                          # teks duduk atas watermark, dalam margin 96 px
        for ln in lines:
            d.text((96 + 2, y + 3), ln, font=font, fill=(0, 0, 0, 120))
            d.text((96, y), ln, font=font, fill=(255, 255, 255, 255))
            y += lh
    if os.path.exists(WATERMARK):
        wm = Image.open(WATERMARK).convert("RGBA").resize((514, 514), Image.LANCZOS)
        canvas.alpha_composite(wm, (283, 1040))             # sama saiz dan kedudukan mendatar dengan video; 59 px dari bawah
    return canvas.convert("RGB")


def _make(sheet, cid, worker):
    try:
        doc = sheet.call("dget", path="carousel/" + cid).get("doc") or {}
        root = _root(doc.get("folder"))
        by = {c["i"]: c for c in doc.get("cands") or []}
        picks = [by[i] for i in (doc.get("picks") or []) if i in by][:20]
        if len(picks) < 2:
            raise RuntimeError("Pilih sekurang-kurangnya 2 gambar")
        texts = list(doc.get("texts") or [])
        ff = worker.find_tool("ffmpeg") or "ffmpeg"
        name = re.sub(r"[\\/:*?\"<>|]+", " ", str(doc.get("title") or "Carousel")).strip()[:50] or "Carousel"
        out = os.path.join(OUT_BASE, name + " carousel")
        n = 2
        while os.path.exists(out):                          # jangan tindih carousel lama
            out = os.path.join(OUT_BASE, "%s carousel %d" % (name, n))
            n += 1
        os.makedirs(out)
        fid = doc.get("drive") or sheet.call("dpath", base="studio", path=["FOOTAGE", "CAROUSEL", cid], share=True)["id"]
        slides = []
        with tempfile.TemporaryDirectory(prefix="miracikcit-car-") as tmp:
            for k, c in enumerate(picks):
                src = os.path.join(root, c["src"])
                if c.get("kind") == "vid":
                    png = os.path.join(tmp, "f%02d.png" % k)
                    if not _frame(ff, src, float(c.get("t") or 0), png):
                        raise RuntimeError("Tak dapat ambil frame dari " + c["src"])
                    im = _open_image(png, tmp)
                else:
                    im = _open_image(src, tmp)
                fn = os.path.join(out, "%02d.jpg" % (k + 1))
                compose(im, texts[k] if k < len(texts) else "", first=(k == 0)).save(fn, "JPEG", quality=95, subsampling=0)
                slides.append(worker.drive_upload(sheet, fn, fid, name="%s %02d.jpg" % (name, k + 1)))
                _merge(sheet, cid, {"pct": round(100 * (k + 1) / len(picks)), "msg": "Slide %d/%d" % (k + 1, len(picks))})
        _merge(sheet, cid, {"status": "siap", "pct": 100, "msg": "", "slides": slides, "drive": fid, "out": os.path.relpath(out, BASE), "doneAt": int(time.time() * 1000)})
        log.info("Carousel %s siap: %d slide di %s", cid, len(slides), out)
    except Exception as e:
        log.exception("Carousel %s render gagal", cid)
        _merge(sheet, cid, {"status": "error", "step": "make", "msg": str(e)[:200]})
    finally:
        _running.discard(cid)


def _start(sheet, cid, worker, fn, status, msg):
    if not _ok_id(cid):
        raise RuntimeError("id carousel tak sah")
    with _lock:
        if cid in _running:
            return {"started": False}
        _running.add(cid)
    _merge(sheet, cid, {"status": status, "pct": 3, "msg": msg})
    threading.Thread(target=fn, args=(sheet, cid, worker), daemon=True).start()
    return {"started": True}


def job_car_scan(inp, sheet, cfg, worker):
    return _start(sheet, str(inp.get("id") or ""), worker, _scan, "scan", "Mula kumpul gambar")


def job_car_make(inp, sheet, cfg, worker):
    return _start(sheet, str(inp.get("id") or ""), worker, _make, "make", "Mula susun slide")


# Suara Mira (26 Nov 2026): versi pendek ~/.claude/skills/caption-mira/voice.md, sama dengan VOICE_MIRA dalam js/core/utils.js.
TEXT_PROMPT = """Kau penulis content untuk @miracikcit. Tulis teks untuk satu CAROUSEL gambar {n} slide.
SUARA MIRA: rojak Melayu harian + English untuk rasa (honestly, obsessed, stress) dan benda tech. "aku" untuk post tech / gadget, "I" / "saya" / "Mira" untuk post rumah dan harian.
Cerita apa jadi pada Mira sendiri, bukan tutorial; tiada "anda", tiada syarah "korang". Kekalkan je, la, ya, pun, weh, betul2, sbb, yg, mcm.
Jangan guna: sememangnya, tidak dapat dinafikan, justeru, oleh itu, jom kita terokai, rahsia yang ramai tak tahu, bukan sekadar, tahukah anda, semoga bermanfaat, delve, unlock, game-changer, must-have. Tiada em dash, tak salesy.
Caption: satu perenggan mengalir macam bercakap (setup panjang, punch pendek), satu detail konkrit, maks 1 emoji. Tutup dengan punchline dulu-sekarang, minta tolong crowd, atau rasa pendek. JANGAN tutup dengan moral atau soalan pada pembaca.
Tajuk / topik: {title}
Bahan rujukan (nota atau caption video yang sama; guna fakta dari sini sahaja, jangan reka harga atau nama):
{src}

Balas JSON sahaja: {{"texts":["teks slide 1", "..."], "caption":"caption posting + 3-5 hashtag di baris akhir"}}
- Tepat {n} teks. Slide 1 = hook yang buat orang swipe (paling banyak 8 perkataan). Slide tengah = satu point setiap slide (paling banyak 9 perkataan).
  Slide akhir = payoff + satu ajakan santai macam kawan (cth simpan dulu), bukan soalan pada pembaca.
- Tiada emoji dalam teks slide. Jangan ulang ayat pembuka caption video asal."""


def job_car_text(inp, sheet, cfg, worker):
    """Claude Sonnet (low) tulis teks slide + caption. Tanpa tool, tanpa tengok gambar."""
    cid = str(inp.get("id") or "")
    if not _ok_id(cid):
        raise RuntimeError("id carousel tak sah")
    doc = sheet.call("dget", path="carousel/" + cid).get("doc") or {}
    n = max(2, min(20, len(doc.get("picks") or [])))
    src = re.sub(r"\s+\n", "\n", str(inp.get("src") or doc.get("caption") or ""))[:3000] or "(tiada; tulis umum ikut tajuk)"
    import gaya
    with tempfile.TemporaryDirectory() as tmp:
        out, usage = gaya._ask(cfg, worker, tmp, TEXT_PROMPT.format(n=n, title=str(doc.get("title") or "")[:120], src=src), read=False,
                               model=cfg.get("car_model", TEXT_MODEL), effort=cfg.get("car_effort", TEXT_EFFORT))
    texts = [re.sub(r"\s+", " ", str(t)).strip()[:120] for t in (out.get("texts") or [])][:n]
    texts += [""] * (n - len(texts))
    _merge(sheet, cid, {"texts": texts, "caption": str(out.get("caption") or "")[:2200], "textUsage": usage})
    return {"texts": texts}
