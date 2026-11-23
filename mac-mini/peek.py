#!/usr/bin/env python3
"""Job folder_peek (2026-11-23, Mira): butang 'Lihat footage' pada kad tab Edit Studio.
Buat satu gambar grid (frame tengah setiap video dalam folder edit, maks 24) supaya Mira tahu folder tu video apa.
Gambar (data URL kecil) dalam doc, cache ikut mtime folder dalam doc peek/<slug>. 0 token."""
import json, os, re, shutil, subprocess, tempfile, time

VEXT = (".mp4", ".mov", ".m4v")
SKIP = {"build", "editor", "page", "render", "draft", "renders"}


def run(inp, sheet, W):
    main, _ = W._edit_main(inp.get("stage"))
    name = W._safe_name(inp.get("name"))
    folder = os.path.join(main, name)
    if not os.path.isdir(folder):
        raise RuntimeError("Folder tak dijumpai: " + name)
    vids = []
    for dp, dn, fn in os.walk(folder):
        dn[:] = sorted(d for d in dn if d.lower() not in SKIP and not d.startswith("."))
        if dp.count(os.sep) - folder.count(os.sep) > 1:
            continue
        vids += [os.path.join(dp, f) for f in sorted(fn) if f.lower().endswith(VEXT) and not f.startswith(".")]
    mt = int(max([os.path.getmtime(v) for v in vids] or [os.path.getmtime(folder)]))
    slug = re.sub(r"[^a-z0-9]+", "-", (os.path.basename(main) + "-" + name).lower()).strip("-")[:70]
    old = sheet.call("dget", path="peek/" + slug).get("doc") or {}
    if old.get("mt") == mt and old.get("img"):
        return old
    vids = vids[:24]
    names = [os.path.relpath(v, folder) for v in vids]
    img = ""
    if vids:
        ff = W.find_tool("ffmpeg") or "ffmpeg"
        tmp = tempfile.mkdtemp(prefix="peek-")
        try:
            for k, v in enumerate(vids, 1):
                o = os.path.join(tmp, "t%04d.jpg" % k)
                subprocess.run([ff, "-v", "error", "-y", "-ss", "1", "-i", v, "-frames:v", "1", "-vf",
                                "scale=90:160:force_original_aspect_ratio=increase,crop=90:160", "-q:v", "5", o], timeout=120)
                if not os.path.exists(o):
                    subprocess.run([ff, "-v", "error", "-y", "-i", v, "-frames:v", "1", "-vf",
                                    "scale=90:160:force_original_aspect_ratio=increase,crop=90:160", "-q:v", "5", o], timeout=120)
                if not os.path.exists(o):
                    subprocess.run([ff, "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=gray:s=90x160", "-frames:v", "1", o], timeout=60)
            cols = min(6, len(vids))
            rows = (len(vids) + cols - 1) // cols
            out = os.path.join(tmp, "peek.jpg")
            subprocess.run([ff, "-v", "error", "-y", "-framerate", "1", "-i", os.path.join(tmp, "t%04d.jpg"), "-vf", f"tile={cols}x{rows}:padding=3:color=white",
                            "-frames:v", "1", "-q:v", "4", out], timeout=120, check=True)
            import base64   # gambar terus dalam doc (Sheet sel maks 49k aksara): turunkan kualiti sampai muat
            for q in (6, 9, 13, 18, 25, 31):
                subprocess.run([ff, "-v", "error", "-y", "-i", out, "-q:v", str(q), os.path.join(tmp, "s.jpg")], timeout=60)
                b = open(os.path.join(tmp, "s.jpg"), "rb").read()
                if len(b) * 4 / 3 < 42000:
                    break
            img = "data:image/jpeg;base64," + base64.b64encode(b).decode()
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    doc = {"img": img, "names": names, "n": len(names), "mt": mt, "cols": min(6, max(1, len(names))), "folder": os.path.basename(main) + "/" + name, "at": int(time.time() * 1000)}
    sheet.call("dset", path="peek/" + slug, data=doc)
    return doc
