"""Tiru Gaya: Mira tampal link video rujukan (Drive, TikTok, IG...) dalam Studio > Editor > Style.

Mac mini buat kerja berat tanpa token: muat turun, transkrip, kesan potongan (rentak cut), panjang, BPM,
OCR teks atas skrin, satu scan sheet 12 frame dan jalur effect (12 frame rapat) untuk masa yang Mira tanda.
Kemudian Claude Opus (effort low) baca sekali sahaja dan tulis kad gaya ke koleksi `gaya/<id>` status `semak`.
Mira luluskan dalam Studio. Video yang dimuat turun dibuang sebaik scan siap; hanya scan sheet + preview kecil
disimpan dalam Drive FOOTAGE/GAYA/<id>.
"""
import base64, json, logging, os, re, shutil, subprocess, tempfile, threading, time

log = logging.getLogger("worker")
HOME = os.path.dirname(os.path.abspath(__file__))
FFMPEG = shutil.which("ffmpeg") or "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
FFPROBE = shutil.which("ffprobe") or "/opt/homebrew/opt/ffmpeg-full/bin/ffprobe"
OCR = os.path.join(HOME, "bin", "ocr")
FONT = "/System/Library/Fonts/Helvetica.ttc"
_lock = threading.Lock()
_running = set()

FIELDS = ["hook", "cut", "text", "font", "color", "transition", "zoom", "audio", "cta", "length"]

