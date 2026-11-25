"""Resipi Style (dulu Tiru Gaya): Mira tampal link dalam Studio > Inspiration (atau upload fail video).

Mac mini buat kerja berat tanpa token: muat turun (yt-dlp), transkrip dalam bahasa asal, kesan scene cut (rentak),
panjang, BPM, 1 frame sesaat (OCR teks atas skrin sampai 180 s; sheet 12 frame untuk 60 s pertama), jalur hook 0-3 s
dan jalur effect. Kemudian Claude Opus (effort low) baca sekali dan tulis Resipi Style (Bahasa Melayu) ke koleksi
`gaya/<id>`: status `scan` (step download / analyse) -> `semak` (siap) atau `error` (step = tempat gagal).
Mira tekan suka (status `simpan`, like 1) atau tak suka (like -1). Link post teks (Threads dsb.): ambil teks sahaja
(kind `teks`). Video yang dimuat turun dibuang sebaik scan siap; thumbnail, sheet dan preview kecil sahaja disimpan
dalam Drive FOOTAGE/GAYA/<id>.
"""
import base64, html, json, sys, logging, os, random, re, shutil, subprocess, tempfile, threading, time, urllib.request

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
{want}
Tag yang Mira pilih: {tags}
Tag sedia ada: {alltags}

Resipi yang dah wujud (bandingkan; kalau hampir sama, isi "match"):
{existing}

Folder edit Mira (setiap satu ada gaya edit sendiri): {folders}

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
 "match":null atau {{"id":"id resipi sedia ada","name":"nama","pct":0-100,"why":"apa yang sama"}},
 "guess":{{"kind":"tips | rupa | template (SATU: apa yang paling berbaloi diambil dari video ni)",
          "say":"satu ayat pendek untuk Mira, mula dengan 'Video ni ...', cth 'Video ni orang ajar cara tulis hook.'"}},
 "tips":[{{"g":"Hook | Editing | Caption | Cerita | Audio | CTA","bila":"bila tip ni dipakai, 2-6 perkataan (cth 'vlog tempat', 'ada harga', 'semua video')","t":"apa perlu dibuat: satu ayat arahan pendek yang boleh terus dipakai masa edit"}}],
 "looks":[{{"type":"caption | tajuk | transition | effect","name":"nama 2 perkataan","d":"apa nampak, paling banyak 8 perkataan",
           "at":"masa contoh","recipe":"cara bina semula: font percuma, saiz (% tinggi skrin), warna hex, latar / outline, posisi (% dari atas), animasi (jenis, ms, ease)"}}],
 "template":null atau {{"slots":[{{"name":"nama bahagian pendek","a":saat mula,"b":saat tamat,"d":"apa isi: jenis shot, berapa shot, panjang shot, teks"}}],
                       "need":[{{"n":bilangan,"what":"jenis shot yang Mira perlu ada, 2-3 perkataan"}}]}},
 "folder":"nombor folder edit Mira yang paling sesuai untuk gaya ni (cth 21)"}}
tips: HANYA kalau orang dalam video mengajar / berkongsi tips (isi dari transkrip), paling banyak 8; kalau tiada, [].
looks: hanya rupa teks / transition / effect yang betul-betul tersendiri dan nampak dalam frame, paling banyak 4; kalau biasa sahaja, [].
template: isi kalau susunan video jelas dan boleh diulang dengan footage lain (3-7 slot ikut masa); video orang bercakap mengajar biasanya null.
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
 "tagsSuggest":["0-3 tag yang sesuai, guna tag sedia ada kalau padan"],
 "guess":{{"kind":"tips","say":"satu ayat pendek untuk Mira, mula dengan 'Post ni ...'"}},
 "tips":[{{"g":"Hook | Editing | Caption | Cerita | CTA","t":"satu ayat arahan pendek yang boleh terus dipakai, diambil dari isi atau cara tulis post ni"}}],
 "folder":"nombor folder edit Mira yang paling sesuai (cth 25)"}}
tips: paling banyak 8. Folder edit Mira: {folders}
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


