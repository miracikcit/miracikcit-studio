#!/usr/bin/env python3
"""Miracikcit Transcribe worker.

Jalan di belakang dalam Mac mini. Setiap minit ia tanya Google Sheet
"CONTENT 2026" (tab Transcribe) melalui Apps Script, ambil video yang
"Dalam giliran" atau "Jana semula", muat turun audio (yt-dlp), transkrip
secara local (mlx-whisper atau whisper.cpp), buat isi penting dengan
Ollama, dan tulis hasil balik ke Sheet. Semua percuma, semua dalam Mac.

Ujian tanpa Sheet:  python3 worker.py --test <link>
"""
import gc, glob, json, logging, logging.handlers, os, platform, re, shutil
import mimetypes, subprocess, sys, tempfile, threading, time, urllib.request

HOME = os.path.dirname(os.path.abspath(__file__))
CFG_PATH = os.path.join(HOME, "config.json")
LOG_DIR = os.path.join(HOME, "logs")
os.makedirs(LOG_DIR, exist_ok=True)

DEFAULTS = {
    "sheet_url": "",            # URL web app Apps Script
    "key": "",                  # kunci rahsia, sama dengan dalam Apps Script
    "backend": "auto",          # auto | mlx | whispercpp
    "mlx_model": "mlx-community/whisper-large-v3-turbo",
    "ggml_model": "models/ggml-large-v3-turbo-q5_0.bin",
    "whisper_cli": "",          # kosong = cari sendiri
    "ollama_url": "http://127.0.0.1:11434",
    "ollama_model": "qwen2.5:7b",
    "poll_seconds": 60,
    "max_minutes": 90,          # video lebih panjang ditolak
    "prefer_malay": True,       # Whisper selalu kesan Melayu sebagai Indonesia
    "cookies_browser": "",      # cth "chrome" kalau Instagram perlu login
}

log = logging.getLogger("transcribe")


def setup_log():
    log.setLevel(logging.INFO)
    h = logging.handlers.RotatingFileHandler(os.path.join(LOG_DIR, "worker.log"),
                                             maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(h)
    if sys.stdout.isatty() or "--test" in sys.argv:
        s = logging.StreamHandler(sys.stderr)
        s.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
        log.addHandler(s)


def load_cfg():
    cfg = dict(DEFAULTS)
    try:
        with open(CFG_PATH, encoding="utf-8") as f:
            cfg.update(json.load(f))
    except FileNotFoundError:
        pass
    return cfg


def p(path):
    return path if os.path.isabs(path) else os.path.join(HOME, path)


def find_tool(name, extra=()):
    for c in list(extra) + [os.path.join(HOME, "bin", name), f"/opt/homebrew/bin/{name}",
                            f"/usr/local/bin/{name}", os.path.expanduser(f"~/.local/bin/{name}")]:
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return shutil.which(name)


# ---------------------------------------------------------------- Sheet API
class Sheet:
    def __init__(self, cfg):
        self.url, self.key = cfg["sheet_url"].strip(), cfg["key"].strip()
        self.lock = threading.Lock()

    def call(self, action, **kw):
        body = json.dumps(dict(kw, key=self.key, action=action)).encode("utf-8")
        req = urllib.request.Request(self.url, data=body, headers={"Content-Type": "application/json"})
        with self.lock:
            with urllib.request.urlopen(req, timeout=60) as r:   # urllib ikut redirect Apps Script
                out = json.loads(r.read().decode("utf-8"))
        if not out.get("ok"):
            raise RuntimeError(out.get("error") or "Apps Script tolak permintaan")
        return out

    def update(self, job, **fields):
        self.call("update", row=job["row"], id=job["id"], fields=fields)


# ---------------------------------------------------------------- yt-dlp
PLATFORM = {"tiktok": "TikTok", "instagram": "Instagram", "facebook": "Facebook",
            "fbreel": "Facebook", "youtube": "YouTube"}


def guess_platform(url, extractor=""):
    u = url.lower()
    if "/shorts/" in u:
        return "YouTube Shorts"
    for k, v in PLATFORM.items():
        if k in (extractor or "").lower() or k in u or (k == "youtube" and "youtu.be" in u) or (k == "facebook" and "fb.watch" in u):
            return v
    return extractor or "Lain-lain"


_last_update = 0


def ytdlp_bin():
    return find_tool("yt-dlp")


def update_ytdlp():
    """TikTok / IG selalu tukar sistem; kemas kini yt-dlp sekali sehari."""
    global _last_update
    if time.time() - _last_update < 86400:
        return
    _last_update = time.time()
    b = ytdlp_bin()
    if b and b.startswith(HOME):
        try:
            r = subprocess.run([b, "-U"], capture_output=True, text=True, timeout=180)
            log.info("yt-dlp: %s", (r.stdout or r.stderr).strip().splitlines()[-1:])
        except Exception as e:
            log.warning("yt-dlp -U gagal: %s", e)


def download(url, tmp, cfg):
    b = ytdlp_bin()
    if not b:
        raise RuntimeError("yt-dlp tak dijumpai. Jalankan pasang.command semula.")
    ff = find_tool("ffmpeg")
    base = [b, "--no-playlist", "--no-warnings", "-f", "ba/b", "-o", os.path.join(tmp, "audio.%(ext)s"),
            "-j", "--no-simulate", "--match-filter", f"duration<{int(cfg['max_minutes']) * 60}", "--match-filter", "!duration"]
    if ff:
        base += ["--ffmpeg-location", os.path.dirname(ff)]
    tries = [base]
    if cfg.get("cookies_browser"):
        tries.append(base + ["--cookies-from-browser", cfg["cookies_browser"]])
    err = ""
    for cmd in tries:
        r = subprocess.run(cmd + [url], capture_output=True, text=True, timeout=900)
        files = [f for f in glob.glob(os.path.join(tmp, "audio.*")) if not f.endswith(".part")]
        if r.returncode == 0 and files:
            info = {}
            for line in r.stdout.splitlines():
                if line.startswith("{"):
                    info = json.loads(line)
            return files[0], info
        err = (r.stderr or r.stdout or "").strip().splitlines()
        err = err[-1] if err else "tiada mesej"
        if r.returncode == 0 and not files:
            err = f"video lebih {cfg['max_minutes']} minit atau bukan video"
    low = err.lower()
    if "login" in low or "private" in low or "cookies" in low or "rate-limit" in low:
        hint = "Video mungkin private atau platform minta login."
    elif "unsupported url" in low:
        hint = "Link ni bukan link video yang disokong."
    elif "minit" in low:
        hint = "Video terlalu panjang."
    else:
        hint = "Video tak dapat dimuat turun."
    raise RuntimeError(f"{hint} ({err[:300]})")


def to_wav(src, tmp):
    ff = find_tool("ffmpeg")
    if not ff:
        raise RuntimeError("ffmpeg tak dijumpai. Jalankan pasang.command semula.")
    out = os.path.join(tmp, "audio16k.wav")
    r = subprocess.run([ff, "-y", "-loglevel", "error", "-i", src, "-ar", "16000", "-ac", "1", out],
                       capture_output=True, text=True, timeout=600)
    if r.returncode != 0 or not os.path.exists(out):
        raise RuntimeError("Audio tak dapat ditukar (" + (r.stderr or "").strip()[-200:] + ")")
    return out


# ---------------------------------------------------------------- Whisper
def backend(cfg):
    b = cfg.get("backend", "auto")
    if b != "auto":
        return b
    if platform.machine() == "arm64":
        try:
            import mlx_whisper  # noqa: F401
            return "mlx"
        except Exception:
            pass
    return "whispercpp"


def run_mlx(wav, cfg, lang):
    import mlx_whisper
    r = mlx_whisper.transcribe(wav, path_or_hf_repo=cfg["mlx_model"], language=lang, task="transcribe",
                               condition_on_previous_text=False, verbose=None)
    segs = [(s["start"], s["end"], s["text"].strip()) for s in r.get("segments", []) if s["text"].strip()]
    try:
        import mlx.core as mx
        mx.clear_cache() if hasattr(mx, "clear_cache") else mx.metal.clear_cache()
    except Exception:
        pass
    gc.collect()
    return r.get("language") or lang or "", segs


def run_whispercpp(wav, cfg, lang):
    cli = find_tool("whisper-cli", [cfg.get("whisper_cli")])
    model = p(cfg["ggml_model"])
    if not cli or not os.path.exists(model):
        raise RuntimeError("whisper.cpp atau model ggml tak dijumpai.")
    outbase = wav[:-4]
    threads = str(max(2, (os.cpu_count() or 4)))
    cmd = [cli, "-m", model, "-f", wav, "-l", lang or "auto", "-oj", "-of", outbase, "-np", "-t", threads, "-mc", "0"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=7200)
    if r.returncode != 0 or not os.path.exists(outbase + ".json"):
        raise RuntimeError("whisper.cpp gagal (" + (r.stderr or "").strip()[-200:] + ")")
    with open(outbase + ".json", encoding="utf-8", errors="replace") as f:
        j = json.load(f)
    segs = []
    for s in j.get("transcription", []):
        t = s.get("text", "").strip()
        if t:
            o = s.get("offsets", {})
            segs.append((o.get("from", 0) / 1000, o.get("to", 0) / 1000, t))
    detected = (j.get("result") or {}).get("language") or lang or ""
    return detected, segs


TLOCK = threading.Lock()   # satu transkrip pada satu masa (tab Transcribe dan A-roll B-roll)


def transcribe(wav, cfg):
    with TLOCK:
        return _transcribe(wav, cfg)


def _transcribe(wav, cfg):
    fn = run_mlx if backend(cfg) == "mlx" else run_whispercpp
    lang, segs = fn(wav, cfg, None)          # None = kesan bahasa sendiri, transkrip dalam bahasa asal
    if cfg.get("prefer_malay") and lang == "id":
        lang, segs = fn(wav, cfg, "ms")      # Melayu Malaysia selalu dikesan sebagai Indonesia
        lang = "ms"
    segs = clean_segments(segs)
    return lang, segs


HALLU = re.compile(r"^(terima kasih( kerana menonton)?|thank you( for watching)?|subtitles? by.*|\[.*\]|\(.*\)|♪+)[.!]*$", re.I)


def clean_segments(segs):
    out, prev = [], None
    for st, en, t in segs:
        t = re.sub(r"\s+", " ", t).strip()
        if not t or HALLU.match(t) or t == prev:
            continue
        out.append((st, en, t))
        prev = t
    return out


def fmt_ts(sec):
    sec = int(sec)
    return f"{sec // 3600}:{sec % 3600 // 60:02d}:{sec % 60:02d}" if sec >= 3600 else f"{sec // 60}:{sec % 60:02d}"


def build_texts(segs):
    stamped = "\n".join(f"[{fmt_ts(s)}] {t}" for s, _, t in segs)
    plain, last_end = "", None
    for s, e, t in segs:
        if plain:
            plain += "\n\n" if (last_end is not None and s - last_end > 1.5) else " "
        plain += t
        last_end = e
    return plain.strip(), stamped


# ---------------------------------------------------------------- Ollama
LANG_NAME = {"ms": "Melayu", "en": "English", "id": "Indonesia", "zh": "Cina", "ta": "Tamil", "ar": "Arab",
             "ja": "Jepun", "ko": "Korea", "th": "Thai", "hi": "Hindi", "tl": "Filipino", "vi": "Vietnam"}


def ollama_ready(cfg):
    try:
        with urllib.request.urlopen(cfg["ollama_url"] + "/api/tags", timeout=5) as r:
            return r.status == 200
    except Exception:
        return False


def key_points(text, lang, cfg):
    text = text[:15000]
    if lang == "ms":
        prompt = ("Berikut ialah transkrip sebuah video.\n\nTulis 3 hingga 7 isi penting yang ringkas dan jelas "
                  "dalam Bahasa Melayu, iaitu bahasa yang sama dengan transkrip. JANGAN terjemah ke bahasa lain. "
                  "Kalau transkrip campur Melayu dan English, kekalkan perkataan English seperti dalam transkrip. "
                  "Setiap isi satu ayat pendek. Jangan tambah fakta yang tiada dalam transkrip.\n"
                  'Balas JSON sahaja dalam bentuk: {"isi": ["isi pertama", "isi kedua"]}\n\nTRANSKRIP:\n' + text)
    else:
        name = {"en": "English"}.get(lang, f"the same language as the transcript (language code: {lang or 'unknown'})")
        prompt = ("Below is the transcript of a video.\n\nWrite 3 to 7 short, clear key points in "
                  f"{name}, the same language as the transcript. Do NOT translate. If the transcript mixes "
                  "languages, keep the mix as it is. One short sentence per point. Do not add facts that are not "
                  'in the transcript.\nReply with JSON only, in this shape: {"isi": ["first point", "second point"]}'
                  "\n\nTRANSCRIPT:\n" + text)
    body = {"model": cfg["ollama_model"], "prompt": prompt, "stream": False, "format": "json",
            "keep_alive": "2m", "options": {"temperature": 0.3, "num_ctx": 8192}}
    req = urllib.request.Request(cfg["ollama_url"] + "/api/generate", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=1800) as r:
        resp = json.loads(r.read().decode("utf-8")).get("response", "")
    items = []
    try:
        j = json.loads(resp)
        items = j.get("isi") or next((v for v in j.values() if isinstance(v, list)), [])
    except Exception:
        items = [l for l in resp.splitlines() if l.strip()]
    items = [re.sub(r"^\s*(\d+[.)]|[-*•])\s*", "", str(x)).strip() for x in items]
    items = [x for x in items if x][:7]
    if not items:
        raise RuntimeError("Ollama tak pulangkan isi penting")
    return "\n".join(f"{i}. {x}" for i, x in enumerate(items, 1))


# ---------------------------------------------------------------- satu kerja
def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def process(job, cfg, sheet=None):
    """Pulangkan dict hasil. Kalau sheet diberi, tulis terus ke Sheet."""
    url = job["link"].strip()
    if job.get("status") == "Jana semula" and job.get("transkrip", "").strip():
        log.info("Jana semula isi penting: %s", url)
        isi = key_points(job["transkrip"], job.get("bahasa_kod") or guess_lang_code(job.get("bahasa", "")), cfg)
        res = {"status": "Siap", "isi_penting": isi, "ralat": "", "tarikh_siap": now_iso()}
        if sheet:
            sheet.update(job, **res)
        return res
    update_ytdlp()
    t0 = time.time()
    with tempfile.TemporaryDirectory(prefix="miracikcit-") as tmp:   # fail audio dibuang sendiri
        src, info = download(url, tmp, cfg)
        plat = guess_platform(url, info.get("extractor_key", ""))
        title = (info.get("title") or info.get("description") or "").strip().split("\n")[0][:200]
        dur = int(info.get("duration") or 0)
        if sheet:
            sheet.update(job, platform=plat, tajuk=title, tempoh=str(dur))
        wav = to_wav(src, tmp)
        lang, segs = transcribe(wav, cfg)
    if not segs:
        raise RuntimeError("Tiada suara yang boleh ditranskrip (mungkin muzik sahaja).")
    plain, stamped = build_texts(segs)
    isi, ralat = "", ""
    try:
        isi = key_points(plain, lang, cfg)
    except Exception as e:
        ralat = f"Transkrip siap, tapi isi penting gagal: {e}"
        log.warning(ralat)
    res = {"status": "Siap", "platform": plat, "tajuk": title, "tempoh": str(dur),
           "bahasa": LANG_NAME.get(lang, lang or "?"), "transkrip": plain, "transkrip_timestamp": stamped,
           "isi_penting": isi, "ralat": ralat, "tarikh_siap": now_iso()}
    log.info("Siap dalam %ds: %s (%s, %s)", time.time() - t0, title[:60], plat, res["bahasa"])
    if sheet:
        sheet.update(job, **res)
    return res


def guess_lang_code(name):
    for k, v in LANG_NAME.items():
        if v.lower() == str(name).lower():
            return k
    return "ms" if not name else ""


# ---------------------------------------------------------------- Studio: kerja dari app
STUDIO_BASE = os.path.expanduser("~/Desktop/WORK 2026/CLAUDE EDITS")
VIDEO_EXT = (".mp4", ".mov", ".m4v")
IMG_EXT = (".jpg", ".jpeg", ".png", ".heic", ".webp")
AI_SYSTEM = "Kau pembantu content creator. Balas dengan satu objek JSON sahaja, tanpa teks lain, tanpa markdown."


def _walk_stats(path):
    clips = images = 0
    pdf = False
    newest = 0
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for fn in files:
            if fn.startswith("."):
                continue
            low = fn.lower()
            try:
                newest = max(newest, os.path.getmtime(os.path.join(root, fn)))
            except OSError:
                pass
            if low.endswith(VIDEO_EXT):
                clips += 1
            elif low.endswith(IMG_EXT):
                images += 1
            elif low.endswith(".pdf"):
                pdf = True
    if not newest:
        newest = os.path.getmtime(path)
    return clips, images, pdf, int(newest * 1000)


# ---------------------------------------------------------------- Drive (melalui Apps Script)
FINALS_STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "finals.json")
_finals = {"running": False}