PROMPT = """Kau editor video Reels untuk @miracikcit. Tengok video rujukan ni dan tulis KAD GAYA supaya editor boleh tiru
STRUKTUR dan RUPA dia (bukan aset: jangan cadang guna muzik, logo, watermark, footage atau skrip mereka).

Fail untuk dibaca (guna tool Read, baca SEMUA fail serentak dalam satu langkah, jangan baca fail lain):
- Scan sheet 12 frame (masa tertulis di setiap frame): {scan}
{fxfiles}
Data yang Mac mini dah ukur (tepat, guna terus):
{data}

Nota Mira: {note}
Tag yang Mira pilih: {tags}
Tag sedia ada: {alltags}

Kad gaya yang dah wujud (bandingkan; kalau hampir sama, isi "match"):
{existing}

Balas JSON sahaja:
{{"name":"nama pendek 2 perkataan, campur Melayu + English boleh, senang ingat (cth Pop Kilat, Diari Tenang)",
 "summary":"satu ayat rupa keseluruhan",
 "hook":"apa jadi 0-2 saat pertama, teks hook", "cut":"rentak potong (guna data cut)",
 "text":"gaya teks atas skrin: saiz, kedudukan, animasi masuk", "font":"jenis font paling dekat (font percuma)",
 "color":"grading / palet", "transition":"jenis transition", "zoom":"punch-in / gerakan kamera",
 "audio":"jenis muzik (mood, BPM dari data), SFX, VO atau tidak", "cta":"cara tutup + CTA", "length":"panjang + cadangan",
 "beats":["susunan babak ringkas, 4-8 baris, ikut masa"],
 "effects":[{{"name":"nama effect pendek","at":"masa","look":"apa nampak","recipe":"cara bina semula: lapisan, masa, nilai (zoom %, blur px, flash ms, ease)"}}],
 "tagsSuggest":["0-3 tag tambahan yang sesuai, guna tag sedia ada kalau padan"],
 "match":null atau {{"id":"id kad sedia ada","name":"nama","pct":0-100,"why":"apa yang sama"}}}}
Effect: tulis hanya effect yang betul-betul nampak (terutama dalam jalur effect). Kalau tiada, [].
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
def _fetch(sheet, link, tmp, ytdlp):
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
                return out, name
        except Exception as e:
            log.info("Drive dchunk tak jalan (%s), cuba yt-dlp", e)
    if not ytdlp:
        raise RuntimeError("yt-dlp tak dijumpai")
    cmd = [ytdlp, "--no-playlist", "--no-warnings", "-f", "bv*[height<=1920]+ba/b", "--merge-output-format", "mp4",
           "--ffmpeg-location", os.path.dirname(FFMPEG), "-o", os.path.join(tmp, "ref.%(ext)s"), link]
    r = _run(cmd, 900)
    files = [f for f in os.listdir(tmp) if f.startswith("ref.") and not f.endswith(".part")]
    if r.returncode or not files:
        hint = "Link Drive mesti boleh dibuka akaun Mira, atau dikongsi 'Anyone with the link'." if fid else "Video tak dapat dimuat turun."
        raise RuntimeError(hint + " (" + ((r.stderr or "").strip().splitlines() or ["?"])[-1][:200] + ")")
    return os.path.join(tmp, files[0]), ""


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
    texts = []
    for i, t in enumerate(times):
        f = _frame(src, t, os.path.join(tmp, f"o{i}.jpg"))
        for o in (_ocr(f) if f else []):
            texts.append({"s": t, "teks": o["t"], "atas_%": round(o["y"] * 100), "tinggi_%": round(o["h"] * 100, 1)})
    data["teks_atas_skrin"] = texts[:40]
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
    return info, data, scan, strips


# ---------------------------------------------------------------- Claude
def _claude(cfg, worker, tmp, scan, strips, data, doc, existing, alltags):
    cli = worker.find_tool("claude", [cfg.get("claude_cli")])
    if not cli:
        raise RuntimeError("Claude Code tak dijumpai dalam Mac mini.")
    fxfiles = "\n".join(f"- Jalur effect {s['a']:.1f}-{s['b']:.1f} s ({'Mira tanda' if s['mira'] else 'cut paling kuat'}): {s['img']}"
                        for s in strips)
    ex = "\n".join(f"- {g['id']}: {g.get('name')} [{', '.join(g.get('tags') or [])}] {(g.get('card') or {}).get('summary', '')}"
                   for g in existing) or "(belum ada)"
    prompt = PROMPT.format(scan=scan, fxfiles=fxfiles, data=json.dumps(data, ensure_ascii=False), note=doc.get("note") or "-",
                           tags=", ".join(doc.get("tags") or []) or "-", alltags=", ".join(alltags), existing=ex)
    cmd = [cli, "-p", prompt, "--model", cfg.get("gaya_model", "claude-opus-5-5"), "--effort", cfg.get("gaya_effort", "low"),
           "--tools", "Read", "--allowedTools", "Read", "--add-dir", tmp, "--system-prompt", worker.AI_SYSTEM,
           "--no-session-persistence", "--output-format", "json", "--setting-sources", "",
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


# ---------------------------------------------------------------- kerja
def _scan(sheet, cfg, up, worker, gid):
    path = "gaya/" + gid
    try:
        doc = sheet.call("dget", path=path).get("doc") or {}
        if not doc.get("link"):
            raise RuntimeError("Link tiada")
        _merge(sheet, path, {"status": "scan", "msg": "Muat turun video", "err": ""})
        pull = sheet.call("pull", since=0).get("docs", [])
        existing = [dict(x["d"], id=x["p"].split("/", 1)[1]) for x in pull
                    if x["p"].startswith("gaya/") and x.get("d") and x["d"].get("status") == "simpan"]
        st = next((x["d"] for x in pull if x["p"] == "settings/main" and x.get("d")), {}) or {}
        alltags = st.get("gayaTags") or []
        with tempfile.TemporaryDirectory(prefix="miracikcit-gaya-") as tmp:
            src, name = _fetch(sheet, doc["link"], tmp, worker.ytdlp_bin())
            _merge(sheet, path, {"msg": "Ukur rentak, transkrip, scan frame"})
            info, data, scan, strips = analyse(src, tmp, cfg, doc.get("fx"), worker)
            try:
                os.remove(src)                       # video rujukan tak disimpan
            except Exception:
                pass
            if doc.get("upload"):                    # video yang Mira upload dari phone: Drive ke Trash juga
                try:
                    sheet.call("dtrash", id=doc["upload"])
                except Exception as e:
                    log.info("Trash upload gagal: %s", e)
            _merge(sheet, path, {"msg": "Claude tulis kad gaya"})
            card, usage = _claude(cfg, worker, tmp, scan, strips, data, doc, existing, alltags)
            fid = sheet.call("dpath", base="studio", path=["FOOTAGE", "GAYA", gid], share=True)["id"]
            scan_id = up(sheet, scan, fid) if scan else None
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
        c = {k: card.get(k) or "" for k in FIELDS + ["summary"]}
        c["beats"] = card.get("beats") or []
        _merge(sheet, path, {"status": "semak", "msg": "", "name": card.get("name") or "Gaya baru", "card": c,
                             "tagsSuggest": [t for t in (card.get("tagsSuggest") or []) if t not in (doc.get("tags") or [])][:3],
                             "match": card.get("match") or None, "effects": fx, "data": {k: v for k, v in data.items() if k != "transkrip"},
                             "info": info, "srcName": name, "folder": fid, "scan": scan_id, "usage": usage,
                             "refs": [{"link": doc["link"], "note": doc.get("note") or "", "scan": scan_id, "at": int(time.time() * 1000)}]})
        log.info("Gaya %s siap: %s (%s token)", gid, card.get("name"), usage)
    except Exception as e:
        log.exception("Gaya %s gagal", gid)
        try:
            _merge(sheet, path, {"status": "error", "msg": str(e)[:300]})
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
