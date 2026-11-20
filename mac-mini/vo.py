"""Tab VO (Studio): Mira rakam VO terus dari phone, Mac mini bersihkan tanpa token.

job vo_take: ambil rakaman (asset Drive), transkrip (whisper local), pecah ikut ayat, kumpul ayat yang diulang
             (default simpan yang terakhir), tanda ayat yang Mira tekan "Ulang ayat tadi". Tulis ke vo/<id> status `semak`.
job vo_save: potong ayat yang Mira simpan, buang senyap hujung depan/belakang setiap ayat, sambung ikut gap
             (tiada / sikit / asli), bersihkan bunyi latar + seragam kekuatan. Simpan VO.wav dalam folder projek
             (subfolder VO/), rakaman asal di VO/raw. Folder dalam 41. TUNGGU VO dipindah ke 28. EDIT + VO.
"""
import base64, difflib, logging, os, re, shutil, subprocess, tempfile, time

log = logging.getLogger("worker")
HOME = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HOME, "vo_cache")
BASE = os.path.expanduser("~/Desktop/WORK 2026/CLAUDE EDITS")
FFMPEG = shutil.which("ffmpeg") or "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
FILLER = re.compile(r"^(e+m+|a+h*|u+h+m*|h+m+|e+r+|a+a+)[\s.,!?]*$", re.I)
GAPS = {"tiada": 0.0, "sikit": 0.12}


def _merge(sheet, vid, fields):
    path = "vo/" + vid
    cur = sheet.call("dget", path=path).get("doc") or {"created": int(time.time() * 1000)}
    cur.update(fields)
    cur["updated"] = int(time.time() * 1000)
    sheet.call("dset", path=path, data=cur)
    return cur


def _norm(t):
    return re.sub(r"[^\w\s]", "", (t or "").lower()).split()


def _same(a, b):
    """Ayat b ialah ulangan ayat a (Mira cakap semula)."""
    wa, wb = _norm(a), _norm(b)
    if not wa or not wb:
        return False
    if len(wa) >= 2 and wa[:2] == wb[:2]:
        return True
    return difflib.SequenceMatcher(None, " ".join(wa), " ".join(wb)).ratio() >= 0.6


def group_segments(segs, marks):
    out, grp = [], 0
    for i, (s, e, t) in enumerate(segs):
        if i and not _same(segs[i - 1][2], t):
            grp += 1
        elif i == 0:
            grp = 0
        out.append({"s": round(s, 2), "e": round(e, 2), "t": t, "g": grp, "keep": True, "why": ""})
    for i, x in enumerate(out):
        if i + 1 < len(out) and out[i + 1]["g"] == x["g"]:
            x["keep"], x["why"] = False, "ulang"
        if FILLER.match(x["t"]):
            x["keep"], x["why"] = False, "emm"
    for m in marks or []:
        prev = [x for x in out if x["s"] < float(m)]
        if prev:
            prev[-1]["keep"], prev[-1]["why"] = False, "tanda"
    reps = {}
    for x in out:
        reps[x["g"]] = reps.get(x["g"], 0) + 1
    for x in out:
        x["n"] = reps[x["g"]]
    return out


def speech_regions(src, db=-38, minsil=0.2):
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", src, "-af", "silencedetect=n=%ddB:d=%s" % (db, minsil), "-f", "null", "-"],
                       capture_output=True, text=True, timeout=300)
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    total = int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3)) if dur else 1e9
    regs, cur = [], 0.0
    for i, a in enumerate(st):
        if a > cur:
            regs.append((cur, a))
        cur = en[i] if i < len(en) else total
    if cur < total:
        regs.append((cur, total))
    return [(a, b) for a, b in regs if b - a > 0.05]


def snap_segments(raw, segs):
    """Whisper bagi sempadan ayat kasar. Snap ke kawasan bersuara sebenar (silencedetect) supaya tiada sisa ayat jiran."""
    try:
        regs = speech_regions(raw)
    except Exception:
        return segs
    out = []
    for s, e, t in segs:
        inside = [(a, b) for a, b in regs if s <= (a + b) / 2 <= e]
        out.append((inside[0][0], inside[-1][1], t) if inside else (s, e, t))
    return out


def job_vo_take(inp, sheet, cfg, worker):
    vid, asset = str(inp.get("id") or ""), str(inp.get("asset") or "")
    if not re.match(r"^[\w-]+$", vid) or not asset:
        raise RuntimeError("id atau rakaman tiada")
    _merge(sheet, vid, {"status": "proses", "err": ""})
    try:
        f = sheet.call("file_get", id=asset)
        d = os.path.join(CACHE, vid)
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d)
        ext = os.path.splitext(f.get("name") or "")[1] or ".m4a"
        raw = os.path.join(d, "raw" + ext)
        with open(raw, "wb") as fh:
            fh.write(base64.b64decode(f["b64"]))
        with tempfile.TemporaryDirectory(prefix="miracikcit-vo-") as tmp:
            wav = worker.to_wav(raw, tmp)
            lang, segs = worker.transcribe(wav, cfg)
        if not segs:
            raise RuntimeError("Tiada suara dikesan dalam rakaman")
        segs = snap_segments(raw, segs)
        out = group_segments(segs, inp.get("marks"))
        _merge(sheet, vid, {"status": "semak", "take": {"asset": asset, "raw": os.path.basename(raw), "segs": out,
                                                         "dur": round(segs[-1][1], 1), "at": int(time.time() * 1000)}})
        return {"segs": len(out)}
    except Exception as e:
        _merge(sheet, vid, {"status": "error", "err": str(e)[:300]})
        raise


