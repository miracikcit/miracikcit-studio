#!/usr/bin/env python3
"""Cutout untuk Editor PWA (Mira 2026-11-26). 0 token Claude, dijalankan oleh worker.py (job ed_cut).

{vid, base} -> cutout.py prep pada folder page (proxy.mp4): tulis cut/cut.json + cut/m*.jpg (jalur matte untuk pratonton
"Tukar latar" dan "Belakang saya"), kemudian edpwa.py muat naik fail baru. Status + peratus dalam doc edcut/<vid>.
Draf dan final tak guna fail ni: render_draft.py (p27) panggil cutout.py render sendiri pada saiz penuh.
"""
import os, re, subprocess, sys, threading, time

TPL = os.path.expanduser("~/.claude/assets/reel-page-template")
PY = os.path.expanduser("~/MiracikcitTranscribe/venv/bin/python")
BUSY = set()


def _put(sh, vid, **kw):
    kw["at"] = int(time.time() * 1000)
    sh.call("dset", path="edcut/" + vid, data=kw)


def run(inp, sheet, cfg, W):
    vid = re.sub(r"[^a-z0-9-]", "", str(inp.get("vid") or ""))
    doc = sheet.call("dget", path="edpwa/" + vid).get("doc") or {}
    if not doc.get("dir") or not os.path.isdir(doc["dir"]):
        raise RuntimeError("Folder editor tak dijumpai dalam Mac mini")
    base = re.sub(r"[^A-Za-z0-9_/-]", "", str(inp.get("base") or "")).strip("/")
    if ".." in base or not os.path.isfile(os.path.join(doc["dir"], base, "proxy.mp4")):
        raise RuntimeError("proxy.mp4 bahagian ni tak dijumpai")
    key = vid + "/" + base
    if key in BUSY:
        return {"vid": vid, "busy": True}
    BUSY.add(key)
    _put(sheet, vid, status="proses", pct=0, base=base)
    threading.Thread(target=_go, args=(sheet, W, vid, doc, base, key), daemon=True).start()
    return {"vid": vid}


def _go(sheet, W, vid, doc, base, key):
    try:
        p = subprocess.Popen([PY if os.path.exists(PY) else sys.executable, os.path.join(TPL, "cutout.py"), "prep", doc["dir"], "--base", base],
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        last, sent, tail = 0.0, -1, []
        for line in p.stdout:
            line = line.strip()
            if line.startswith("PCT "):
                try:
                    pct = int(line[4:])
                except ValueError:
                    continue
                pct = min(90, int(pct * .9))                      # 90% = matte siap, baki = muat naik
                if pct != sent and time.time() - last > 4:
                    last, sent = time.time(), pct
                    try:
                        _put(sheet, vid, status="proses", pct=pct, base=base)
                    except Exception:
                        pass
            elif line:
                tail = (tail + [line])[-4:]
        if p.wait() != 0:
            raise RuntimeError("cutout: " + " | ".join(tail)[-250:])
        _put(sheet, vid, status="proses", pct=92, base=base)
        r = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "edpwa.py"), doc["dir"]] + (["--project", doc["project"]] if doc.get("project") else []),
                           capture_output=True, text=True, timeout=3600)
        if r.returncode != 0:
            raise RuntimeError("upload: " + (r.stderr or r.stdout)[-200:])
        _put(sheet, vid, status="sedia", pct=100, base=base)
        W.log.info("ed_cut siap: %s %s", vid, base)
    except Exception as e:
        W.log.warning("ed_cut gagal (%s): %s", vid, e)
        try:
            _put(sheet, vid, status="error", msg=str(e)[:300], base=base)
        except Exception:
            pass
    finally:
        BUSY.discard(key)
