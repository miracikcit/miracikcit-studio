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


def transcribe(wav, cfg):
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


def drive_upload(sheet, path, parent, name=None):
    """Apps Script buka sesi muat naik sekali guna; Mac mini hantar bait fail terus ke Drive."""
    size = os.path.getsize(path)
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    url = sheet.call("rstart", name=name or os.path.basename(path), parent=parent, size=size, mime=mime)["url"]
    with open(path, "rb") as fh:
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
            fid = drive_upload(sheet, os.path.join(tp, fn), parent)
            state[fn] = {"id": fid, "size": st.st_size, "mtime": int(st.st_mtime)}
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
    for f in files:
        drive_upload(sheet, f, parent_for(f))
    n = sheet.call("dcount", id=top)["n"]
    if n < len(files):
        raise RuntimeError("Drive ada %d fail, folder ada %d. Folder asal tak dibuang." % (n, len(files)))
    link = "https://drive.google.com/drive/folders/" + top
    _set_item(sheet, inp.get("item"), listingLink=link, listingAt=int(time.time() * 1000))
    trash_local(src)
    _scan_last["t"] = 0
    return {"link": link, "files": len(files)}


def run_listing_delete(inp, sheet):
    src = _listing_src(inp.get("folder"))
    trash_local(src)
    _set_item(sheet, inp.get("item"), listingGone=int(time.time() * 1000))
    _scan_last["t"] = 0
    return {"trashed": os.path.basename(src)}


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
                files.append({"name": fn, "size": st.st_size, "mtime": int(st.st_mtime * 1000), "drive": drv})
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
            push_scan(sheet)
        except Exception as e:
            log.warning("scan gagal: %s", e)
        if not jobs and not n:
            time.sleep(cfg.get("studio_poll_seconds", 30))


if __name__ == "__main__":
    main()
