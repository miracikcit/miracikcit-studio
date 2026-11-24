"""Resipi Style (dulu Tiru Gaya): Mira tampal link dalam Studio > Inspiration (atau upload fail video).

Mac mini buat kerja berat tanpa token: muat turun (yt-dlp), transkrip dalam bahasa asal, kesan scene cut (rentak),
panjang, BPM, 1 frame sesaat (OCR teks atas skrin sampai 180 s; sheet 12 frame untuk 60 s pertama), jalur hook 0-3 s
dan jalur effect. Kemudian Claude Opus (effort low) baca sekali dan tulis Resipi Style (Bahasa Melayu) ke koleksi
`gaya/<id>`: status `scan` (step download / analyse) -> `semak` (siap) atau `error` (step = tempat gagal).
Mira tekan suka (status `simpan`, like 1) atau tak suka (like -1). Link post teks (Threads dsb.): ambil teks sahaja
(kind `teks`). Video yang dimuat turun dibuang sebaik scan siap; thumbnail, sheet dan preview kecil sahaja disimpan
dalam Drive FOOTAGE/GAYA/<id>.
"""
import base64, html, json, logging, os, re, shutil, subprocess, tempfile, threading, time, urllib.request

log = logging.getLogger("worker")
HOME = os.path.dirname(os.path.abspath(__file__))
FFMPEG = shutil.which("ffmpeg") or "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
FFPROBE = shutil.which("ffprobe") or "/opt/homebrew/opt/ffmpeg-full/bin/ffprobe"
OCR = os.path.join(HOME, "bin", "ocr")
FONT = "/System/Library/Fonts/Helvetica.ttc"
_lock = threading.Lock()
_running = set()

FIELDS = ["hook", "cut", "text", "font", "color", "transition", "zoom", "audio", "cta", "length", "message", "why"]
SHEET_S = 60          # Claude baca 1 frame sesaat untuk 60 s pertama (pilihan Mira 24 Nov)
OCR_S = 180           # OCR 1 frame sesaat (0 token) sampai 180 s
TEXT_HOSTS = ("threads.net", "threads.com")


class DownloadError(RuntimeError):
    pass

PROMPT = """Kau editor video Reels untuk @miracikcit. Tengok video rujukan ni dan tulis RESIPI STYLE dalam Bahasa Melayu
supaya editor boleh tiru GAYA dan SUSUNAN dia dengan footage Mira sendiri (bukan aset: jangan cadang guna ayat, skrip,
muzik, logo, watermark atau footage mereka).

Fail untuk dibaca (guna tool Read, baca SEMUA fail serentak dalam satu langkah, jangan baca fail lain):
{files}
Data yang Mac mini dah ukur (tepat, guna terus):
{data}

Nota Mira: {note}
Tag yang Mira pilih: {tags}
Tag sedia ada: {alltags}

Resipi yang dah wujud (bandingkan; kalau hampir sama, isi "match"):
{existing}

Balas JSON sahaja:
{{"name":"nama pendek 2 perkataan, campur Melayu + English boleh, senang ingat (cth Pop Kilat, Diari Tenang)",
 "summary":"satu ayat rupa keseluruhan",
 "hook":"apa jadi dalam 3 saat pertama: shot, gerakan, teks hook, bunyi, dan teknik hook yang dipakai",
 "cut":"rentak: jumlah cut, purata panjang cut, bahagian laju / perlahan (guna data cut)",
 "text":"gaya teks atas skrin: posisi, saiz, warna, latar / outline, animasi masuk",
 "font":"jenis font paling dekat (font percuma)",
 "color":"grading / palet", "transition":"jenis transition dan effect peralihan", "zoom":"punch-in / gerakan kamera",
 "audio":"muzik (mood, BPM dari data), sound effect (bila dan jenis apa), VO atau tidak",
 "cta":"cara tutup + CTA", "length":"panjang + cadangan",
 "message":"mesej utama video, satu atau dua ayat",
 "why":"kenapa video ni menarik: 2-4 sebab yang boleh ditiru",
 "beats":["susunan cerita ikut masa, 4-8 baris: apa peranan setiap bahagian (hook, masalah, bukti, payoff, CTA...)"],
 "effects":[{{"name":"nama effect pendek","at":"masa","look":"apa nampak","recipe":"cara bina semula: lapisan, masa, nilai (zoom %, blur px, flash ms, ease)"}}],
 "tagsSuggest":["0-3 tag yang sesuai, guna tag sedia ada kalau padan"],
 "match":null atau {{"id":"id resipi sedia ada","name":"nama","pct":0-100,"why":"apa yang sama"}}}}
SEMUA kunci wajib ada (termasuk "text"); setiap nilai selain beats / effects / tagsSuggest / match ialah satu string.
Tulis gaya dan struktur sahaja; jangan salin ayat asal video (petik paling banyak 5 perkataan sebagai contoh).
Effect: tulis hanya effect yang betul-betul nampak. Kalau tiada, [].
"""