class _Prog:
    """Pembaca fail yang lapor % (bar upload dalam To Publish)."""
    def __init__(self, fh, size, cb):
        self.fh, self.size, self.cb, self.n, self.last = fh, size, cb, 0, -1
    def read(self, k=-1):
        b = self.fh.read(1 << 20 if k is None or k < 0 else min(k, 1 << 20))
        self.n += len(b)
        p = int(self.n * 100 / max(1, self.size)) // 10 * 10
        if p != self.last:
            self.last = p
            try:
                self.cb(p)
            except Exception:
                pass
        return b
    def __len__(self):
        return self.size


def drive_upload(sheet, path, parent, name=None, progress=None):
    """Apps Script buka sesi muat naik sekali guna; Mac mini hantar bait fail terus ke Drive."""
    size = os.path.getsize(path)
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    url = sheet.call("rstart", name=name or os.path.basename(path), parent=parent, size=size, mime=mime)["url"]
    with open(path, "rb") as fh0:
        fh = _Prog(fh0, size, progress) if progress else fh0
        req = urllib.request.Request(url, data=fh, method="PUT",
                                     headers={"Content-Length": str(size), "Content-Type": mime})
        with urllib.request.urlopen(req, timeout=1800) as r:
            return json.loads(r.read().decode("utf-8"))["id"]


def load_finals():
    try:
        with open(FINALS_STATE) as fh:
            return json.load(fh)
    except Exception:
        return {}


def save_finals(d):
    tmp = FINALS_STATE + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(d, fh)
    os.replace(tmp, FINALS_STATE)


def finals_sync(sheet):
    """Salin video dalam 00. TO POST FINAL ke Drive supaya phone boleh download. Buang dari Drive bila fail hilang dari folder."""
    if _finals["running"]:
        return
    _finals["running"] = True
    threading.Thread(target=_finals_run, args=(sheet,), daemon=True).start()


def _finals_run(sheet):
    try:
        tp = os.path.join(STUDIO_BASE, "00. TO POST FINAL")
        if not os.path.isdir(tp):
            return
        state = load_finals()
        names = {}
        for fn in os.listdir(tp):
            full = os.path.join(tp, fn)
            if fn.lower().endswith(VIDEO_EXT) and os.path.isfile(full) and not fn.startswith("."):
                names[fn] = os.stat(full)
        parent = None
        for fn in sorted(names, key=lambda n: -names[n].st_mtime):
            st, rec = names[fn], state.get(fn)
            if rec and rec.get("size") == st.st_size and rec.get("mtime") == int(st.st_mtime):
                continue
            if time.time() - st.st_mtime < 120:
                continue   # masih ditulis (render belum habis)
            parent = parent or sheet.call("dpath", base="studio", path=["TO POST FINAL"], share=True)["id"]
            if rec:
                sheet.call("dtrash", id=rec["id"])
            todo = [n for n in sorted(names, key=lambda n: -names[n].st_mtime) if n != fn and not (state.get(n) and state[n].get("size") == names[n].st_size)]
            up = lambda p, fn=fn, todo=todo: sheet.call("dset", path="sync/finalsup", data={"name": fn, "pct": p, "queue": todo, "at": int(time.time() * 1000)})
            up(0)
            fid = drive_upload(sheet, os.path.join(tp, fn), parent, progress=up)
            state[fn] = {"id": fid, "size": st.st_size, "mtime": int(st.st_mtime)}
            sheet.call("dset", path="sync/finalsup", data={"name": "", "pct": 100, "queue": todo, "done": fn, "at": int(time.time() * 1000)})
            save_finals(state)
            _scan_last["t"] = 0
            log.info("Final dimuat naik ke Drive: %s", fn)
        for fn in [n for n in state if n not in names]:
            try:
                sheet.call("dtrash", id=state[fn]["id"])
            except Exception:
                pass
            del state[fn]
            save_finals(state)
            _scan_last["t"] = 0
            log.info("Final dibuang dari Drive: %s", fn)
    except Exception:
        log.exception("Sync final ke Drive gagal")
    finally:
        _finals["running"] = False


