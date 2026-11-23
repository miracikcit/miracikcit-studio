#!/usr/bin/env python3
"""Job foot_in (2026-11-23, Mira): butang UPLOAD FOOTAGE pada kad Shoot.
Phone upload video ke Drive (ustart/uchunk, sekeping 8 MB); Mac mini muat turun ke folder pilihan dalam CLAUDE EDITS
(<folder edit>/<projek>, folder projek dibuat kalau belum ada), buang salinan Drive, pautkan folder ke kad (items/<id>.folder).
Status dalam doc footin/<item>: proses / sedia / error dengan bilangan fail. 0 token."""
import base64, os, re, threading, time


def _put(sheet, item, **kw):
    kw["at"] = int(time.time() * 1000)
    sheet.call("dset", path="footin/" + item, data=kw)


def run(inp, sheet, W):
    """Jalan dalam thread (muat turun video besar tak sekat kerja lain)."""
    item = re.sub(r"[^\w-]", "", str(inp.get("item") or ""))
    _put(sheet, item, status="proses", done=0, n=len(inp.get("files") or []))
    threading.Thread(target=_run, args=(inp, sheet, W), daemon=True).start()
    return {"started": True}


def _run(inp, sheet, W):
    item = re.sub(r"[^\w-]", "", str(inp.get("item") or ""))
    stage, name = str(inp.get("stage") or ""), W._safe_name(inp.get("name"))
    main, _ = W._edit_main(stage)
    dest = os.path.join(main, name)
    files = [f for f in (inp.get("files") or []) if f.get("id")]
    if not files:
        raise RuntimeError("Tiada fail")
    os.makedirs(dest, exist_ok=True)
    _put(sheet, item, status="proses", done=0, n=len(files), folder=stage + "/" + name)
    done = []
    try:
        for k, f in enumerate(files, 1):
            fn = re.sub(r'[\\/:*?"<>|]+', "_", os.path.basename(str(f.get("name") or "video.mov")))
            out = os.path.join(dest, fn)
            if os.path.exists(out):
                b, e = os.path.splitext(fn)
                out = os.path.join(dest, "%s_%d%s" % (b, int(time.time()) % 100000, e))
            start, total = 0, None
            with open(out + ".part", "wb") as fh:
                while total is None or start < total:
                    r = sheet.call("dchunk", id=f["id"], start=start, len=15000000)
                    total = r["total"]
                    b = base64.b64decode(r["b64"])
                    if not b:
                        break
                    fh.write(b)
                    start += len(b)
            if start < (total or 1):
                raise RuntimeError("Muat turun tak lengkap: " + fn)
            os.replace(out + ".part", out)
            try:
                sheet.call("dtrash", id=f["id"])
            except Exception:
                pass
            done.append(os.path.basename(out))
            _put(sheet, item, status="proses", done=k, n=len(files), folder=stage + "/" + name)
        if item:
            W._set_item(sheet, item, folder=stage + "/" + name)
        _put(sheet, item, status="sedia", done=len(done), n=len(files), folder=stage + "/" + name, files=done)
        W._scan_last["t"] = 0
        W.push_scan(sheet, force=True)
        return {"folder": stage + "/" + name, "files": done}
    except Exception as e:
        _put(sheet, item, status="error", msg=str(e)[:200], done=len(done), n=len(files), folder=stage + "/" + name)
        W.log.exception("foot_in gagal")