TEXT_PROMPT = """Kau penulis content untuk @miracikcit. Ini satu POST TEKS rujukan (bukan video). Tulis RESIPI STYLE dalam
Bahasa Melayu supaya Mira boleh tiru GAYA dan SUSUNAN dia dengan cerita sendiri. Jangan salin ayat asal.

Sumber: {link}
Teks post:
{text}

Nota Mira: {note}
Tag sedia ada: {alltags}

Balas JSON sahaja:
{{"name":"nama pendek 2 perkataan, senang ingat",
 "summary":"satu ayat rupa keseluruhan",
 "hook":"macam mana ayat pembuka tarik perhatian (teknik, bukan salin ayat)",
 "text":"gaya ayat: panjang ayat, nada, perenggan, emoji, tanda baca",
 "length":"panjang + cadangan",
 "cta":"cara tutup",
 "message":"mesej utama, satu atau dua ayat",
 "why":"kenapa post ni menarik: 2-4 sebab yang boleh ditiru",
 "beats":["susunan cerita, 3-7 baris: apa peranan setiap bahagian"],
 "tagsSuggest":["0-3 tag yang sesuai, guna tag sedia ada kalau padan"]}}
"""


def drive_id(link):
    m = re.search(r"/d/([A-Za-z0-9_-]{20,})", link or "") or re.search(r"[?&]id=([A-Za-z0-9_-]{20,})", link or "")
    return m.group(1) if m else None


def _merge(sheet, path, fields):
    cur = sheet.call("dget", path=path).get("doc") or {"created": int(time.time() * 1000)}
    cur.update(fields)
    cur["updated"] = int(time.time() * 1000)
    sheet.call("dset", path=path, data=cur)
    return cur


def _run(cmd, timeout=600):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


# ---------------------------------------------------------------- muat turun
def _host(link):
    m = re.match(r"^https?://([^/?#]+)", str(link or "").strip(), re.I)
    return (m.group(1).lower() if m else "").split(":")[0]


def _is_text_host(link):
    h = _host(link)
    return any(h == d or h.endswith("." + d) for d in TEXT_HOSTS)