def _listing_src(folder):
    base = os.path.realpath(os.path.join(STUDIO_BASE, "R1. PRODUCT LISTING"))
    src = os.path.realpath(os.path.join(base, str(folder or "")))
    if not folder or os.path.dirname(src) != base or not os.path.isdir(src):
        raise RuntimeError("Folder listing tak dijumpai: " + str(folder))
    return src


def trash_local(src):
    dest = os.path.join(os.path.expanduser("~/.Trash"), os.path.basename(src))
    if os.path.exists(dest):
        dest += time.strftime(" %H.%M.%S")
    shutil.move(src, dest)


def _set_item(sheet, item_id, **fields):
    if not item_id:
        return
    doc = sheet.call("dget", path="items/" + item_id).get("doc")
    if doc:
        doc.update(fields)
        sheet.call("dset", path="items/" + item_id, data=doc)


def run_archive(inp, sheet):
    """Arkib satu folder product listing ke Drive ARCHIVE PRODUCT LISTING/<nama>, semak bilangan, baru buang ke Trash."""
    src = _listing_src(inp.get("folder"))
    name = str(inp.get("name") or os.path.basename(src)).strip()[:120]
    files = []
    for root, dirs, fns in os.walk(src):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        files += [os.path.join(root, f) for f in fns if not f.startswith(".")]
    if not files:
        raise RuntimeError("Folder kosong")
    parents = {}
    def parent_for(path):
        rel = os.path.relpath(os.path.dirname(path), src)
        parts = [] if rel == "." else rel.split(os.sep)
        k = tuple(parts)
        if k not in parents:
            parents[k] = sheet.call("dpath", base="archive", path=[name] + parts)["id"]
        return parents[k]
    top = parent_for(os.path.join(src, "x"))
    manifest = []
    for f in files:
        fid = drive_upload(sheet, f, parent_for(f))
        rel = os.path.relpath(os.path.dirname(f), src)
        manifest.append({"id": fid, "name": os.path.basename(f), "rel": "" if rel == "." else rel})
    n = sheet.call("dcount", id=top)["n"]
    if n < len(files):
        raise RuntimeError("Drive ada %d fail, folder ada %d. Folder asal tak dibuang." % (n, len(files)))
    link = "https://drive.google.com/drive/folders/" + top
    extra = {"listingBest": True} if inp.get("best") else {}
    _set_item(sheet, inp.get("item"), listingLink=link, listingAt=int(time.time() * 1000), listingFiles=manifest, **extra)
    trash_local(src)
    _scan_last["t"] = 0
    return {"link": link, "files": len(files), "manifest": manifest}


def run_listing_restore(inp, sheet):
    """Ambil balik listing barang best dari Drive ke R1. PRODUCT LISTING/<nama> untuk video seterusnya."""
    import base64
    base = os.path.join(STUDIO_BASE, "R1. PRODUCT LISTING")
    name = re.sub(r'[\\/:*?"<>|]+', " ", str(inp.get("name") or "Produk")).strip()[:60] or "Produk"
    dest = os.path.join(base, name)
    n = 0
    for m in inp.get("files") or []:
        rel = str(m.get("rel") or "")
        if rel.startswith("/") or ".." in rel.split(os.sep):
            continue
        d = os.path.join(dest, rel) if rel else dest
        os.makedirs(d, exist_ok=True)
        out = os.path.join(d, os.path.basename(str(m.get("name") or "fail")))
        if os.path.exists(out):
            continue
        f = sheet.call("file_get", id=m["id"])
        with open(out, "wb") as fh:
            fh.write(base64.b64decode(f["b64"]))
        n += 1
    if not os.path.isdir(dest):
        raise RuntimeError("Tiada fail untuk diambil balik")
    _scan_last["t"] = 0
    return {"folder": name, "restored": n}


def run_listing_delete(inp, sheet):
    src = _listing_src(inp.get("folder"))
    trash_local(src)
    _set_item(sheet, inp.get("item"), listingGone=int(time.time() * 1000))
    _scan_last["t"] = 0
    return {"trashed": os.path.basename(src)}


_hooks_cache = {"t": 0, "m": {}}


def final_hooks():
    """Nama kad New Videos (2026-11-23): fail <Produk>_<N>.mp4 dari editor berbilang part -> ayat hook part N
    (data.json hook, atau tajuk part). Cache 10 minit."""
    if time.time() - _hooks_cache["t"] < 600:
        return _hooks_cache["m"]
    m = {}
    nk = lambda x: re.sub(r"[^a-z0-9]", "", str(x).lower())
    for pj in glob.glob(os.path.join(STUDIO_BASE, "*", "*", "build", "*", "parts.json")):
        try:
            P = json.load(open(pj))
            proj = os.path.basename(os.path.dirname(os.path.dirname(os.path.dirname(pj))))
            for i, part in enumerate(P.get("parts") or [], 1):
                h = ""
                try:
                    d = json.load(open(os.path.join(os.path.dirname(pj), part.get("base") or "", "data.json")))
                    h = (d.get("hook") or "").strip()
                except Exception:
                    pass
                h = h or re.sub(r"^Edit\s+", "", part.get("title") or "")
                if h:
                    m[nk(proj) + "|" + str(i)] = h[:90]
        except Exception:
            continue
    _hooks_cache.update(t=time.time(), m=m)
    return m


def scan_folders():
    """Senarai folder untuk tab To Edit, Ready dan Links. Cuma baca nama fail, tak buka video."""
    base = STUDIO_BASE
    rel = os.path.relpath(base, os.path.expanduser("~"))
    now = int(time.time() * 1000)
    docs = {}
    tp = os.path.join(base, "00. TO POST FINAL")
    if os.path.isdir(tp):
        fin = load_finals()
        files = []
        for fn in os.listdir(tp):
            full = os.path.join(tp, fn)
            if fn.lower().endswith(VIDEO_EXT) and os.path.isfile(full):
                st = os.stat(full)
                rec = fin.get(fn) or {}
                drv = rec.get("id") if rec.get("size") == st.st_size else None
                rec2 = {"name": fn, "size": st.st_size, "mtime": int(st.st_mtime * 1000), "drive": drv}
                mm = re.match(r"(.+?)_(\d+)\.(mp4|mov|m4v)$", fn, re.I)
                if mm:
                    hk = final_hooks().get(re.sub(r"[^a-z0-9]", "", mm.group(1).lower()) + "|" + mm.group(2))
                    if hk:
                        rec2["hook"] = hk
                files.append(rec2)
        files.sort(key=lambda x: -x["mtime"])
        docs["sync/topost"] = {"path": rel + "/00. TO POST FINAL", "syncedAt": now, "files": files}
    pl = os.path.join(base, "R1. PRODUCT LISTING")
    if os.path.isdir(pl):
        folders = []
        for fn in sorted(os.listdir(pl)):
            full = os.path.join(pl, fn)
            if os.path.isdir(full) and not fn.startswith("."):
                _, images, pdf, mt = _walk_stats(full)
                folders.append({"name": fn, "images": images, "hasNotaPdf": pdf, "mtime": mt})
        docs["sync/folders"] = {"path": rel + "/R1. PRODUCT LISTING", "syncedAt": now, "folders": folders}
    stages = []
    for fn in sorted(os.listdir(base)) if os.path.isdir(base) else []:
        m = re.match(r"^(\d+)\.", fn)
        if not m or not (21 <= int(m.group(1)) <= 42) or not os.path.isdir(os.path.join(base, fn)):
            continue
        items = []
        for sub in sorted(os.listdir(os.path.join(base, fn))):
            full = os.path.join(base, fn, sub)
            if os.path.isdir(full) and not sub.startswith("."):
                clips, images, _, mt = _walk_stats(full)
                items.append({"name": sub, "clips": clips, "images": images, "mtime": mt})
        stages.append({"name": fn, "items": items})
    if os.path.isdir(base):
        docs["sync/toedit"] = {"path": rel, "syncedAt": now, "stages": stages}
    return docs


_scan_last = {"t": 0, "sig": {}}


_ft_running = threading.Event()


def _footage_tick(sheet):
    """Aliran footage (B-roll auto pre-cut, klip terbaik, preview Drive) dalam thread sendiri supaya tak sekat kerja lain."""
    if _ft_running.is_set():
        return
    def run():
        _ft_running.set()
        try:
            import footage
            footage.tick(sheet, drive_upload)
        except Exception:
            log.exception("Footage tick gagal")
        finally:
            _ft_running.clear()
    threading.Thread(target=run, daemon=True).start()


_edsync = {"since": 0, "docs": {}, "t": 0}


def editor_autosync(sheet, files):
    """Tab Editor sync sendiri (2026-11-23, Mira): projek yang video finalnya dah ada dalam 00. TO POST FINAL ditanda Siap
    (editor/<id> status + final, edpwa/<id> final). Baca doc berubah sahaja (pull since), setiap 5 minit bersama scan."""
    j = sheet.call("pull", since=_edsync["since"])
    for x in j.get("docs", []):
        _edsync["since"] = max(_edsync["since"], x.get("u") or 0)
        pth = x.get("p") or ""
        if pth.startswith(("editor/", "edpwa/")):
            if x.get("d"):
                _edsync["docs"][pth] = x["d"]
            else:
                _edsync["docs"].pop(pth, None)
    nk = lambda t: re.sub(r"[^a-z0-9]", "", str(t).lower())
    def hit(name, after):
        k = nk(name)
        if len(k) < 4:
            return None
        for f in files:
            t = nk(re.split(r"[_]+", f["name"])[0])
            if len(t) >= 4 and (k.startswith(t) or t.startswith(k[:max(4, len(t))])) and f["mtime"] >= after:
                return f["name"]
        return None
    for pth, d in list(_edsync["docs"].items()):
        if pth.startswith("editor/") and d.get("folder") and not d.get("final") and not re.search(r"siap", str(d.get("status") or ""), re.I):
            fn = hit(str(d["folder"]).split("/")[-1], (d.get("sessionAt") or d.get("created") or 0) - 3600000)
            if fn:
                d = dict(d, status="Siap", final=fn, updated=int(time.time() * 1000))
                sheet.call("dset", path=pth, data=d); _edsync["docs"][pth] = d
                log.info("Tab Editor: %s siap (%s)", pth, fn)
        elif pth.startswith("edpwa/") and d.get("files") and d.get("final") != "siap" and d.get("finStatus") != "proses":
            proj = (re.search(r"CLAUDE EDITS/[^/]+/([^/]+)", str(d.get("dir") or "")) or [None, ""])[1]
            fn = hit(proj, (d.get("created") or 0))
            if fn and (d.get("finAt") or d.get("draft")):
                d = dict(d, final="siap")
                sheet.call("dset", path=pth, data=d); _edsync["docs"][pth] = d
                log.info("Tab Editor: %s final (%s)", pth, fn)


