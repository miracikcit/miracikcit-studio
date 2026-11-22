#!/usr/bin/env python3
"""Hantar satu folder page editor (hasil make_page.py) ke Editor PWA Studio.

    python3 ~/MiracikcitTranscribe/edpwa.py "<folder page editor>" [--title "Nama"] [--local]

- Fail video (data.json, proxy.mp4, vo.mp3, poster, strip, photos/, br/, p1/...) dimuat naik ke Drive EDITOR PWA/<id>/.
- Fail kongsi (sfx/, music/, watermark.png) dimuat naik sekali sahaja ke EDITOR PWA/_shared/ dan diguna semula (ikut hash).
- Fail yang tak berubah sejak hantar lepas tak dimuat naik semula.
- Tulis doc Studio edpwa/<id> {title, dir, files{laluan: id Drive}} dan cetak link editor.
--local: tak upload; hanya daftar folder untuk uji di localhost (devserver.py /edlocal).
"""
import hashlib, json, mimetypes, os, re, sys, time, urllib.request

HOME = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(os.path.expanduser("~/MiracikcitTranscribe"), "config.json")))
STATE = os.path.expanduser("~/MiracikcitTranscribe/edpwa_state.json")
LOCALMAP = os.path.expanduser("~/MiracikcitTranscribe/edpwa_local.json")
APP_URL = "https://miracikcit.github.io/miracikcit-studio/editor/?v="
SHARED = ("sfx/", "music/", "watermark.png")
SKIP = re.compile(r"(^|/)(editor\.html|.*\.py|.*\.command|\.DS_Store|project\.json|__pycache__/.*)$")


def call(action, **kw):
    body = json.dumps(dict(kw, key=CFG["key"], action=action)).encode()
    req = urllib.request.Request(CFG["sheet_url"], data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.loads(r.read().decode())
    if not j.get("ok", True):
        raise RuntimeError(j.get("error") or action)
    return j


def upload(path, parent, name):
    size = os.path.getsize(path)
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    url = call("rstart", name=name, parent=parent, size=size, mime=mime)["url"]
    with open(path, "rb") as fh:
        req = urllib.request.Request(url, data=fh, method="PUT", headers={"Content-Length": str(size), "Content-Type": mime})
        with urllib.request.urlopen(req, timeout=1800) as r:
            return json.loads(r.read().decode())["id"]


def sha(path):
    h = hashlib.sha1()
    with open(path, "rb") as fh:
        for b in iter(lambda: fh.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()[:16]


def vid_of(d):
    """id pendek dari laluan: '<no folder utama>-<projek>[-<subfolder>]', cth 26-mm-mellow"""
    parts = os.path.abspath(d).split(os.sep)
    if "CLAUDE EDITS" in parts:
        parts = parts[parts.index("CLAUDE EDITS") + 1:]
    parts = [p for p in parts if p.lower() not in ("editor", "page", "build")]
    if parts:
        m = re.match(r"(\d+)", parts[0])
        parts = ([m.group(1)] if m else [parts[0]]) + parts[1:]
    return re.sub(r"[^a-z0-9]+", "-", "-".join(parts).lower()).strip("-")[:60] or "video"


def files_of(d):
    out = []
    for root, dirs, fs in os.walk(d):
        dirs[:] = [x for x in dirs if not x.startswith(".")]
        for f in fs:
            rel = os.path.relpath(os.path.join(root, f), d).replace(os.sep, "/")
            if not SKIP.search(rel):
                out.append(rel)
    return sorted(out)


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    d = os.path.abspath(a[0])
    if not os.path.isfile(os.path.join(d, "data.json")) and not os.path.isfile(os.path.join(d, "parts.json")):
        sys.exit("Folder ni bukan page editor (tiada data.json / parts.json): " + d)
    title = a[a.index("--title") + 1] if "--title" in a else ""
    if not title:
        try:
            title = json.load(open(os.path.join(d, "data.json"))).get("title") or ""
        except Exception:
            title = ""
    title = title or (os.path.basename(os.path.dirname(d)) if os.path.basename(d) == "editor" else os.path.basename(d))
    vid = vid_of(d)
    rels = files_of(d)
    lm = json.load(open(LOCALMAP)) if os.path.exists(LOCALMAP) else {}
    lm[vid] = d
    json.dump(lm, open(LOCALMAP, "w"), ensure_ascii=False, indent=1)
    if "--local" in a:
        print(f"Didaftar untuk uji localhost: {vid} ({len(rels)} fail)\nhttp://localhost:8790/editor/?v={vid}")
        return
    st = json.load(open(STATE)) if os.path.exists(STATE) else {"shared": {}, "videos": {}}
    vs = st["videos"].setdefault(vid, {})
    pv = call("dpath", base="studio", path=["EDITOR PWA", vid])["id"]
    ps = None
    files, up, t0 = {}, 0, time.time()
    for rel in rels:
        p = os.path.join(d, rel)
        h = sha(p)
        if rel.startswith(SHARED):
            if h not in st["shared"]:
                ps = ps or call("dpath", base="studio", path=["EDITOR PWA", "_shared"])["id"]
                st["shared"][h] = upload(p, ps, h + os.path.splitext(rel)[1]); up += 1
            files[rel] = st["shared"][h]
        else:
            if (vs.get(rel) or [None])[0] != h:
                vs[rel] = [h, upload(p, pv, rel.replace("/", "__"))]; up += 1
            files[rel] = vs[rel][1]
        json.dump(st, open(STATE, "w"), indent=1)
    now = int(time.time() * 1000)
    cur = call("dget", path="edpwa/" + vid).get("doc") or {"created": now}
    proj = a[a.index("--project") + 1] if "--project" in a else ""
    if not proj:   # project.json dalam folder page (Edit sendiri) atau folder induk
        for c in (os.path.join(d, "project.json"), os.path.join(os.path.dirname(d), "project.json")):
            if os.path.isfile(c):
                proj = c; break
    cur.update({"title": title, "dir": d, "files": files, "updated": now, "n": len(files), "status": "sedia"})
    if proj:
        cur["project"] = os.path.abspath(proj)
    cur.pop("msg", None)
    s = json.dumps(cur)
    if len(s) > 48000:
        sys.exit("Senarai fail terlalu panjang untuk satu doc (%d aksara)" % len(s))
    call("dset", path="edpwa/" + vid, data=cur)
    print(f"Editor PWA sedia: {title}\n{len(files)} fail ({up} dimuat naik, {time.time() - t0:.0f} s)\n{APP_URL}{vid}")


if __name__ == "__main__":
    main()