def _piece(raw, s, e, out, trim):
    af = ["atrim=start=%.3f:end=%.3f" % (max(0, s - 0.08), e + 0.15), "asetpts=PTS-STARTPTS"]
    if trim:
        sr = "silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.03"
        af += [sr, "areverse", sr, "areverse"]
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", raw, "-af", ",".join(af), "-ac", "1", "-ar", "48000", out],
                       capture_output=True, text=True, timeout=300)
    if r.returncode:
        raise RuntimeError("Potong VO gagal: " + (r.stderr or "")[-200:])


def _dest_folder(doc):
    folder, sub = str(doc.get("folder") or ""), str(doc.get("sub") or "")
    if not folder or not sub or "/" in folder + sub or ".." in folder + sub:
        return None
    p = os.path.join(BASE, folder, sub)
    return p if os.path.isdir(p) else None


def job_vo_save(inp, sheet, cfg, worker):
    vid = str(inp.get("id") or "")
    doc = sheet.call("dget", path="vo/" + vid).get("doc") or {}
    take = doc.get("take") or {}
    raw = os.path.join(CACHE, vid, str(take.get("raw") or ""))
    if not take or not os.path.isfile(raw):
        raise RuntimeError("Rakaman tiada dalam Mac mini. Rakam semula.")
    segs = take.get("segs") or []
    keep = set(int(i) for i in (inp.get("keep") or []))
    kept = [x for i, x in enumerate(segs) if i in keep]
    if not kept:
        raise RuntimeError("Tiada ayat dipilih")
    gap = str(inp.get("gap") or "tiada")
    _merge(sheet, vid, {"status": "simpan", "err": ""})
    try:
        with tempfile.TemporaryDirectory(prefix="miracikcit-vo-") as tmp:
            parts = []
            for n, x in enumerate(kept):
                pth = os.path.join(tmp, "p%03d.wav" % n)
                _piece(raw, float(x["s"]), float(x["e"]), pth, gap != "asli")
                parts.append(pth)
            g = GAPS.get(gap, 0.3)
            sil = os.path.join(tmp, "gap.wav")
            if g > 0:
                subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono",
                                "-t", str(g), sil], check=True, timeout=60)
            lst = os.path.join(tmp, "list.txt")
            with open(lst, "w") as fh:
                for i, pth in enumerate(parts):
                    if i and g > 0:
                        fh.write("file '%s'\n" % sil)
                    fh.write("file '%s'\n" % pth)
            joined = os.path.join(tmp, "joined.wav")
            subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined],
                           check=True, timeout=300)
            final = os.path.join(tmp, "VO.wav")
            r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", joined, "-af",
                                "highpass=f=80,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "1", final],
                               capture_output=True, text=True, timeout=300)
            if r.returncode:
                raise RuntimeError("Bersihkan VO gagal: " + (r.stderr or "")[-200:])
            proj = _dest_folder(doc)
            moved = ""
            if proj:
                vdir = os.path.join(proj, "VO")
                os.makedirs(os.path.join(vdir, "raw"), exist_ok=True)
                stamp = time.strftime("%Y%m%d-%H%M")
                outp = os.path.join(vdir, "VO-%s.wav" % stamp)
                shutil.copy(final, outp)
                shutil.copy(raw, os.path.join(vdir, "raw", "VO-%s-asal%s" % (stamp, os.path.splitext(raw)[1])))
                if doc.get("folder") == "41. TUNGGU VO":
                    dest = os.path.join(BASE, "28. EDIT + VO", doc["sub"])
                    if not os.path.exists(dest):
                        shutil.move(proj, dest)
                        moved = "28. EDIT + VO"
                        outp = os.path.join(dest, "VO", os.path.basename(outp))
            else:
                dl = os.path.expanduser("~/Downloads")
                outp = os.path.join(dl, "VO-%s-%s.wav" % (vid, time.strftime("%Y%m%d-%H%M")))
                shutil.copy(final, outp)
            dur = float(subprocess.run([os.path.join(os.path.dirname(FFMPEG), "ffprobe"), "-v", "error", "-show_entries", "format=duration",
                                        "-of", "csv=p=0", outp], capture_output=True, text=True).stdout.strip() or 0)
        shutil.rmtree(os.path.join(CACHE, vid), ignore_errors=True)
        try:
            sheet.call("file_delete", id=take.get("asset"))
        except Exception:
            pass
        rel = os.path.relpath(outp, BASE) if outp.startswith(BASE) else outp
        fields = {"status": "siap", "file": rel, "voDur": round(dur, 1), "done": int(time.time() * 1000)}
        if moved:
            fields["folder"] = moved
        _merge(sheet, vid, fields)
        try:
            worker._scan_last["t"] = 0
        except Exception:
            pass
        return {"file": rel, "dur": round(dur, 1), "moved": moved}
    except Exception as e:
        _merge(sheet, vid, {"status": "semak", "err": str(e)[:300]})
        raise