def push_scan(sheet, force=False):
    if not force and time.time() - _scan_last["t"] < 300:
        return None
    _scan_last["t"] = time.time()
    try:
        docs = scan_folders()
    except PermissionError:
        log.warning("Scan folder disekat macOS: beri Python akses folder Desktop (Full Disk Access).")
        return None
    finals_sync(sheet)
    for path, doc in docs.items():
        sig = json.dumps({k: v for k, v in doc.items() if k != "syncedAt"}, sort_keys=True)
        if force or _scan_last["sig"].get(path) != sig or time.time() - _scan_last.get("full", 0) > 3600:
            sheet.call("dset", path=path, data=doc)
            _scan_last["sig"][path] = sig
    _scan_last["full"] = time.time()
    try:
        editor_autosync(sheet, docs.get("sync/topost", {}).get("files", []))
    except Exception:
        log.exception("Auto sync tab Editor gagal")
    _footage_tick(sheet)
    return {"topost": len(docs.get("sync/topost", {}).get("files", [])),
            "toedit": sum(len(s["items"]) for s in docs.get("sync/toedit", {}).get("stages", []))}


def run_claude(prompt, cfg):
    cli = find_tool("claude", [cfg.get("claude_cli")])
    if not cli:
        raise RuntimeError("Claude Code tak dijumpai dalam Mac mini.")
    cmd = [cli, "-p", prompt, "--model", cfg.get("claude_model", "sonnet"), "--tools", "",
           "--system-prompt", AI_SYSTEM, "--no-session-persistence", "--output-format", "json"]
    if cfg.get("claude_bare_settings", True):
        cmd += ["--setting-sources", ""]
    with tempfile.TemporaryDirectory(prefix="miracikcit-ai-") as tmp:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300, cwd=tmp)
    try:
        d = json.loads(r.stdout)
    except Exception:
        raise RuntimeError("Claude tak jawab: " + (r.stderr or r.stdout or "")[-300:])
    txt = str(d.get("result") or "")
    if d.get("is_error") or "not logged in" in txt.lower():
        raise RuntimeError("Claude dalam Mac mini belum login atau had usage penuh: " + txt[:200])
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        raise RuntimeError("Jawapan Claude bukan JSON")
    u = d.get("usage") or {}
    return {"json": json.loads(m.group(0)),
            "usage": {"in": u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0),
                      "out": u.get("output_tokens", 0)}}


def run_voice(file_id, sheet, cfg):
    import base64
    f = sheet.call("file_get", id=file_id)
    with tempfile.TemporaryDirectory(prefix="miracikcit-v-") as tmp:
        ext = os.path.splitext(f.get("name") or "")[1] or ".m4a"
        src = os.path.join(tmp, "voice" + ext)
        with open(src, "wb") as fh:
            fh.write(base64.b64decode(f["b64"]))
        wav = to_wav(src, tmp)
        lang, segs = transcribe(wav, cfg)
    plain, _ = build_texts(segs)
    return {"text": plain, "bahasa": LANG_NAME.get(lang, lang or "")}


def run_ocr(file_id, sheet):
    """Baca teks dalam screenshot dengan Apple Vision (bin/ocr). Percuma, gambar tak keluar dari Mac."""
    import base64
    f = sheet.call("file_get", id=file_id)
    tool = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin", "ocr")
    with tempfile.TemporaryDirectory(prefix="miracikcit-ocr-") as tmp:
        src = os.path.join(tmp, "shot" + (os.path.splitext(f.get("name") or "")[1] or ".png"))
        with open(src, "wb") as fh:
            fh.write(base64.b64decode(f["b64"]))
        r = subprocess.run([tool, src], capture_output=True, text=True, timeout=60)
    return {"lines": json.loads(r.stdout or "[]")}


def run_listing_save(inp, sheet):
    """Simpan gambar listing dari app ke R1. PRODUCT LISTING/<produk>, kemudian baca teks gambar (Apple Vision, percuma)."""
    import base64
    base = os.path.join(STUDIO_BASE, "R1. PRODUCT LISTING")
    name = re.sub(r'[\\/:*?"<>|]+', " ", str(inp.get("name") or "Produk")).strip()[:60] or "Produk"
    folder = str(inp.get("folder") or "").strip()
    if not folder or os.path.sep in folder or not os.path.isdir(os.path.join(base, folder)):
        folder = name
        low = name.lower()
        for d in (os.listdir(base) if os.path.isdir(base) else []):
            if d.lower() == low:
                folder = d
                break
    dest = os.path.join(base, folder)
    os.makedirs(dest, exist_ok=True)
    tag = re.sub(r"\W+", "", name.split()[0] if name.split() else "listing") or "listing"
    tool = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin", "ocr")
    texts, saved = [], 0
    for fid in inp.get("files") or []:
        f = sheet.call("file_get", id=fid)
        raw = base64.b64decode(f["b64"])
        n = len([x for x in os.listdir(dest) if not x.startswith(".") and x != "link.txt"]) + 1
        path = os.path.join(dest, "%s_listing_%02d.jpg" % (tag, n))
        while os.path.exists(path):
            n += 1
            path = os.path.join(dest, "%s_listing_%02d.jpg" % (tag, n))
        # Jimat ruang: kecilkan ke 1600 px, JPEG 80 %. Kalau sips gagal, simpan fail asal.
        with tempfile.TemporaryDirectory(prefix="miracikcit-ls-") as tmp:
            src = os.path.join(tmp, "in" + ((os.path.splitext(f.get("name") or "")[1]) or ".img"))
            with open(src, "wb") as fh:
                fh.write(raw)
            r = subprocess.run(["sips", "-Z", "1600", "-s", "format", "jpeg", "-s", "formatOptions", "80", src, "--out", path],
                               capture_output=True, text=True, timeout=60)
            if r.returncode != 0 or not os.path.exists(path):
                path = os.path.splitext(path)[0] + ((os.path.splitext(f.get("name") or "")[1]) or ".jpg").lower()
                with open(path, "wb") as fh:
                    fh.write(raw)
        saved += 1
        try:
            r = subprocess.run([tool, path], capture_output=True, text=True, timeout=60)
            texts.append(" ".join(l.get("t", "") for l in json.loads(r.stdout or "[]")))
        except Exception:
            log.warning("OCR listing gagal: %s", path)
    links = [("Shopee", inp.get("shopee")), ("TikTok", inp.get("tiktok"))]
    if any(v for _, v in links):
        with open(os.path.join(dest, "link.txt"), "w") as fh:
            fh.write("".join("%s: %s\n" % (k, v) for k, v in links if v))
    total = len([x for x in os.listdir(dest) if not x.startswith(".") and x != "link.txt"])
    return {"folder": folder, "saved": saved, "total": total, "text": "\n".join(t for t in texts if t.strip())[:12000]}


NOTA_PROMPT = """Kau sediakan NOTA VIDEO JUALAN untuk @miracikcit, content creator Malaysia yang jual produk melalui video pendek TikTok / Reels / Shopee (Bahasa Melayu santai). Ini nota rujukan dan idea, BUKAN skrip.

Produk: {name}
Platform sample: {plat}
Link: {link}
Gambar listing (baca SEMUA dengan tool Read, satu-satu): {files}

Langkah:
1. Baca setiap gambar dengan teliti. Ambil setiap claim, spesifikasi, saiz, bahan, sijil, amaran, harga/promo dan nombor pendaftaran yang tertulis.
2. Kenal pasti JENIS produk (contoh: kosmetik / penjagaan diri, suplemen, gadget / elektronik, barang rumah, mainan / produk anak, pakaian, makanan). Sesuaikan sub-tajuk USP, isi Bahan dan Cara Guna dengan jenis produk tu.
3. Semak claim promo dengan label / spesifikasi. Catat apa-apa yang bercanggah atau tak dapat disahkan.

Balas SATU objek JSON sahaja (tanpa markdown), bentuk:
{{"name": nama produk ringkas, "brand": jenama, "jenis": jenis produk, "subtitle": "saiz / model / warna / asal, dipisah ' · '",
 "assumption": "Andaian: TikTok / Reels, 30-60 saat, audiens ..., gaya santai. Nota rujukan, bukan skrip.",
 "sections": [
  {{"title": "Idea Video", "items": [5-7 sudut video yang sesuai dengan produk dan audiens, setiap satu: 'Nama idea: apa yang ditunjuk']}},
  {{"title": "Hook (3 saat pertama)", "items": [4 ayat pembuka santai]}},
  {{"title": "Point Utama Untuk Cakap", "items": [5-6 point jualan paling kuat]}},
  {{"title": "USP Lengkap", "groups": [{{"title": sub-tajuk ikut jenis produk, "items": [...]}}, ...]}},
  {{"title": "Bahan" (atau "Spesifikasi" untuk gadget / barang bukan bahan), "items": [setiap bahan / spesifikasi utama dengan manfaat satu baris, dan satu baris 'Pilih 3-4 point je untuk sebut.']}},
  {{"title": "Sesuai Untuk", "items": [siapa yang sesuai]}},
  {{"title": "Cara Guna / Tips", "items": [cara guna, dos and don'ts, amaran produk sendiri]}},
  {{"title": "Trust Points (B-roll / teks skrin)", "items": [close-up label, sijil, teks skrin yang boleh diguna]}},
  {{"title": "CTA", "items": [3 ayat penutup]}},
  {{"title": "JANGAN Sebut", "danger": true, "items": [frasa yang perlu dielak supaya video tak kena flag KKM / platform, dan percanggahan yang dijumpai, format 'JANGAN ... GUNA ...' bila sesuai]}}
 ]}}

Peraturan:
- USP Lengkap: SEMUA USP dari gambar, jangan tinggal satu pun, dikumpul bawah sub-tajuk (contoh kosmetik: Bau, Kesan pada kulit, Formula, Pengalaman, Harga & promo, Kepercayaan; gadget: Fungsi utama, Spesifikasi, Bateri & cas, Reka bentuk, Dalam kotak, Kepercayaan; mainan / anak: Cara main, Kebaikan untuk anak, Keselamatan, Dalam kotak). Tanda "(claim brand)" untuk dakwaan jenama sendiri.
- Bahasa Melayu santai, ayat pendek senang dibaca masa shoot. Tanpa emoji.
- Jangan reka fakta yang tiada dalam gambar. Kalau tiada maklumat, tulis 'tiada dalam gambar'.
- Pematuhan Malaysia: produk tradisional / suplemen tak boleh claim rawat / ubat / cegah penyakit; jangan 'FDA approved'; sertakan amaran produk; flag statistik yang tak dapat disahkan sebagai claim brand; flag nama jenama lain / 'dupe'; harga promo ada tarikh tamat.
- Contoh gaya (nota Bath Garden): Idea Video 'Test buih: picit atas loofah, gosok, tunjuk buih tebal close-up'; Hook 'Mandi pun boleh bau macam dessert ke?'; JANGAN Sebut 'JANGAN putihkan kulit / whitening. Niacinamide cuma nampak lebih cerah'."""