def analyse(src, tmp, cfg, fx, worker, prog=lambda p, m: None):
    info = _probe(src)
    dur = info["dur"] or 1
    prog(35, "Analysing: kesan scene cut")
    cuts = _cuts(src)
    gaps = [b - a for a, b in zip([0] + [c[0] for c in cuts], [c[0] for c in cuts] + [dur])]
    data = {"panjang_s": dur, "saiz": f"{info['w']}x{info['h']}", "jumlah_cut": len(cuts),
            "purata_shot_s": round(sum(gaps) / len(gaps), 2) if gaps else dur,
            "shot_terpendek_s": round(min(gaps), 2) if gaps else dur,
            "masa_cut": [c[0] for c in cuts][:80]}
    trans, lang = "", ""
    if info["audio"]:
        prog(42, "Analysing: transkrip")
        wav = worker.to_wav(src, tmp)
        lang, segs = worker.transcribe(wav, cfg)
        trans = "\n".join(f"[{s:.1f}] {t}" for s, _, t in segs)[:6000]
        bpm, hits = _bpm(wav)
        data.update({"bahasa": lang, "bpm_anggaran": bpm, "bunyi_kuat_setiap_10s": hits,
                     "ada_cakap": bool(segs), "transkrip": trans or "(tiada cakap)"})
    else:
        data["audio"] = "tiada"
    prog(58, "Analysing: 1 frame sesaat")
    times = [round((i + 0.5) * dur / 12, 2) for i in range(12)]
    scan, _ = _sheet(src, times, os.path.join(tmp, "scan.jpg"), tmp, "s")
    thumb = _frame(src, min(1.0, dur / 2), os.path.join(tmp, "thumb.jpg"), 480)
    # 1 frame sesaat: OCR (0 token) sampai OCR_S, sheet 12 frame untuk SHEET_S pertama
    _run([FFMPEG, "-y", "-loglevel", "error", "-t", str(OCR_S), "-i", src, "-vf", "fps=1,scale=720:-2", "-q:v", "4",
          os.path.join(tmp, "sec_%03d.jpg")], 600)
    secs = sorted(f for f in os.listdir(tmp) if f.startswith("sec_"))
    data["frame_sesaat"] = len(secs)
    texts, last, enters = [], None, []
    for i, f in enumerate(secs):
        now = []
        for o in _ocr(os.path.join(tmp, f)):
            now.append({"s": i, "teks": o["t"], "atas_%": round(o["y"] * 100), "tinggi_%": round(o["h"] * 100, 1)})
        key = "|".join(x["teks"] for x in now)
        if now and key != last:                 # teks sama pada saat berturut tak diulang
            texts.extend(now)
            if not enters or i - enters[-1] >= 3:
                enters.append(i)                # saat teks baru muncul: untuk jalur animasi
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
    # jalur teks masuk: 12 frame rapat (0.1 s) sebelum saat teks baru dikesan, supaya animasi teks nampak
    tstrips = []
    for k, i in enumerate(enters[:1] + enters[len(enters) // 2:len(enters) // 2 + 1] if len(enters) > 1 else enters[:1]):
        a = max(0.0, i - 1.0)
        path, _ = _sheet(src, [round(a + 0.1 * j, 2) for j in range(12)], os.path.join(tmp, f"teks{k}.jpg"), tmp, f"x{k}")
        if path:
            tstrips.append({"a": round(a, 1), "b": round(a + 1.1, 1), "img": path})
    return info, data, scan, strips, {"thumb": thumb, "sheets": sheets, "hook": hook, "tstrips": tstrips}


# ---------------------------------------------------------------- Claude
WANT_TXT = {"template": "template (susunan video)", "rupa": "rupa (looks: font, caption, tajuk, transition, effect)", "tips": "tips (pengajaran)"}


def _want(doc):
    """Mira tick dulu apa yang dia nak ambil (2026-11-25): Claude tak perlu meneka lagi."""
    return [k for k in ("template", "rupa", "tips") if k in (doc.get("want") or [])]


def _want_txt(doc):
    w = _want(doc)
    if not w:
        return ""
    skip = [k for k in ("template", "rupa", "tips") if k not in w]
    return ("MIRA DAH PILIH apa yang dia nak ambil dari video ni: " + ", ".join(WANT_TXT[k] for k in w) + ". Ini arahan, bukan tekaan. "
            f"guess.kind mesti \"{w[0]}\". Isi bahagian yang dipilih dengan teliti dan lengkap. "
            + ("Bahagian yang TAK dipilih biar kosong: " + ", ".join({"template": "template null", "rupa": "looks []", "tips": "tips []"}[k] for k in skip) + ". " if skip else "")
            + ("Tips: kalau orang dalam video tak mengajar apa-apa, tulis tips dari CARA video ni dibuat (hook, rentak, teks, muzik, penutup) yang boleh ditiru. " if "tips" in w else "")
            + ("Template: WAJIB isi walaupun video orang bercakap. " if "template" in w else "")
            + ("Rupa: tulis rupa teks / transition / effect yang nampak walaupun ringkas, dengan resipi lengkap. " if "rupa" in w else ""))


def _ask(cfg, worker, tmp, prompt, read=True, model=None, effort=None):
    cli = worker.find_tool("claude", [cfg.get("claude_cli")])
    if not cli:
        raise RuntimeError("Claude Code tak dijumpai dalam Mac mini.")
    cmd = [cli, "-p", prompt, "--model", model or cfg.get("gaya_model", "claude-opus-5-5"), "--effort", effort or cfg.get("gaya_effort", "low")]
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
    for ts in extra.get("tstrips") or []:
        files.append(f"- Jalur teks masuk {ts['a']}-{ts['b']} s (12 frame rapat, tengok animasi dan rupa teks): {ts['img']}")
    if scan and (not files or data.get("panjang_s", 0) > SHEET_S):
        files.append(f"- Scan sheet 12 frame sepanjang video: {scan}")
    files += [f"- Jalur effect {s['a']:.1f}-{s['b']:.1f} s ({'Mira tanda' if s['mira'] else 'cut paling kuat'}): {s['img']}"
              for s in strips]
    ex = "\n".join(f"- {g['id']}: {g.get('name')} [{', '.join(g.get('tags') or [])}] {(g.get('card') or {}).get('summary', '')}"
                   for g in existing) or "(belum ada)"
    prompt = PROMPT.format(files="\n".join(files), data=json.dumps(data, ensure_ascii=False), note=doc.get("note") or "-", want=_want_txt(doc),
                           tags=", ".join(doc.get("tags") or []) or "-", alltags=", ".join(alltags), existing=ex,
                           folders=_folders(worker))
    return _ask(cfg, worker, tmp, prompt)


def _folders(worker):
    try:
        return "; ".join(sorted(d for d in os.listdir(worker.STUDIO_BASE) if re.match(r"^(2[1-9]|3\d|4[0-2])\. ", d)))
    except Exception:
        return "-"


def _tid():
    return "t" + "".join(random.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(8))


def _extras(card, doc):
    """Bahagian Copy Style: tekaan, tips, rupa, template, cadangan folder. Pilihan Mira yang sedia ada tak ditindih."""
    def s(v, n=400):
        return str(v or "").strip()[:n]
    g = card.get("guess") if isinstance(card.get("guess"), dict) else {}
    kind = s(g.get("kind"), 12).lower()
    tips = [{"id": _tid(), "g": s(t.get("g"), 20) or "Editing", "bila": s(t.get("bila"), 60), "t": s(t.get("t") or t.get("buat"), 220), "on": True}
            for t in (card.get("tips") or []) if isinstance(t, dict) and s(t.get("t") or t.get("buat"))][:8]
    looks = [{"type": s(l.get("type"), 12).lower() or "effect", "name": s(l.get("name"), 40) or "Rupa", "d": s(l.get("d"), 90),
              "at": s(l.get("at"), 30), "recipe": s(l.get("recipe"), 900), "on": True}
             for l in (card.get("looks") or []) if isinstance(l, dict)][:4]
    tp = card.get("template") if isinstance(card.get("template"), dict) else None
    tpl = None
    if tp and tp.get("slots"):
        def num(v):
            try:
                return round(float(v), 1)
            except Exception:
                return 0
        tpl = {"slots": [{"name": s(x.get("name"), 40), "a": num(x.get("a")), "b": num(x.get("b")), "d": s(x.get("d"), 200)}
                         for x in tp["slots"] if isinstance(x, dict)][:8],
               "need": [{"n": int(num(x.get("n"))), "what": s(x.get("what"), 40)} for x in (tp.get("need") or []) if isinstance(x, dict)][:4]}
    want = _want(doc)
    if want:                                         # Mira dah pilih: buang bahagian lain, buka pada pilihan pertama yang ada isi
        tips, looks, tpl = (tips if "tips" in want else []), (looks if "rupa" in want else []), (tpl if "template" in want else None)
        kind = next((k for k in want if {"tips": tips, "rupa": looks, "template": tpl}[k]), want[0])
    elif kind not in ("tips", "rupa", "template") or not {"tips": tips, "rupa": looks, "template": tpl}[kind]:
        kind = "tips" if tips else "template" if tpl else "rupa" if looks else "template"
    m = re.search(r"\d{2}", s(card.get("folder"), 20))
    out = {"guess": {"kind": kind, "say": s(g.get("say"), 200)}, "folderSug": m.group(0) if m else ""}
    if not any(t.get("saved") for t in doc.get("tips") or []):
        out["tips"] = tips
    if not any(l.get("saved") for l in doc.get("looks") or []):
        out["looks"] = looks
    if not (doc.get("tpl") or {}).get("saved"):
        out["tpl"] = tpl
    return out


CACHE = os.path.join(HOME, "gaya_cache")


def _keep(gid, extra, scan):
    """Simpan sheet kecil dalam Mac mini supaya sesi 'bina rupa' boleh tengok frame asal (dibuang bersama resipi)."""
    d = os.path.join(CACHE, gid)
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d, exist_ok=True)
    for f in [extra.get("hook"), scan] + [x["img"] for x in (extra.get("sheets") or []) + (extra.get("tstrips") or [])]:
        if f and os.path.exists(f):
            shutil.copy(f, d)
    return d


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
        _merge(sheet, path, {"status": "scan", "step": step, "msg": "Downloading", "err": "", "pct": 8})
        prog = lambda p, m: _merge(sheet, path, {"pct": p, "msg": m})
        pull = sheet.call("pull", since=0).get("docs", [])
        existing = [dict(x["d"], id=x["p"].split("/", 1)[1]) for x in pull
                    if x["p"].startswith("gaya/") and x.get("d") and x["d"].get("status") == "simpan"]
        st = next((x["d"] for x in pull if x["p"] == "settings/main" and x.get("d")), {}) or {}
        alltags = st.get("gayaTags") or []
        with tempfile.TemporaryDirectory(prefix="miracikcit-gaya-") as tmp:
            src, name, post = _fetch(sheet, doc["link"], tmp, worker.ytdlp_bin())
            step = "analyse"
            if post:                                 # post teks (Threads dsb.): teks sahaja
                _merge(sheet, path, {"step": step, "msg": "Analysing: Claude baca post", "pct": 60})
                card, usage = _ask(cfg, worker, tmp, TEXT_PROMPT.format(link=doc["link"], text=post["text"],
                                   note=doc.get("note") or "-", want=_want_txt(doc), alltags=", ".join(alltags), folders=_folders(worker)), read=False)
                fid = thumb_id = None
                if post.get("thumb"):
                    fid = sheet.call("dpath", base="studio", path=["FOOTAGE", "GAYA", gid], share=True)["id"]
                    thumb_id = up(sheet, post["thumb"], fid)
                c = _card(card)
                tags = list(doc.get("tags") or []) or [t for t in (card.get("tagsSuggest") or []) if isinstance(t, str)][:3]
                _merge(sheet, path, dict(_extras(card, doc), **{"status": "semak", "step": "siap", "msg": "", "pct": 100, "kind": "teks", "name": card.get("name") or "Resipi baru",
                                     "card": c, "tags": tags, "tagsSuggest": [], "match": None, "effects": [], "text": post["text"],
                                     "srcName": post.get("title") or "", "folder": fid, "thumb": thumb_id, "scan": None, "usage": usage,
                                     "refs": [{"link": doc["link"], "note": doc.get("note") or "", "at": int(time.time() * 1000)}]}))
                log.info("Resipi teks %s siap: %s (%s token)", gid, card.get("name"), usage)
                _auto_edit(sheet, cfg, worker, gid)
                return
            _merge(sheet, path, {"step": step, "msg": "Analysing", "pct": 30})
            info, data, scan, strips, extra = analyse(src, tmp, cfg, doc.get("fx"), worker, prog)
            try:
                os.remove(src)                       # video rujukan tak disimpan
            except Exception:
                pass
            if doc.get("upload"):                    # video yang Mira upload dari phone: Drive ke Trash juga
                try:
                    sheet.call("dtrash", id=doc["upload"])
                except Exception as e:
                    log.info("Trash upload gagal: %s", e)
            _merge(sheet, path, {"msg": "Analysing: Claude tonton video", "pct": 72})
            _keep(gid, extra, scan)
            card, usage = _claude(cfg, worker, tmp, scan, strips, data, doc, existing, alltags, extra)
            fid = sheet.call("dpath", base="studio", path=["FOOTAGE", "GAYA", gid], share=True)["id"]
            prog(92, "Analysing: simpan gambar")
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
        _merge(sheet, path, dict(_extras(card, doc), **{"status": "semak", "step": "siap", "msg": "", "pct": 100, "kind": "video", "name": card.get("name") or "Resipi baru", "card": c,
                             "tags": tags, "tagsSuggest": sug, "thumb": thumb_id,
                             "match": card.get("match") or None, "effects": fx, "data": {k: v for k, v in data.items() if k != "transkrip"},
                             "info": info, "srcName": name, "folder": fid, "scan": scan_id, "usage": usage,
                             "refs": [{"link": doc["link"], "note": doc.get("note") or "", "scan": scan_id, "at": int(time.time() * 1000)}]}))
        log.info("Gaya %s siap: %s (%s token)", gid, card.get("name"), usage)
        _auto_edit(sheet, cfg, worker, gid)
    except Exception as e:
        log.exception("Gaya %s gagal", gid)
        try:
            _merge(sheet, path, {"status": "error", "step": step,
                                 "msg": ("Analisis gagal: " if step == "analyse" else "") + str(e)[:280]})
        except Exception:
            pass
    finally:
        _running.discard(gid)


def _auto_edit(sheet, cfg, worker, gid):
    """Link ditampal dari skrin Edit Style: lepas siap analisis, terus buka sesi edit ikut video tu."""
    try:
        doc = sheet.call("dget", path="gaya/" + gid).get("doc") or {}
        u = doc.get("useFor")
        if not u:
            return
        looks = [f"{gid}:{i}" for i, _ in enumerate(doc.get("looks") or [])]
        worker.run_edit_now({"stage": u.get("stage"), "name": u.get("name"), "key": u.get("key"),
                             "style": {"tpl": gid, "looks": looks, "fresh": True}}, sheet, cfg)
        _merge(sheet, "gaya/" + gid, {"useFor": None, "usedAuto": u.get("key")})
    except Exception as e:
        log.exception("Auto edit %s gagal", gid)
        _merge(sheet, "gaya/" + gid, {"useFor": None, "autoErr": str(e)[:200]})


MAX_WAJIB = 7


def library(sheet, no):
    """Semua yang Mira simpan untuk folder utama `no` (termasuk 'Semua folder' = '*')."""
    docs = [dict(x["d"], id=x["p"].split("/", 1)[1]) for x in sheet.call("pull", since=0).get("docs", [])
            if x["p"].startswith("gaya/") and x.get("d")]
    mine = [g for g in docs if str(g.get("fold") or "") in (str(no), "*")]
    tips = [{"id": t.get("id") or f"{g['id']}:{i}", "g": t.get("g"), "bila": t.get("bila") or "", "buat": t.get("t"), "t": t.get("t"),
             "tahap": "cuba" if t.get("lvl") == "cuba" else "wajib", "from": g.get("name")}
            for g in mine for i, t in enumerate(g.get("tips") or []) if t.get("saved")]
    for t in [t for t in tips if t["tahap"] == "wajib"][MAX_WAJIB:]:   # had tip wajib setiap folder, supaya betul-betul diikut
        t["tahap"] = "cuba"
    return docs, mine, tips


def brief(sheet, no, style):
    """Arahan gaya untuk satu sesi edit: template (susunan), rupa (teks / effect), tips folder."""
    docs, mine, tips = library(sheet, no)
    by = {g["id"]: g for g in docs}
    out = {"folder": str(no), "tips": [t for t in tips if t["tahap"] == "wajib"], "tips_cuba": [t for t in tips if t["tahap"] == "cuba"],
           "peraturan": "Tiru gaya dan susunan sahaja. JANGAN salin ayat, skrip, muzik, logo atau footage video rujukan. "
                        "Watermark, 9:16, safe zone, end card dan opening / ending berbeza kekal ikut peraturan Mira."}
    g = by.get(str((style or {}).get("tpl") or ""))
    if g:
        c = g.get("card") or {}
        out["template"] = {"nama": g.get("name"), "slots": (g.get("tpl") or {}).get("slots") or c.get("beats"),
                           "perlu": (g.get("tpl") or {}).get("need"), "hook": c.get("hook"), "rentak": c.get("cut"),
                           "audio": c.get("audio"), "penutup": c.get("cta"), "panjang": c.get("length"), "mesej_asal": c.get("message")}
    looks = []
    for ref in (style or {}).get("looks") or []:
        gid, _, i = str(ref).partition(":")
        L = (by.get(gid) or {}).get("looks") or []
        if i.isdigit() and int(i) < len(L):
            l = L[int(i)]
            looks.append({"nama": l.get("name"), "jenis": l.get("type"), "rupa": l.get("d"), "resipi": l.get("recipe"),
                          "kod_siap": l.get("built") or None})
    if looks:
        out["rupa"] = looks
    return out


def job_look_build(inp, sheet, cfg, worker):
    """Simpan rupa: buka sesi Claude di Mac mini untuk bina rupa tu + contoh 2 saat. Sesi tulis balik pct / sample."""
    gid, idx = str(inp.get("id") or ""), [int(i) for i in (inp.get("i") or [])]
    if not re.match(r"^[a-z0-9-]{4,40}$", gid) or not idx:
        raise RuntimeError("rupa tak sah")
    doc = sheet.call("dget", path="gaya/" + gid).get("doc") or {}
    looks = doc.get("looks") or []
    no = str(doc.get("fold") or doc.get("folderSug") or "21")
    mains = [d for d in os.listdir(worker.STUDIO_BASE) if d.startswith((no if no != "*" else "21") + ". ")]
    if not mains:
        raise RuntimeError("Folder utama tak dijumpai: " + no)
    for i in idx:
        if i < len(looks):
            looks[i].update({"saved": True, "st": "bina", "pct": 3, "err": ""})
    _merge(sheet, "gaya/" + gid, {"looks": looks})
    names = ", ".join(looks[i].get("name", "") for i in idx if i < len(looks))
    cache = os.path.join(CACHE, gid)
    me = os.path.join(HOME, "gaya.py")
    prompt = (f"BINA RUPA dari Studio > Copy Style (bukan edit video). Resipi: python3 ~/MiracikcitTranscribe/studio.py get gaya/{gid}. "
              f"Bina looks indeks {idx} ({names}) ikut medan recipe setiap satu; frame asal ada dalam {cache} (jalur teks*.jpg, hook.jpg, sec*.jpg). "
              "Ikut bahagian 'Kali pertama effect dibina' dalam skill edit-reel: bina dalam HyperFrames, simpan kod ke ~/.claude/assets/effects/<slug>/, "
              "render contoh 2 saat 540x960 dengan watermark atas satu klip neutral dari folder ni (teks contoh sendiri, JANGAN guna ayat / footage / logo asal). "
              f"Untuk SETIAP rupa: kemas kini kemajuan dengan python3 {me} look {gid} <indeks> '{{\"pct\":40}}' (kemudian 70), "
              f"muat naik contoh dengan python3 {me} sample {gid} <indeks> <fail.mp4> '<laluan kod>' (ini tanda siap). "
              f"Kalau gagal: python3 {me} look {gid} <indeks> '{{\"st\":\"gagal\",\"err\":\"sebab pendek\"}}'. "
              "JANGAN ubah editor, JANGAN deploy, JANGAN buat page artifact. Buang fail sementara ke Trash dan berhenti bila semua siap.")
    worker.open_claude_session(os.path.join(worker.STUDIO_BASE, mains[0]), "Rupa · " + (doc.get("name") or gid), prompt,
                               "rupa-" + gid, cfg)
    return {"ok": True}


FIX_MODEL, FIX_EFFORT = "claude-sonnet-5-5", "low"
CHAT_MODEL, CHAT_EFFORT = "claude-sonnet-5-5", "medium"
FIX_PROMPT = """Kau editor video Reels untuk @miracikcit. Ini HASIL SCAN satu video rujukan (dah dianalisis; kau TAK perlu tengok video).
Mira nak hasil ni dibetulkan ikut nota dia. Ubah hanya apa yang nota minta; yang lain kekal sama.

Hasil scan sekarang (JSON):
{cur}

Ringkasan video (untuk rujukan): {card}

NOTA MIRA: {nota}

Balas JSON sahaja, bentuk yang sama:
{{"guess":{{"kind":"tips | rupa | template","say":"satu ayat pendek untuk Mira"}},
 "tips":[{{"g":"Hook | Editing | Caption | Cerita | Audio | CTA","bila":"bila tip ni dipakai, 2-6 perkataan","t":"apa perlu dibuat, satu ayat arahan"}}],
 "looks":[{{"type":"caption | tajuk | transition | effect","name":"nama 2 perkataan","d":"apa nampak, paling banyak 8 perkataan","at":"masa contoh","recipe":"cara bina semula"}}],
 "template":null atau {{"slots":[{{"name":"nama bahagian","a":saat mula,"b":saat tamat,"d":"apa isi"}}],"need":[{{"n":bilangan,"what":"jenis shot"}}]}}}}
Tulis dalam Bahasa Melayu. Jangan salin ayat asal video."""


def fix_merge(doc, card):
    """Gabung hasil 'Betulkan dengan nota' ke doc: bahagian baru ganti cadangan lama; tip / rupa yang tak berubah kekal
    id, simpanan, tahap dan kiraan. Nota Mira boleh minta bahagian yang dulu tak ditick, jadi `want` tak dipakai di sini."""
    new = _extras(card, {})
    old_t = {(t.get("t") or "").strip(): t for t in doc.get("tips") or []}
    for t in new.get("tips") or []:
        o = old_t.get((t.get("t") or "").strip())
        if o:
            t.update({k: o[k] for k in ("id", "on", "saved", "lvl", "used", "hit", "miss") if k in o})
    old_l = {l.get("name"): l for l in doc.get("looks") or []}
    for l in new.get("looks") or []:
        o = old_l.get(l.get("name"))
        if o:
            l.update({k: o[k] for k in ("on", "saved", "st", "pct", "sample", "built") if k in o})
    if new.get("tpl") and (doc.get("tpl") or {}).get("saved"):
        new["tpl"]["saved"] = True
    new.pop("folderSug", None)
    return new


def _fix(sheet, cfg, worker, gid, nota):
    path = "gaya/" + gid
    try:
        doc = sheet.call("dget", path=path).get("doc") or {}
        c = doc.get("card") or {}
        cur = {"guess": doc.get("guess"), "tips": [{k: t.get(k) for k in ("g", "bila", "t")} for t in doc.get("tips") or []],
               "looks": [{k: l.get(k) for k in ("type", "name", "d", "at", "recipe")} for l in doc.get("looks") or []],
               "template": {k: (doc.get("tpl") or {}).get(k) for k in ("slots", "need")} if doc.get("tpl") else None}
        brief_card = {k: c.get(k) for k in ("summary", "hook", "cut", "text", "font", "transition", "audio", "cta", "length", "message", "beats") if c.get(k)}
        prompt = FIX_PROMPT.format(cur=json.dumps(cur, ensure_ascii=False), card=json.dumps(brief_card, ensure_ascii=False)[:6000], nota=nota)
        with tempfile.TemporaryDirectory() as tmp:
            card, usage = _ask(cfg, worker, tmp, prompt, read=False, model=cfg.get("fix_model", FIX_MODEL), effort=cfg.get("fix_effort", FIX_EFFORT))
        _merge(sheet, path, dict(fix_merge(doc, card), fix={"st": "siap", "at": int(time.time() * 1000), "nota": nota[:200], "usage": usage}))
        log.info("Gaya %s dibetulkan dengan nota (%s token)", gid, usage)
    except Exception as e:
        log.exception("Betulkan gaya %s gagal", gid)
        try:
            _merge(sheet, path, {"fix": {"st": "error", "at": int(time.time() * 1000), "msg": str(e)[:200]}})
        except Exception:
            pass
    finally:
        _running.discard("fix:" + gid)


def job_gaya_fix(inp, sheet, cfg, worker):
    """Betulkan dengan nota: Claude Sonnet (low) baca hasil scan yang tersimpan + nota Mira, tanpa tonton video."""
    gid, nota = str(inp.get("id") or ""), re.sub(r"\s+", " ", str(inp.get("nota") or "")).strip()[:500]
    if not re.match(r"^[a-z0-9-]{4,40}$", gid) or not nota:
        raise RuntimeError("nota kosong atau id tak sah")
    with _lock:
        if "fix:" + gid in _running:
            return {"started": False}
        _running.add("fix:" + gid)
    _merge(sheet, "gaya/" + gid, {"fix": {"st": "proses", "at": int(time.time() * 1000)}})
    threading.Thread(target=_fix, args=(sheet, cfg, worker, gid, nota), daemon=True).start()
    return {"started": True}


def job_gaya_chat(inp, sheet, cfg, worker):
    """Chat Claude: buka Terminal Mac mini (Sonnet medium, Remote Control) yang dah tahu hasil scan ni. Hanya bila Mira tekan."""
    gid = str(inp.get("id") or "")
    if not re.match(r"^[a-z0-9-]{4,40}$", gid):
        raise RuntimeError("id gaya tak sah")
    doc = sheet.call("dget", path="gaya/" + gid).get("doc") or {}
    name = re.sub(r"[^\w .&+-]", "", str(doc.get("name") or "Style"))[:30] or "Style"
    os.makedirs(CACHE, exist_ok=True)
    prompt = (f"CHAT COPY STYLE \"{name}\". Mira nak tanya atau ubah hasil scan satu video rujukan. "
              f"Baca dulu: python3 ~/MiracikcitTranscribe/studio.py get gaya/{gid} (guess, tips, looks, tpl, card). "
              "Jawab pendek dalam Bahasa Melayu, langkah demi langkah. Kalau Mira minta ubah, tulis balik bahagian yang berubah sahaja dengan "
              f"python3 ~/MiracikcitTranscribe/studio.py merge gaya/{gid} '<json>' dan kekalkan medan id / saved / lvl / on setiap tip dan rupa. "
              f"JANGAN buka frame video kecuali Mira kata 'tonton semula'; frame scan ada dalam ~/MiracikcitTranscribe/gaya_cache/{gid}/ (kalau masih ada). "
              "Jangan salin ayat, skrip, muzik atau footage video asal. Mula dengan satu ayat: apa yang ada dalam hasil scan ni, kemudian tunggu soalan Mira.")
    logf = worker.open_claude_session(CACHE, "Copy Style · " + name, prompt, "gaya-chat-" + gid, cfg,
                                      model=cfg.get("chat_model", CHAT_MODEL), effort=cfg.get("chat_effort", CHAT_EFFORT), settings=False)
    _merge(sheet, "gaya/" + gid, {"chat": "", "chatSt": "Sesi dibuka", "chatAt": int(time.time() * 1000)})
    put = lambda f: _merge(sheet, "gaya/" + gid, {k: v for k, v in (("chat", f.get("chat")), ("chatSt", f.get("status"))) if v})
    threading.Thread(target=worker._watch_session, args=(sheet, "", logf), kwargs={"put": put}, daemon=True).start()
    return {"opened": True}


def tips_report(sheet, ed_id, items):
    """Sesi edit lapor tip mana dipakai: doc tipsrep/<ed_id>. Mira jawab Kena / Tak kena dalam tab Edit."""
    if not re.match(r"^[a-z0-9-]{4,60}$", ed_id) or not isinstance(items, list):
        raise RuntimeError("laporan tak sah")
    out = [{"id": str(x.get("id") or "")[:60], "tip": str(x.get("tip") or "")[:220], "pakai": bool(x.get("pakai")), "cara": str(x.get("cara") or "")[:220]}
           for x in items if isinstance(x, dict) and (x.get("id") or x.get("tip"))][:20]
    now = int(time.time() * 1000)
    sheet.call("dset", path="tipsrep/" + ed_id, data={"items": out, "at": now, "created": now, "updated": now})
    return len(out)


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
    if re.match(r"^[a-z0-9-]{4,40}$", gid):
        shutil.rmtree(os.path.join(CACHE, gid), ignore_errors=True)
    return {"ok": True}


def _cli(argv):
    """Dipanggil sesi Claude 'bina rupa': gaya.py look <gid> <i> '<json>' | gaya.py sample <gid> <i> <fail.mp4> [laluan kod]"""
    sys.path.insert(0, HOME)
    import worker
    cfg = worker.load_cfg()
    sheet = worker.Sheet(cfg)
    if argv[0] == "report":                         # gaya.py report <ed_id> '<json senarai>'
        print("OK", tips_report(sheet, argv[1], json.loads(argv[2])))
        return
    gid, i = argv[1], int(argv[2])
    doc = sheet.call("dget", path="gaya/" + gid).get("doc") or {}
    looks = doc.get("looks") or []
    if i >= len(looks):
        sys.exit("indeks rupa tiada")
    if argv[0] == "look":
        looks[i].update(json.loads(argv[3]))
    elif argv[0] == "sample":
        fid = doc.get("folder") or sheet.call("dpath", base="studio", path=["FOOTAGE", "GAYA", gid], share=True)["id"]
        looks[i].update({"sample": worker.drive_upload(sheet, argv[3], fid, name=f"rupa-{i}.mp4"), "st": "semak", "pct": 100,
                         "built": argv[4] if len(argv) > 4 else looks[i].get("built")})
        doc["folder"] = fid
    else:
        sys.exit("arahan tak dikenali")
    _merge(sheet, "gaya/" + gid, {"looks": looks, "folder": doc.get("folder")})
    print("OK")


if __name__ == "__main__":
    _cli(sys.argv[1:])