def _og(link):
    """Baca og:description / og:image halaman (post teks). Pulang (teks, url gambar, tajuk)."""
    req = urllib.request.Request(link, headers={"User-Agent": "facebookexternalhit/1.1", "Accept-Language": "ms,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=30) as r:
        page = r.read(1500000).decode("utf-8", "replace")

    def meta(key):
        for pat in (r'<meta[^>]+(?:property|name)=["\']%s["\'][^>]*content=(["\'])(.*?)\1' % re.escape(key),
                    r'<meta[^>]+content=(["\'])(.*?)\1[^>]*(?:property|name)=["\']%s["\']' % re.escape(key)):
            m = re.search(pat, page, re.S | re.I)
            if m:
                return html.unescape(m.group(2)).strip()
        return ""
    return meta("og:description") or meta("description"), meta("og:image"), meta("og:title")


def _why(err):
    """Terjemah ralat yt-dlp jadi mesej yang Mira faham."""
    e = (err or "").lower()
    if "private" in e or "login" in e or "sign in" in e or "cookies" in e or "rate-limit" in e:
        return "Video ni private atau perlu log masuk."
    if "unsupported url" in e:
        return "Laman ni tak disokong."
    if "unavailable" in e or "not found" in e or "404" in e or "removed" in e or "does not exist" in e:
        return "Video dah dipadam atau link salah."
    if "timed out" in e or "resolve" in e or "connection" in e or "network" in e:
        return "Internet Mac mini bermasalah."
    if "no video" in e or "there is no video" in e:
        return "Post ni tak ada video."
    return "Video tak dapat dimuat turun."


def _fetch_text(link, tmp):
    try:
        text, img, title = _og(link)
    except Exception as e:
        raise DownloadError("Tak dapat buka link. Semak link tu boleh dibuka tanpa log masuk. (%s)" % str(e)[:120])
    if len(text) < 20:
        raise DownloadError("Tak jumpa teks pada link ni. Post mungkin private. Copy teksnya dan tampal dalam Threads > Gaya kau, atau upload fail video.")
    thumb = None
    if img.startswith("http"):
        try:
            thumb = os.path.join(tmp, "thumb.jpg")
            req = urllib.request.Request(img, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r, open(thumb, "wb") as fh:
                fh.write(r.read(8000000))
            _run([FFMPEG, "-y", "-loglevel", "error", "-i", thumb, "-vf", "scale=480:-2", "-q:v", "4", thumb + ".jpg"], 60)
            thumb = thumb + ".jpg" if os.path.exists(thumb + ".jpg") else None
        except Exception:
            thumb = None
    return {"text": text[:6000], "title": title[:160], "thumb": thumb}


def _fetch(sheet, link, tmp, ytdlp):
    """Pulang (laluan video, nama fail, None) atau (None, "", post teks)."""
    fid = drive_id(link)
    if fid:
        try:
            out, start, total, name = os.path.join(tmp, "ref.mp4"), 0, None, ""
            with open(out, "wb") as fh:
                while total is None or start < total:
                    r = sheet.call("dchunk", id=fid, start=start, len=15000000)
                    total, name = r["total"], r.get("name") or name
                    b = base64.b64decode(r["b64"])
                    if not b:
                        break
                    fh.write(b)
                    start += len(b)
            if os.path.getsize(out) > 0:
                return out, name, None
        except Exception as e:
            log.info("Drive dchunk tak jalan (%s), cuba yt-dlp", e)
    if _is_text_host(link):
        return None, "", _fetch_text(link, tmp)
    if not ytdlp:
        raise DownloadError("yt-dlp tak dijumpai dalam Mac mini. Upload fail video sebagai ganti.")
    cmd = [ytdlp, "--no-playlist", "--no-warnings", "-f", "bv*[height<=1920]+ba/b", "--merge-output-format", "mp4",
           "--ffmpeg-location", os.path.dirname(FFMPEG), "-o", os.path.join(tmp, "ref.%(ext)s"), link]
    try:
        r = _run(cmd, 900)
    except subprocess.TimeoutExpired:
        raise DownloadError("Download ambil masa lebih 15 minit, dihentikan. Upload fail video sebagai ganti.")
    files = [f for f in os.listdir(tmp) if f.startswith("ref.") and not f.endswith(".part")]
    if r.returncode or not files:
        last = ((r.stderr or "").strip().splitlines() or ["?"])[-1][:200]
        if fid:
            raise DownloadError("Link Drive mesti boleh dibuka akaun Mira, atau dikongsi 'Anyone with the link'. (" + last + ")")
        if re.search(r"no video|unsupported url", last, re.I):      # mungkin post teks / gambar
            try:
                return None, "", _fetch_text(link, tmp)
            except DownloadError:
                pass
        raise DownloadError(_why(last) + " Simpan video tu ke phone dan tekan Upload video sebagai ganti. (" + last + ")")
    return os.path.join(tmp, files[0]), "", None


# ---------------------------------------------------------------- ukur
def _probe(src):
    r = _run([FFPROBE, "-v", "error", "-print_format", "json", "-show_streams", "-show_format", src], 60)
    j = json.loads(r.stdout or "{}")
    v = next((s for s in j.get("streams", []) if s.get("codec_type") == "video"), {})
    has_a = any(s.get("codec_type") == "audio" for s in j.get("streams", []))
    w, h = int(v.get("width") or 0), int(v.get("height") or 0)
    rot = str((v.get("tags") or {}).get("rotate") or "")
    for sd in v.get("side_data_list") or []:
        rot = str(sd.get("rotation", rot))
    if rot.strip("-") in ("90", "270"):
        w, h = h, w
    return {"dur": round(float((j.get("format") or {}).get("duration") or 0), 2), "w": w, "h": h, "audio": has_a}


def _cuts(src):
    r = _run([FFMPEG, "-hide_banner", "-i", src, "-an", "-vf", "scale=240:-2,select='gt(scene,0.27)',metadata=print",
              "-f", "null", "-"], 900)
    out, t = [], None
    for line in r.stderr.splitlines():
        m = re.search(r"pts_time:([\d.]+)", line)
        if m:
            t = float(m.group(1))
        m = re.search(r"scene_score=([\d.]+)", line)
        if m and t is not None:
            out.append((round(t, 2), round(float(m.group(1)), 2)))
            t = None
    return out


def _bpm(wav):
    """Anggaran BPM dari envelope tenaga (numpy sahaja). Kasar tapi cukup untuk 'upbeat ~120'."""
    try:
        import numpy as np, wave
        with wave.open(wav) as w:
            sr, x = w.getframerate(), np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
        hop = 256
        n = len(x) // hop
        if n < 200:
            return None, 0
        e = np.log1p(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1)))
        on = np.maximum(0, np.diff(e))
        on -= on.mean()
        fps = sr / hop
        ac = np.correlate(on, on, "full")[len(on) - 1:]
        lo, hi = int(fps * 60 / 180), int(fps * 60 / 70)
        lag = lo + int(np.argmax(ac[lo:hi]))
        strong = int((on > on.std() * 3).sum())
        return round(60 * fps / lag), round(strong / (len(x) / sr) * 10, 1)
    except Exception as e:
        log.info("BPM gagal: %s", e)
        return None, 0


def _frame(src, t, out, width=None):
    vf = ["-vf", f"scale={width}:-2"] if width else []
    _run([FFMPEG, "-y", "-loglevel", "error", "-ss", f"{max(0, t):.2f}", "-i", src, "-frames:v", "1"] + vf + ["-q:v", "3", out], 60)
    return out if os.path.exists(out) else None


def _sheet(src, times, out, tmp, tag):
    """12 frame jadi satu grid 6x2 dengan masa tertulis."""
    ts = ",".join(f"{t:.2f}" for t in times)
    lab = os.path.join(tmp, tag + "_%02d.jpg")
    for i, t in enumerate(times):
        mm = f"{int(t // 60)}\\:{t % 60:04.1f}"
        _run([FFMPEG, "-y", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", src, "-frames:v", "1", "-vf",
              f"scale=270:480:force_original_aspect_ratio=decrease,pad=270:480:(ow-iw)/2:(oh-ih)/2,"
              f"drawtext=fontfile={FONT}:text='{mm}':x=8:y=h-34:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=5",
              "-q:v", "3", lab % i], 60)
    _run([FFMPEG, "-y", "-loglevel", "error", "-framerate", "1", "-i", lab, "-vf", "tile=6x2:padding=4:color=white",
          "-frames:v", "1", "-q:v", "3", out], 60)
    return out if os.path.exists(out) else None, ts


def _ocr(path):
    try:
        r = _run([OCR, path], 60)
        return [o for o in json.loads(r.stdout or "[]") if len(o.get("t", "").strip()) > 1]
    except Exception:
        return []


def _prev(src, a, b, out):
    _run([FFMPEG, "-y", "-loglevel", "error", "-ss", f"{a:.2f}", "-t", f"{max(0.6, b - a):.2f}", "-i", src,
          "-vf", "scale=-2:540", "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-c:a", "aac", "-b:a", "64k",
          "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], 180)
    return out if os.path.exists(out) else None


def _secs(s):
    s = str(s or "").strip()
    m = re.match(r"^(?:(\d+):)?(\d+(?:\.\d+)?)$", s)
    return (int(m.group(1) or 0) * 60 + float(m.group(2))) if m else None


def analyse(src, tmp, cfg, fx, worker):
    info = _probe(src)
    dur = info["dur"] or 1
    cuts = _cuts(src)
    gaps = [b - a for a, b in zip([0] + [c[0] for c in cuts], [c[0] for c in cuts] + [dur])]
    data = {"panjang_s": dur, "saiz": f"{info['w']}x{info['h']}", "jumlah_cut": len(cuts),
            "purata_shot_s": round(sum(gaps) / len(gaps), 2) if gaps else dur,
            "shot_terpendek_s": round(min(gaps), 2) if gaps else dur,
            "masa_cut": [c[0] for c in cuts][:80]}
    trans, lang = "", ""
    if info["audio"]:
        wav = worker.to_wav(src, tmp)
        lang, segs = worker.transcribe(wav, cfg)
        trans = "\n".join(f"[{s:.1f}] {t}" for s, _, t in segs)[:6000]
        bpm, hits = _bpm(wav)
        data.update({"bahasa": lang, "bpm_anggaran": bpm, "bunyi_kuat_setiap_10s": hits,
                     "ada_cakap": bool(segs), "transkrip": trans or "(tiada cakap)"})
    else:
        data["audio"] = "tiada"
    times = [round((i + 0.5) * dur / 12, 2) for i in range(12)]
    scan, _ = _sheet(src, times, os.path.join(tmp, "scan.jpg"), tmp, "s")
    thumb = _frame(src, min(1.0, dur / 2), os.path.join(tmp, "thumb.jpg"), 480)
    # 1 frame sesaat: OCR (0 token) sampai OCR_S, sheet 12 frame untuk SHEET_S pertama
    _run([FFMPEG, "-y", "-loglevel", "error", "-t", str(OCR_S), "-i", src, "-vf", "fps=1,scale=720:-2", "-q:v", "4",
          os.path.join(tmp, "sec_%03d.jpg")], 600)
    secs = sorted(f for f in os.listdir(tmp) if f.startswith("sec_"))
    data["frame_sesaat"] = len(secs)
    texts, last = [], None
    for i, f in enumerate(secs):
        now = []
        for o in _ocr(os.path.join(tmp, f)):
            now.append({"s": i, "teks": o["t"], "atas_%": round(o["y"] * 100), "tinggi_%": round(o["h"] * 100, 1)})
        key = "|".join(x["teks"] for x in now)
        if now and key != last:                 # teks sama pada saat berturut tak diulang
            texts.extend(now)
        last = key
    data["teks_atas_skrin"] = texts[:80]
    n = min(len(secs), SHEET_S, int(dur) + 1)
    sheets = []
    for k in range(0, n, 12):
        tt = [float(t) for t in range(k, min(k + 12, n))]
        path, _ = _sheet(src, tt, os.path.join(tmp, f"sec{k // 12}.jpg"), tmp, f"q{k // 12}")
        if path:
            sheets.append({"a": k, "b": k + len(tt) - 1, "img": path})
    h_end = min(3.0, dur)
    hook, _ = _sheet(src, [round(h_end * i / 11, 2) for i in range(12)], os.path.join(tmp, "hook.jpg"), tmp, "h")
    # jalur effect: masa yang Mira tanda; kalau tiada, sekitar cut paling kuat
    ranges = []
    for r in (fx or [])[:3]:
        a, b = _secs(r.get("a")), _secs(r.get("b"))
        if a is None:
            continue
        b = b if b and b > a else a + 1.0
        ranges.append((max(0, a - 0.2), min(dur, b + 0.2), True))
    if not ranges and cuts:
        t = max(cuts, key=lambda c: c[1])[0]
        ranges.append((max(0, t - 0.6), min(dur, t + 0.6), False))
    strips = []
    for k, (a, b, mine) in enumerate(ranges):
        tt = [round(a + (b - a) * i / 11, 2) for i in range(12)]
        path, _ = _sheet(src, tt, os.path.join(tmp, f"fx{k}.jpg"), tmp, f"f{k}")
        pv = _prev(src, a, b, os.path.join(tmp, f"fx{k}.mp4"))
        if path:
            strips.append({"a": round(a, 2), "b": round(b, 2), "mira": mine, "img": path, "mp4": pv})
    return info, data, scan, strips, {"thumb": thumb, "sheets": sheets, "hook": hook}


# ---------------------------------------------------------------- Claude
def _ask(cfg, worker, tmp, prompt, read=True):
    cli = worker.find_tool("claude", [cfg.get("claude_cli")])
    if not cli:
        raise RuntimeError("Claude Code tak dijumpai dalam Mac mini.")
    cmd = [cli, "-p", prompt, "--model", cfg.get("gaya_model", "claude-opus-5-5"), "--effort", cfg.get("gaya_effort", "low")]
    cmd += ["--tools", "Read", "--allowedTools", "Read", "--add-dir", tmp] if read else ["--tools", ""]
    cmd += ["--system-prompt", worker.AI_SYSTEM, "--no-session-persistence", "--output-format", "json", "--setting-sources", "",
            "--disable-slash-commands", "--strict-mcp-config", "--exclude-dynamic-system-prompt-sections"]
    r = _run(cmd, 900)
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
    return json.loads(m.group(0)), {"in": u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0),
                                    "cache": u.get("cache_read_input_tokens", 0), "out": u.get("output_tokens", 0),
                                    "turns": len(u.get("iterations") or [])}


def _claude(cfg, worker, tmp, scan, strips, data, doc, existing, alltags, extra=None):
    extra = extra or {}
    files = []
    if extra.get("hook"):
        files.append(f"- Jalur hook 0-3 s (12 frame rapat): {extra['hook']}")
    for sh in extra.get("sheets") or []:
        files.append(f"- 1 frame sesaat, saat {sh['a']}-{sh['b']} (masa tertulis di setiap frame): {sh['img']}")
    if scan and (not files or data.get("panjang_s", 0) > SHEET_S):
        files.append(f"- Scan sheet 12 frame sepanjang video: {scan}")
    files += [f"- Jalur effect {s['a']:.1f}-{s['b']:.1f} s ({'Mira tanda' if s['mira'] else 'cut paling kuat'}): {s['img']}"
              for s in strips]
    ex = "\n".join(f"- {g['id']}: {g.get('name')} [{', '.join(g.get('tags') or [])}] {(g.get('card') or {}).get('summary', '')}"
                   for g in existing) or "(belum ada)"
    prompt = PROMPT.format(files="\n".join(files), data=json.dumps(data, ensure_ascii=False), note=doc.get("note") or "-",
                           tags=", ".join(doc.get("tags") or []) or "-", alltags=", ".join(alltags), existing=ex)
    return _ask(cfg, worker, tmp, prompt)


def _card(card):
    def flat(v):
        if isinstance(v, (list, tuple)):
            return " • ".join(str(x).strip() for x in v if str(x).strip())
        return str(v or "").strip()
    c = {k: flat(card.get(k)) for k in FIELDS + ["summary"]}
    c["beats"] = [str(b) for b in (card.get("beats") or [])][:10]
    return c


# ---------------------------------------------------------------- kerja
def _scan(sheet, cfg, up, worker, gid):
    path = "gaya/" + gid
    step = "download"
    try:
        doc = sheet.call("dget", path=path).get("doc") or {}
        if not doc.get("link"):
            raise RuntimeError("Link tiada")
        _merge(sheet, path, {"status": "scan", "step": step, "msg": "Downloading", "err": ""})
        pull = sheet.call("pull", since=0).get("docs", [])
        existing = [dict(x["d"], id=x["p"].split("/", 1)[1]) for x in pull
                    if x["p"].startswith("gaya/") and x.get("d") and x["d"].get("status") == "simpan"]
        st = next((x["d"] for x in pull if x["p"] == "settings/main" and x.get("d")), {}) or {}
        alltags = st.get("gayaTags") or []
        with tempfile.TemporaryDirectory(prefix="miracikcit-gaya-") as tmp:
            src, name, post = _fetch(sheet, doc["link"], tmp, worker.ytdlp_bin())
            step = "analyse"
            if post:                                 # post teks (Threads dsb.): teks sahaja
                _merge(sheet, path, {"step": step, "msg": "Analysing: Claude tulis Resipi Style"})
                card, usage = _ask(cfg, worker, tmp, TEXT_PROMPT.format(link=doc["link"], text=post["text"],
                                   note=doc.get("note") or "-", alltags=", ".join(alltags)), read=False)
                fid = thumb_id = None
                if post.get("thumb"):
                    fid = sheet.call("dpath", base="studio", path=["FOOTAGE", "GAYA", gid], share=True)["id"]
                    thumb_id = up(sheet, post["thumb"], fid)
                c = _card(card)
                tags = list(doc.get("tags") or []) or [t for t in (card.get("tagsSuggest") or []) if isinstance(t, str)][:3]
                _merge(sheet, path, {"status": "semak", "step": "siap", "msg": "", "kind": "teks", "name": card.get("name") or "Resipi baru",
                                     "card": c, "tags": tags, "tagsSuggest": [], "match": None, "effects": [], "text": post["text"],
                                     "srcName": post.get("title") or "", "folder": fid, "thumb": thumb_id, "scan": None, "usage": usage,
                                     "refs": [{"link": doc["link"], "note": doc.get("note") or "", "at": int(time.time() * 1000)}]})
                log.info("Resipi teks %s siap: %s (%s token)", gid, card.get("name"), usage)
                return
            _merge(sheet, path, {"step": step, "msg": "Analysing: transkrip, scene cut, 1 frame sesaat"})
            info, data, scan, strips, extra = analyse(src, tmp, cfg, doc.get("fx"), worker)
            try:
                os.remove(src)                       # video rujukan tak disimpan
            except Exception:
                pass
            if doc.get("upload"):                    # video yang Mira upload dari phone: Drive ke Trash juga
                try:
                    sheet.call("dtrash", id=doc["upload"])
                except Exception as e:
                    log.info("Trash upload gagal: %s", e)
            _merge(sheet, path, {"msg": "Analysing: Claude tulis Resipi Style"})
            card, usage = _claude(cfg, worker, tmp, scan, strips, data, doc, existing, alltags, extra)
            fid = sheet.call("dpath", base="studio", path=["FOOTAGE", "GAYA", gid], share=True)["id"]
            scan_id = up(sheet, scan, fid) if scan else None
            thumb_id = up(sheet, extra["thumb"], fid) if extra.get("thumb") else None
            fx = []
            effs = card.get("effects") or []
            for k, s in enumerate(strips):
                e = effs[k] if k < len(effs) else {}
                fx.append({"id": f"{gid}-fx{k}", "name": e.get("name") or f"Effect {k + 1}", "at": e.get("at") or f"{s['a']:.1f}-{s['b']:.1f}s",
                           "look": e.get("look") or "", "recipe": e.get("recipe") or "", "a": s["a"], "b": s["b"], "on": True,
                           "strip": up(sheet, s["img"], fid), "prev": up(sheet, s["mp4"], fid) if s.get("mp4") else None})
            for e in effs[len(strips):]:
                fx.append({"id": f"{gid}-fx{len(fx)}", "name": e.get("name") or "Effect", "at": e.get("at") or "", "look": e.get("look") or "",
                           "recipe": e.get("recipe") or "", "on": True})
        c = _card(card)
        sug = [t for t in (card.get("tagsSuggest") or []) if isinstance(t, str) and t not in (doc.get("tags") or [])][:3]
        tags = list(doc.get("tags") or [])
        if not tags:                                 # borang baru tiada pilihan tag: guna cadangan Claude terus
            tags, sug = sug, []
        _merge(sheet, path, {"status": "semak", "step": "siap", "msg": "", "kind": "video", "name": card.get("name") or "Resipi baru", "card": c,
                             "tags": tags, "tagsSuggest": sug, "thumb": thumb_id,
                             "match": card.get("match") or None, "effects": fx, "data": {k: v for k, v in data.items() if k != "transkrip"},
                             "info": info, "srcName": name, "folder": fid, "scan": scan_id, "usage": usage,
                             "refs": [{"link": doc["link"], "note": doc.get("note") or "", "scan": scan_id, "at": int(time.time() * 1000)}]})
        log.info("Gaya %s siap: %s (%s token)", gid, card.get("name"), usage)
    except Exception as e:
        log.exception("Gaya %s gagal", gid)
        try:
            _merge(sheet, path, {"status": "error", "step": step,
                                 "msg": ("Analisis gagal: " if step == "analyse" else "") + str(e)[:280]})
        except Exception:
            pass
    finally:
        _running.discard(gid)


def job_gaya_scan(inp, sheet, cfg, up, worker):
    gid = str(inp.get("id") or "")
    if not re.match(r"^[a-z0-9-]{4,40}$", gid):
        raise RuntimeError("id gaya tak sah")
    with _lock:
        if gid in _running:
            return {"started": False, "msg": "sedang scan"}
        _running.add(gid)
    threading.Thread(target=_scan, args=(sheet, cfg, up, worker, gid), daemon=True).start()
    return {"started": True}


def job_gaya_del(inp, sheet):
    """Buang kad gaya: scan sheet + preview dalam Drive ke Trash, dokumen dipadam."""
    gid = str(inp.get("id") or "")
    doc = sheet.call("dget", path="gaya/" + gid).get("doc") or {}
    folder = inp.get("folder") or doc.get("folder")
    if folder and not inp.get("keepFiles"):
        sheet.call("dtrash", id=folder)
    sheet.call("dset", path="gaya/" + gid, data=None)
    return {"ok": True}