NOTA_SKILL_WRAP = """Ikut skill di bawah (skill nota-video-jualan Mira dari Claude chat) untuk sediakan nota video jualan.

=== SKILL ===
{skill}
=== TAMAT SKILL ===

MOD STUDIO (ganti bahagian PDF dalam skill):
- Gambar produk ada dalam fail ni; baca SEMUA dengan tool Read, satu-satu: {files}
- Produk: {name} · Platform sample: {plat} · Link: {link}
- JANGAN buat PDF, jangan render, jangan SendUserFile, jangan balas ayat. Balas SATU objek JSON sahaja (tanpa markdown) yang sama dengan `data` dalam PAYLOAD skill:
  {{"name", "brand", "jenis" (jenis produk), "subtitle", "assumption", "sections": [10 bahagian ikut susunan skill, setiap satu {{"title", "items"}}; USP Lengkap guna "groups"; JANGAN Sebut ada "danger": true]}}
- Sesuaikan sub-tajuk USP Lengkap dan bahagian Bahan (atau Spesifikasi untuk barang bukan bahan) dengan jenis produk.
- Tanpa emoji."""


def _nota_skill():
    """Baca SKILL.md nota-video-jualan yang Claude app sync ke Mac (skill sama yang Mira guna dalam Claude chat)."""
    import glob
    pats = [os.path.expanduser("~/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/*/*/skills/nota-video-jualan/SKILL.md"),
            os.path.expanduser("~/.claude/skills/nota-video-jualan/SKILL.md")]
    found = [f for p in pats for f in glob.glob(p)]
    if not found:
        return ""
    try:
        txt = open(max(found, key=os.path.getmtime), encoding="utf-8").read()
        return re.sub(r"^---.*?---\s*", "", txt, flags=re.S)[:12000]
    except Exception:
        return ""


def run_nota(inp, sheet, cfg):
    """Nota video jualan dari gambar listing dalam R1, dibuat oleh Claude Opus (effort low) dalam Mac mini."""
    src = _listing_src(inp.get("folder"))
    imgs = sorted(f for f in os.listdir(src) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic")))[:14]
    if not imgs:
        raise RuntimeError("Tiada gambar listing dalam folder")
    cli = find_tool("claude", [cfg.get("claude_cli")])
    if not cli:
        raise RuntimeError("Claude Code tak dijumpai dalam Mac mini.")
    files = ", ".join(os.path.join(src, f) for f in imgs)
    skill = _nota_skill()
    if skill:
        prompt = NOTA_SKILL_WRAP.format(skill=skill, name=inp.get("name") or os.path.basename(src),
                                        plat=inp.get("plat") or "-", link=inp.get("link") or "-", files=files)
    else:
        prompt = NOTA_PROMPT.format(name=inp.get("name") or os.path.basename(src), plat=inp.get("plat") or "-",
                                    link=inp.get("link") or "-", files=files)
    cmd = [cli, "-p", prompt, "--model", cfg.get("nota_model", "claude-opus-5-5"), "--effort", cfg.get("nota_effort", "low"),
           "--tools", "Read", "--allowedTools", "Read", "--add-dir", src,
           "--system-prompt", AI_SYSTEM, "--no-session-persistence", "--output-format", "json", "--setting-sources", ""]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=900, cwd=src)
    try:
        d = json.loads(r.stdout)
    except Exception:
        raise RuntimeError("Claude tak jawab: " + (r.stderr or r.stdout or "")[-300:])
    txt = str(d.get("result") or "")
    if d.get("is_error") or "not logged in" in txt.lower():
        raise RuntimeError("Claude dalam Mac mini belum login atau had usage penuh: " + txt[:200])
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        raise RuntimeError("Jawapan Claude bukan JSON")
    j = json.loads(m.group(0))
    pid = re.sub(r"[^a-z0-9]+", "-", ((j.get("brand") or "") + " " + (j.get("name") or inp.get("name") or "produk")).lower()).strip("-")[:48] or "produk"
    now = int(time.time() * 1000)
    doc = {"id": pid, "name": j.get("name") or inp.get("name"), "brand": j.get("brand") or "", "jenis": j.get("jenis") or "",
           "subtitle": j.get("subtitle") or "", "assumption": j.get("assumption") or "",
           "folder": "R1. PRODUCT LISTING/" + os.path.basename(src), "sections": j.get("sections") or [],
           "created": now, "updated": now, "src": "listing"}
    sheet.call("dset", path="products/" + pid, data=doc)
    if inp.get("item"):
        item = sheet.call("dget", path="items/" + inp["item"]).get("doc")
        if item:
            item["productId"] = pid
            item.pop("nota", None)
            item["noteAt"] = now
            sheet.call("dset", path="items/" + inp["item"], data=item)
    u = d.get("usage") or {}
    return {"productId": pid, "product": doc, "usage": {"in": u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0), "out": u.get("output_tokens", 0)}}


# ---------------------------------------------------------------- EDIT NOW, folder edit, paid job
EDIT_MODEL, EDIT_EFFORT = "claude-opus-5-5", "medium"


def _edit_main(stage):
    base = os.path.realpath(STUDIO_BASE)
    main = os.path.realpath(os.path.join(base, str(stage or "")))
    m = re.match(r"^(\d+)\.", os.path.basename(main))
    if not m or os.path.dirname(main) != base or not os.path.isdir(main) or not (21 <= int(m.group(1)) <= 42):
        raise RuntimeError("Folder edit tak dijumpai: " + str(stage))
    return main, m.group(1)


def _safe_name(name):
    n = re.sub(r'[\\/:*?"<>|]+', " ", str(name or "")).strip().strip(".")[:60]
    if not n:
        raise RuntimeError("Nama projek kosong")
    return n


def ensure_edit_settings(main):
    """Setiap folder edit guna Opus 5.5 effort medium (.claude/settings.json), sama macam Work Sorter."""
    d = os.path.join(main, ".claude")
    os.makedirs(d, exist_ok=True)
    f = os.path.join(d, "settings.json")
    try:
        cur = json.load(open(f, encoding="utf-8"))
    except Exception:
        cur = {}
    if cur.get("model") != EDIT_MODEL or cur.get("effortLevel") != EDIT_EFFORT:
        cur["model"], cur["effortLevel"] = EDIT_MODEL, EDIT_EFFORT
        with open(f, "w", encoding="utf-8") as fh:
            json.dump(cur, fh, ensure_ascii=False, indent=2)


def run_mkfolder(inp, sheet):
    main, _ = _edit_main(inp.get("stage"))
    name = _safe_name(inp.get("name"))
    os.makedirs(os.path.join(main, name), exist_ok=True)
    _scan_last["t"] = 0
    push_scan(sheet, force=True)
    return {"name": name}


def run_edit_now(inp, sheet, cfg):
    """Buka sesi Claude Code baru dalam Terminal Mac mini: folder utama, Opus 5.5 medium, Remote Control hidup,
    terus jalan /edit-reel <no>/<projek>. Mira kawal dari app Claude di phone."""
    main, no = _edit_main(inp.get("stage"))
    name = _safe_name(inp.get("name"))
    os.makedirs(os.path.join(main, name), exist_ok=True)
    ensure_edit_settings(main)
    cli = find_tool("claude", [cfg.get("claude_cli")])
    if not cli:
        raise RuntimeError("Claude Code tak dijumpai dalam Mac mini.")
    key = os.path.basename(main) + "/" + name
    ed_id = "ed-f-" + re.sub(r"[^a-z0-9]+", "", key.lower())[:40]
    prompt = f"/edit-reel {no}/{name} (tracker Studio: editor/{ed_id})"
    q = lambda x: "'" + str(x).replace("'", "'\\''") + "'"
    d = os.path.join(HOME, "edit-now")
    os.makedirs(d, exist_ok=True)
    for old in glob.glob(os.path.join(d, "*.command")) + glob.glob(os.path.join(d, "*.log")):
        if time.time() - os.path.getmtime(old) > 86400:
            os.remove(old)
    slug = re.sub(r"[^A-Za-z0-9]+", "-", key)[:60]
    cmdf = os.path.join(d, slug + ".command")
    logf = os.path.join(d, slug + ".log")
    title = f"{no} · {name}"
    if os.path.exists(logf):
        os.remove(logf)
    with open(cmdf, "w", encoding="utf-8") as fh:
        fh.write("#!/bin/zsh -l\n# Dibuat oleh butang EDIT NOW dalam Miracikcit Studio\n"
                 f"cd {q(main)} || exit 1\n"
                 # script: rakam skrin supaya worker boleh ambil link Remote Control dan status
                 f"exec /usr/bin/script -q {q(logf)} {q(cli)} --model {EDIT_MODEL} --effort {EDIT_EFFORT} -n {q(title)} --remote-control {q(title)} {q(prompt)}\n")
    os.chmod(cmdf, 0o755)
    r = subprocess.run(["/usr/bin/open", "-a", "Terminal", cmdf], capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        raise RuntimeError("Tak dapat buka Terminal: " + (r.stderr or "")[-200:])
    now = int(time.time() * 1000)
    cur = sheet.call("dget", path="editor/" + ed_id).get("doc") or {"created": now}
    cur.update({"name": name, "folder": key, "style": os.path.basename(main), "status": "Sesi dibuka", "updated": now, "sessionAt": now})
    cur.pop("chat", None)
    sheet.call("dset", path="editor/" + ed_id, data=cur)
    threading.Thread(target=_watch_session, args=(sheet, ed_id, logf), daemon=True).start()
    return {"editor": ed_id, "folder": key}


def run_ed_send(inp, sheet, cfg):
    """Butang Siap dalam Editor PWA: buka sesi Claude Code dalam folder utama projek (gaya folder tu), Opus 5.5 medium,
    Remote Control hidup, dengan arahan yang sama macam butang Siap artifact + di mana edit disimpan."""
    vid = re.sub(r"[^a-z0-9-]", "", str(inp.get("vid") or ""))
    if not vid:
        raise RuntimeError("tiada id editor")
    pdir = str(inp.get("dir") or "")
    root = os.path.expanduser("~/Desktop/WORK 2026/CLAUDE EDITS")
    main = root
    if pdir.startswith(root + os.sep):
        main = os.path.join(root, pdir[len(root) + 1:].split(os.sep)[0])
    if not os.path.isdir(main):
        main = root
    cli = find_tool("claude", [cfg.get("claude_cli")])
    if not cli:
        raise RuntimeError("Claude Code tak dijumpai dalam Mac mini.")
    edits = "edx/%s~edits~current" % vid
    pay = inp.get("payload") or {}
    effort = EDIT_EFFORT
    if pay.get("action") in ("upload", "render-all") and pay.get("render") != "draft":
        # FINAL mod jimat token (Mira 2026-11-23): senarai lengkap dalam prompt, tiada baca peraturan penuh, tiada semak frame
        effort = "low"
        multi = pay.get("action") == "render-all"
        prompt = (
            f"FINAL PWA (mod jimat token, arahan Mira 23 Nov). Ikut langkah di bawah SAHAJA. Ini pengecualian kepada arahan WAJIB baca PERATURAN-EDIT.md: "
            "JANGAN baca PERATURAN-EDIT.md, STYLE-REFERENCE, storyboard, nota atau footage. JANGAN tengok frame / gambar: tiada semak watermark, safe zone, opening atau ending. "
            "Fail sementara dalam scratchpad sesi. Jangan tanya kecuali butang tak beri jawapan yang perlu.\n"
            f"BAR PROGRESS (wajib, satu baris pendek, jangan cetak output): selepas setiap langkah jalankan python3 ~/MiracikcitTranscribe/studio.py merge 'edpwa/{vid}' '{{\"finPct\":N,\"finStep\":\"<apa sedang dibuat>\"}}'. "
            "N: lepas langkah 1 = 15; semasa render part k daripada T = 15 + 55*k/T; lepas 3 = 75; lepas 4 = 88; lepas 6 = 95. "
            f"Kalau gagal dan berhenti: python3 ~/MiracikcitTranscribe/studio.py merge 'edpwa/{vid}' '{{\"finStatus\":\"error\",\"finStep\":\"<sebab ringkas>\"}}'.\n"
            f"Arahan butang: {str(inp.get('text') or '')[:600]}\n"
            f"1. Edit: python3 ~/MiracikcitTranscribe/studio.py get '{edits if not multi else 'edx/' + vid + '~edits~pN'}' > edits.json"
            f"{' (setiap part N = 1..' + str(pay.get('total') or '') + ')' if multi else ''}. Kalau hasilnya ada _c, gabung medan s dari ~c0, ~c1 ... ikut turutan. "
            f"Project: medan project dalam studio.py get 'edpwa/{vid}'.\n"
            "2. Render: python3 ~/.claude/assets/reel-page-template/render_draft.py <project> edits.json <build dalam scratchpad> --final <Nama>.mp4 "
            "(nama mula dengan perkataan pertama nama produk, cth PintuKabinet_1.mp4). Satu demi satu kalau banyak part.\n"
            "3. Salin setiap mp4 dari <build>/**/renders/ ke '~/Desktop/WORK 2026/CLAUDE EDITS/00. TO POST FINAL/'.\n"
            "4. Sheet CONTENT 2026 (sekali untuk semua part): PRODUCTS = baca baris produk dulu, tambah satu baris setiap video (E VID, F caption), kemas kini D TOTAL VID, "
            "produk baru salin format baris lama (checkbox FALSE, Q templat TT:/IG:/FB:/SV:). NON PRODUCT = B nama, C caption. "
            "Caption: ayat hook santai dengan emoji, ayat kedua, baris kosong, baris terakhir #Produk #Kategori #shopeemy #shopeeaffiliatesmy #shopeelagimurah @shopee_my @shopeeaffiliates_my "
            "(bukan produk: 2 hashtag sahaja). Ikut peraturan TikTok Shop.\n"
            f"5. Studio: python3 ~/MiracikcitTranscribe/studio.py merge 'edpwa/{vid}' '{{\"final\":\"siap\"}}' dan python3 ~/MiracikcitTranscribe/studio.py scan.\n"
            + (f"6. Fail asal: PINDAH folder projek (yang ada footage asal) dengan mv ke '~/Desktop/WORK 2026/CLAUDE EDITS/{os.path.basename(str(pay.get('srcTo') or ''))}/' (jangan tindih folder sama nama; tambah ' 2'). Jangan buang apa-apa. "
               if str(pay.get("failAsal") or "").startswith("pindah") and pay.get("srcTo") else "6. Raw footage JANGAN dibuang. ") + "Folder 28: selepas semua part final, curl -X POST localhost:8787/api/scan -d '{\"path\":\"28. EDIT + VO/<projek>\"}'. "
            "Storyboard artifact projek: padam bila semua video projek dah final.\n"
            "7. Kemas: build dan fail sementara ke Trash. Laporan 2-3 baris: fail final + baris Sheet. "
            f"Akhir sekali: python3 ~/MiracikcitTranscribe/studio.py merge 'edpwa/{vid}' '{{\"finPct\":100,\"finStatus\":\"siap\",\"finStep\":\"<nama fail final>\"}}'.")
    else:
      prompt = (str(inp.get("text") or "")[:3000] +
              f"\n\n(Dari Editor PWA Studio, bukan artifact. Edit Mira disimpan dalam Studio: python3 ~/MiracikcitTranscribe/studio.py get '{edits}'"
              f" (untuk projek berbilang part: edx/{vid}~edits~p1, p2, ...; prefs: edx/{vid}~prefs~style). Kalau doc ada _c, sambung edx/...~c0, ~c1 ... ikut turutan (medan s)."
              f" Folder page editor: {pdir}. Data butang: {json.dumps(inp.get('payload') or {}, ensure_ascii=False)[:1500]})")
    q = lambda x: "'" + str(x).replace("'", "'\\''") + "'"
    d = os.path.join(HOME, "edit-now")
    os.makedirs(d, exist_ok=True)
    title = (str(inp.get("title") or vid))[:50] + " · Siap"
    cmdf = os.path.join(d, "edsend-" + vid[:40] + ".command")
    logf = os.path.join(d, "edsend-" + vid[:40] + ".log")
    if os.path.exists(logf):
        os.remove(logf)
    with open(cmdf, "w", encoding="utf-8") as fh:
        fh.write("#!/bin/zsh -l\n# Dibuat oleh butang Siap dalam Editor PWA Studio\n"
                 f"cd {q(main)} || exit 1\n"
                 f"exec /usr/bin/script -q {q(logf)} {q(cli)} --model {EDIT_MODEL} --effort {effort} -n {q(title)} --remote-control {q(title)} {q(prompt)}\n")
    os.chmod(cmdf, 0o755)
    fin = effort == "low"   # final: bar % dan link chat dalam editor (p23)
    if fin:
        _fin(sheet, vid, finAt=int(time.time() * 1000), finPct=5, finStep="Sesi Claude sedang dibuka di Mac mini…", finStatus="proses", finChat="")
    r = subprocess.run(["/usr/bin/open", "-a", "Terminal", cmdf], capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        if fin:
            _fin(sheet, vid, finStatus="error", finStep="Tak dapat buka Terminal di Mac mini")
        raise RuntimeError("Tak dapat buka Terminal: " + (r.stderr or "")[-200:])
    if fin:
        threading.Thread(target=_watch_fin, args=(sheet, vid, logf), daemon=True).start()
    return {"opened": True, "folder": os.path.basename(main)}


def _fin(sheet, vid, **kw):
    try:
        cur = sheet.call("dget", path="edpwa/" + vid).get("doc") or {}
        cur.update(kw)
        sheet.call("dset", path="edpwa/" + vid, data=cur)
    except Exception as e:
        log.warning("Tak dapat kemas kini status final %s: %s", vid, e)


def _watch_fin(sheet, vid, logf, limit=900):
    """Sesi final: ambil link chat Remote Control dari skrin, simpan finChat (butang Buka chat dalam editor)."""
    end = time.time() + limit
    while time.time() < end:
        time.sleep(4)
        try:
            raw = _ANSI.sub("", open(logf, encoding="utf-8", errors="ignore").read()[-200000:])
        except Exception:
            continue
        m = re.search(r"https://claude\.ai/code/[A-Za-z0-9_\-]+(?:\?[A-Za-z0-9_=&\-]+)?", raw)
        if m:
            cur = (sheet.call("dget", path="edpwa/" + vid).get("doc") or {})
            kw = {"finChat": m.group(0)}
            if (cur.get("finPct") or 0) < 8:
                kw.update(finPct=8, finStep="Sesi Claude jalan, mula baca edit…")
            _fin(sheet, vid, **kw)
            return


def run_ed_new(inp, sheet, cfg):
    """Kad Home 'Edit sendiri': sediakan Editor PWA dari folder footage TANPA Claude (0 token).
    Semua klip video dalam folder jadi klip timeline (6 s pertama, boleh panjangkan hingga 12 s), make_page.py buat proxy,
    edpwa.py muat naik ke Drive. Jalan dalam thread; status dalam doc edpwa/<id> (proses -> sedia / error)."""
    root = os.path.expanduser("~/Desktop/WORK 2026/CLAUDE EDITS")
    stage, item = _safe_name(inp.get("stage")), _safe_name(inp.get("item"))
    folder = os.path.join(root, stage, item)
    if not stage or not item or not os.path.isdir(folder):
        raise RuntimeError("Folder tak dijumpai: %s/%s" % (stage, item))
    title = str(inp.get("name") or item)[:60]
    out = os.path.join(folder, "editor", "sendiri")
    sys.path.insert(0, HOME)
    import edpwa
    vid = edpwa.vid_of(out)
    now = int(time.time() * 1000)
    sheet.call("dset", path="edpwa/" + vid, data={"title": title, "status": "proses", "src": "sendiri", "created": now, "updated": now, "files": {}})
    threading.Thread(target=_ed_new_run, args=(sheet, folder, out, vid, title, cfg), daemon=True).start()
    return {"vid": vid}


def _ed_words(folder, clips, handle, cfg):
    """Caption untuk Edit sendiri: transkrip suara dalam bahagian klip yang masuk timeline (whisper local, percuma).
    Pulang (words, offsets) ikut format talking-head make_page: masa = offsets[fail] + saat dalam fail."""
    if backend(cfg) != "mlx":
        return [], {}
    import mlx_whisper
    ffmpeg = find_tool("ffmpeg") or "ffmpeg"
    words, offsets, cum = [], {}, 0.0
    tmp = tempfile.mkdtemp(prefix="ednew-")
    try:
        for c in clips:
            f = c["file"]
            if f in offsets:
                continue
            offsets[f] = round(cum, 3)
            cum += float(c.get("dur", c["out"])) + 1.0
            span = min(float(c.get("dur", c["out"])), 45.0)   # dengar 45 s pertama setiap klip
            wav = os.path.join(tmp, "a.wav")
            r = subprocess.run([ffmpeg, "-v", "error", "-y", "-i", os.path.join(folder, f), "-t", f"{span:.2f}", "-vn", "-ac", "1", "-ar", "16000", wav],
                               capture_output=True, timeout=300)
            if r.returncode != 0 or not os.path.exists(wav):
                continue
            with TLOCK:
                res = mlx_whisper.transcribe(wav, path_or_hf_repo=cfg["mlx_model"], language="ms", task="transcribe",
                                             condition_on_previous_text=False, word_timestamps=True, verbose=None)
            c["speech"] = False
            for sg in res.get("segments", []):
                if HALLU.match((sg.get("text") or "").strip()):
                    continue
                for x in sg.get("words", []) or []:
                    tx = (x.get("word") or "").strip()
                    if tx:
                        c["speech"] = True
                        words.append({"t": tx, "s": round(offsets[f] + x["start"], 3), "e": round(offsets[f] + x["end"], 3), "unsure": (x.get("probability") or 1) < 0.5})
        gc.collect()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return words, offsets


def _ed_new_run(sheet, folder, out, vid, title, cfg=None):
    def fail(msg):
        log.warning("Edit sendiri gagal (%s): %s", vid, msg)
        try:
            cur = sheet.call("dget", path="edpwa/" + vid).get("doc") or {}
            cur.update({"status": "error", "msg": str(msg)[:300], "updated": int(time.time() * 1000)})
            sheet.call("dset", path="edpwa/" + vid, data=cur)
        except Exception:
            pass
    try:
        ext = (".mp4", ".mov", ".m4v")
        files = sorted(f for f in os.listdir(folder) if f.lower().endswith(ext) and not f.startswith("."))
        if not files:   # footage dalam subfolder satu tingkat
            files = sorted(os.path.join(d, f) for d in os.listdir(folder) if os.path.isdir(os.path.join(folder, d)) and d not in ("editor", "page", "draft", "render", "VO")
                           for f in os.listdir(os.path.join(folder, d)) if f.lower().endswith(ext) and not f.startswith("."))
        if not files:
            return fail("Tiada video dalam folder ni")
        ffprobe = find_tool("ffprobe") or "ffprobe"
        clips = []
        for f in files[:30]:
            r = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", os.path.join(folder, f)],
                               capture_output=True, text=True, timeout=60)
            try:
                d = float(r.stdout.strip())
            except ValueError:
                continue
            if d >= 0.5:
                clips.append({"file": f, "in": 0, "out": round(min(d, 6.0), 2), "dur": round(d, 3)})
        if not clips:
            return fail("Video tak dapat dibaca")
        os.makedirs(out, exist_ok=True)
        pj = os.path.join(out, "project.json")
        proj = {"title": title, "src": "../..", "clips": [{k: c[k] for k in ("file", "in", "out")} for c in clips], "handle": 6.0}
        try:   # caption: transkrip suara (kalau ada) supaya tab Caption terus boleh guna
            words, offsets = _ed_words(folder, clips, 6.0, cfg or {})
            talky = sum(1 for c in clips if c.get("speech")) >= max(1, round(len(clips) * 0.6))
            # mod talking-head: editor potong sendiri ikut ayat (klip tanpa suara tak masuk), jadi hanya bila kebanyakan klip ada suara
            if len(words) >= 3 and talky:
                proj["clips"] = [{"file": c["file"], "in": 0, "out": round(min(c["dur"], 30.0), 2)} for c in clips]
                proj["handle"] = 10.0
                json.dump({"words": words}, open(os.path.join(out, "words.json"), "w"), ensure_ascii=False)
                proj.update({"talk": True, "words": "words.json", "offsets": offsets})
        except Exception as e:
            log.warning("Caption Edit sendiri dilangkau: %s", e)
        json.dump(proj, open(pj, "w"), ensure_ascii=False, indent=1)
        tpl = os.path.expanduser("~/.claude/assets/reel-page-template/make_page.py")
        env = dict(os.environ, EDPWA="0")
        r = subprocess.run([sys.executable, tpl, pj, out], capture_output=True, text=True, timeout=3600, env=env)
        if r.returncode != 0:
            return fail("make_page: " + (r.stderr or r.stdout)[-250:])
        r = subprocess.run([sys.executable, os.path.join(HOME, "edpwa.py"), out, "--title", title], capture_output=True, text=True, timeout=3600)
        if r.returncode != 0:
            return fail("edpwa: " + (r.stderr or r.stdout)[-250:])
        log.info("Edit sendiri sedia: %s (%d klip)", vid, len(clips))
    except Exception as e:
        fail(e)


def run_ed_draft(inp, sheet, cfg):
    """Butang Siap (Draf) dalam Editor PWA: render draf 540x960 terus di Mac mini dengan render_draft.py (0 token Claude),
    muat naik ke Drive EDITOR PWA/<id>/draft.mp4, status dalam doc edpwa/<id> medan draft {status, id, at, msg}."""
    vid = re.sub(r"[^a-z0-9-]", "", str(inp.get("vid") or ""))
    doc = sheet.call("dget", path="edpwa/" + vid).get("doc") or {}
    if not doc.get("project") or not os.path.isfile(doc["project"]):
        raise RuntimeError("project.json untuk video ni tak dijumpai; minta Claude render")
    doc["draft"] = {"status": "proses", "at": int(time.time() * 1000)}
    sheet.call("dset", path="edpwa/" + vid, data=doc)
    threading.Thread(target=_ed_draft_run, args=(sheet, vid, doc), daemon=True).start()
    return {"vid": vid}


def _ed_draft_run(sheet, vid, doc):
    def put(**kw):
        cur = sheet.call("dget", path="edpwa/" + vid).get("doc") or doc
        cur["draft"] = dict(kw, at=int(time.time() * 1000))
        sheet.call("dset", path="edpwa/" + vid, data=cur)
    try:
        base = "edx/%s~edits~current" % vid
        ed = sheet.call("dget", path=base).get("doc")
        if ed and ed.get("_c"):
            ed = json.loads("".join((sheet.call("dget", path="%s~c%d" % (base, i)).get("doc") or {}).get("s", "") for i in range(int(ed["_c"]))))
        build = os.path.join(HOME, "ed_drafts", vid)
        shutil.rmtree(build, ignore_errors=True)
        os.makedirs(build, exist_ok=True)
        edits = os.path.join(build, "edits.json")
        if ed:
            json.dump(ed, open(edits, "w"), ensure_ascii=False)
        tpl = os.path.expanduser("~/.claude/assets/reel-page-template/render_draft.py")
        env = dict(os.environ, PATH="/opt/homebrew/bin:/usr/local/bin:" + os.environ.get("PATH", ""))
        r = subprocess.run([sys.executable, tpl, doc["project"], edits if ed else "none", build], capture_output=True, text=True, timeout=5400, env=env)
        mp4 = os.path.join(build, "draft", "draft_540.mp4")
        if r.returncode != 0 or not os.path.isfile(mp4):
            return put(status="error", msg=("render: " + (r.stderr or r.stdout)[-240:]).strip())
        pid = sheet.call("dpath", base="studio", path=["EDITOR PWA", vid], share=True)["id"]
        old = (doc.get("draft") or {}).get("id")
        fid = drive_upload(sheet, mp4, pid, "draft.mp4")
        if old and old != fid:
            try:
                sheet.call("dtrash", id=old)
            except Exception:
                pass
        put(status="sedia", id=fid, mb=round(os.path.getsize(mp4) / 1e6, 1))
        shutil.rmtree(build, ignore_errors=True)
        log.info("Draf Editor PWA siap: %s", vid)
    except Exception as e:
        log.exception("Draf Editor PWA gagal: %s", vid)
        try:
            put(status="error", msg=str(e)[:240])
        except Exception:
            pass


_ANSI = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[()][A-Z0-9]|[\x00-\x08\x0b-\x1f]")


def _watch_session(sheet, ed_id, logf, limit=900):
    """Baca skrin sesi EDIT NOW: simpan link chat Remote Control ke tracker (butang Buka chat dalam Studio),
    atau tanda status kalau sesi tunggu jawapan di Mac mini (persediaan pertama kali / Trust folder / log masuk)."""
    end, last = time.time() + limit, ""
    while time.time() < end:
        time.sleep(4)
        try:
            raw = open(logf, encoding="utf-8", errors="ignore").read()[-200000:]
        except Exception:
            continue
        m = re.search(r"https://claude\.ai/code/[A-Za-z0-9_\-]+(?:\?[A-Za-z0-9_=&\-]+)?", raw)
        txt = _ANSI.sub("", raw)
        m = m or re.search(r"https://claude\.ai/code/[A-Za-z0-9_\-]+", txt)
        if m:
            _ed_merge(sheet, ed_id, {"chat": m.group(0), "status": "Sesi jalan"})
            return
        tail = txt[-3000:].lower()
        st = ("Perlu persediaan di Mac mini" if "text style" in tail or "choose the text" in tail else
              "Perlu jawab Trust di Mac mini" if "trust" in tail and "folder" in tail else
              "Perlu log masuk di Mac mini" if "log in" in tail or "login" in tail else "")
        if st and st != last:
            _ed_merge(sheet, ed_id, {"status": st})
            last = st
    if not last:
        _ed_merge(sheet, ed_id, {"status": "Sesi dibuka (tiada link)"})


def _ed_merge(sheet, ed_id, fields):
    try:
        cur = sheet.call("dget", path="editor/" + ed_id).get("doc") or {}
        if cur.get("status") not in ("Sesi dibuka", "Sesi jalan", None) and not str(cur.get("status", "")).startswith(("Perlu", "Sesi")):
            fields.pop("status", None)  # sesi dah sampai Storyboard / Draf: jangan undur status
        cur.update(fields)
        cur["updated"] = int(time.time() * 1000)
        sheet.call("dset", path="editor/" + ed_id, data=cur)
    except Exception as e:
        log.warning("Tak dapat kemas kini tracker %s: %s", ed_id, e)


JOB_PROMPT = """Ini screenshot (teks OCR) dan nota dari chat Shopee / TikTok / WhatsApp / email untuk content creator Malaysia @miracikcit.
Hari ini: {today}. Tarikh tanpa tahun: anggap tarikh akan datang yang paling dekat.

{text}

Tentukan jenis:
- "paid": brand bayar fee (duit) untuk content.
- "sample": barang percuma / kupon diskaun penuh / barter sebagai ganti review atau video (tiada fee duit).

Balas JSON dengan kunci:
kind ("paid" atau "sample"), brand (nama brand), product (nama produk penuh, ringkas, tanpa kod kedai), store (nama kedai / akaun kalau ada),
fee (paid sahaja: nombor RM sahaja, cth "800"; sample: ""), price (harga barang dalam RM, nombor sahaja, cth "708.10"; "" kalau tiada),
plat ("shopee", "tiktok" atau "whatsapp": dari mana job datang),
draftDate, postDate, submitDate (YYYY-MM-DD atau ""),
daysAfterReceive (nombor hari kalau deadline dikira dari tarikh terima barang, cth 7; 0 kalau tiada),
tasks (senarai tugasan, satu baris satu, Bahasa Melayu ringkas, cth "Ulasan Shopee 5 bintang (5 gambar + 1 video)"),
description (1-2 ayat Bahasa Melayu), deliverables (satu baris satu), requirements (syarat penting, satu baris satu),
contact (nama / nombor / email / nama kedai), clientName (nama syarikat kalau ada).
Kalau maklumat tiada, isi "". Jangan reka maklumat."""


def run_jobparse(inp, sheet, cfg):
    """Baca screenshot job (Apple Vision, percuma) + nota, kemudian Claude Opus (effort low) isi butiran job."""
    parts = []
    tool = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin", "ocr")
    for fid in (inp.get("files") or [])[:6]:
        if inp.get("local"):
            lines = json.loads(subprocess.run([tool, fid], capture_output=True, text=True, timeout=60).stdout or "[]")
        else:
            lines = run_ocr(fid, sheet).get("lines") or []
        parts.append("\n".join(str(l.get("t") or "") for l in sorted(lines, key=lambda l: (round(float(l.get("y") or 0), 2), float(l.get("x") or 0)))))
    if inp.get("text"):
        parts.append("NOTA:\n" + str(inp["text"]))
    text = "\n\n---\n\n".join(p for p in parts if p.strip())[:14000]
    if not text.strip():
        raise RuntimeError("Tiada teks dijumpai dalam screenshot")
    cli = find_tool("claude", [cfg.get("claude_cli")])
    if not cli:
        raise RuntimeError("Claude Code tak dijumpai dalam Mac mini.")
    cmd = [cli, "-p", JOB_PROMPT.format(today=inp.get("today") or time.strftime("%Y-%m-%d"), text=text),
           "--model", cfg.get("job_model", "claude-opus-5-5"), "--effort", cfg.get("job_effort", "low"), "--tools", "",
           "--system-prompt", AI_SYSTEM, "--no-session-persistence", "--output-format", "json", "--setting-sources", ""]
    with tempfile.TemporaryDirectory(prefix="miracikcit-job-") as tmp:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300, cwd=tmp)
    try:
        d = json.loads(r.stdout)
    except Exception:
        raise RuntimeError("Claude tak jawab: " + (r.stderr or r.stdout or "")[-300:])
    txt = str(d.get("result") or "")
    if d.get("is_error"):
        raise RuntimeError("Claude dalam Mac mini belum login atau had usage penuh: " + txt[:200])
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        raise RuntimeError("Jawapan Claude bukan JSON")
    u = d.get("usage") or {}
    return {"job": json.loads(m.group(0)), "usage": {"in": u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0), "out": u.get("output_tokens", 0)}}


def studio_jobs(sheet, cfg):
    try:
        jobs = sheet.call("jpoll").get("jobs", [])
    except Exception as e:
        log.warning("jpoll gagal: %s", e)
        return 0
    for j in jobs:
        try:
            sheet.call("jstart", id=j["id"])
            inp = j.get("input") or {}
            if j["type"] == "ai":
                outp = run_claude(inp.get("prompt", ""), cfg)
            elif j["type"] == "voice":
                outp = run_voice(inp.get("file", ""), sheet, cfg)
            elif j["type"] == "archive":
                outp = run_archive(inp, sheet)
            elif j["type"] == "listing_del":
                outp = run_listing_delete(inp, sheet)
            elif j["type"] == "nota":
                outp = run_nota(inp, sheet, cfg)
            elif j["type"] == "listing_restore":
                outp = run_listing_restore(inp, sheet)
            elif j["type"] == "listing_save":
                outp = run_listing_save(inp, sheet)
            elif j["type"] == "ocr":
                outp = run_ocr(inp.get("file", ""), sheet)
            elif j["type"] in ("broll_done", "best_done", "broll_start"):
                import footage
                outp = getattr(footage, "job_" + j["type"])(inp, sheet, drive_upload)
            elif j["type"] == "brtag":
                import brlib
                outp = brlib.job_brtag(inp, sheet)
            elif j["type"] == "disk_now":
                import brlib
                outp = brlib.job_disk_now(inp, sheet)
            elif j["type"] == "gaya_scan":
                import gaya
                outp = gaya.job_gaya_scan(inp, sheet, cfg, drive_upload, sys.modules[__name__])
            elif j["type"] == "gaya_del":
                import gaya
                outp = gaya.job_gaya_del(inp, sheet)
            elif j["type"] in ("vo_take", "vo_save", "vo_final", "vo_del"):
                import vo
                outp = getattr(vo, "job_" + j["type"])(inp, sheet, cfg, sys.modules[__name__])
            elif j["type"] == "ed_new":
                outp = run_ed_new(inp, sheet, cfg)
            elif j["type"] == "ed_draft":
                outp = run_ed_draft(inp, sheet, cfg)
            elif j["type"] == "ed_foot":   # footage dari folder lain untuk Editor PWA (0 token)
                import edfoot
                outp = edfoot.run(inp, sheet, cfg, sys.modules[__name__])
            elif j["type"] == "ed_send":
                outp = run_ed_send(inp, sheet, cfg)
            elif j["type"] == "edit_now":
                outp = run_edit_now(inp, sheet, cfg)
            elif j["type"] == "foot_in":   # UPLOAD FOOTAGE dari kad Shoot (0 token)
                import footin
                outp = footin.run(inp, sheet, sys.modules[__name__])
            elif j["type"] == "folder_peek":   # gambar grid footage folder edit (tab Edit, 0 token)
                import peek
                outp = peek.run(inp, sheet, sys.modules[__name__])
            elif j["type"] == "mkfolder":
                outp = run_mkfolder(inp, sheet)
            elif j["type"] == "jobparse":
                outp = run_jobparse(inp, sheet, cfg)
            elif j["type"] == "scan":
                outp = push_scan(sheet, force=True) or {}
            else:
                raise RuntimeError("jenis kerja tak dikenali")
            sheet.call("jdone", id=j["id"], output=outp)
            log.info("Kerja Studio %s siap (%s)", j["type"], j["id"])
        except Exception as e:
            log.exception("Kerja Studio gagal: %s", j.get("id"))
            try:
                sheet.call("jdone", id=j["id"], error=str(e)[:400])
            except Exception:
                pass
    return len(jobs)


# ---------------------------------------------------------------- gelung utama
def heartbeat(sheet, stop):
    while not stop.wait(60):
        try:
            sheet.call("ping")
        except Exception as e:
            log.warning("ping gagal: %s", e)


def main():
    setup_log()
    if len(sys.argv) >= 3 and sys.argv[1] == "--test":
        cfg = load_cfg()
        log.info("Ujian: backend=%s model=%s", backend(cfg), cfg["ollama_model"])
        print(json.dumps(process({"link": sys.argv[2], "status": "Dalam giliran"}, cfg), ensure_ascii=False, indent=2))
        return
    log.info("Worker mula (backend %s, %s)", backend(load_cfg()), platform.machine())
    first, stop, hb = True, threading.Event(), None
    while True:
        cfg = load_cfg()
        if not cfg["sheet_url"] or not cfg["key"]:
            log.info("Belum ada URL Apps Script dalam config.json. Jalankan sambung.command.")
            time.sleep(60)
            continue
        sheet = Sheet(cfg)
        if hb is None:
            hb = threading.Thread(target=heartbeat, args=(sheet, stop), daemon=True)
            hb.start()
        try:
            jobs = sheet.call("poll", reset=first).get("jobs", [])
            first = False
        except Exception as e:
            log.warning("Tak dapat capai Sheet: %s", e)
            time.sleep(cfg["poll_seconds"])
            continue
        for job in jobs:
            if not ollama_ready(cfg):
                log.info("Ollama belum sedia; tunggu")
            try:
                sheet.update(job, status="Sedang transkrip", ralat="")
                process(job, cfg, sheet)
            except Exception as e:
                log.exception("Gagal: %s", job.get("link"))
                try:
                    sheet.update(job, status="Gagal", ralat=str(e)[:500], tarikh_siap=now_iso())
                except Exception:
                    log.exception("Tak dapat tulis status Gagal")
        n = studio_jobs(sheet, cfg)
        try:
            import brlib
            brlib.quick(sheet)          # kiraan B-roll, library, ruang, hard disk (thread sendiri, tiada token)
        except Exception as e:
            log.warning("brlib gagal: %s", e)
        try:
            push_scan(sheet)
        except Exception as e:
            log.warning("scan gagal: %s", e)
        if not jobs and not n:
            time.sleep(cfg.get("studio_poll_seconds", 30))


if __name__ == "__main__":
    main()
