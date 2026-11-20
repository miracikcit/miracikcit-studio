#!/usr/bin/env python3
"""Tulis atau baca data Miracikcit Studio (tab STUDIO_DATA) dari Mac mini, tanpa token.

  python3 ~/MiracikcitTranscribe/studio.py get editor/ed-abc12345
  python3 ~/MiracikcitTranscribe/studio.py put editor/ed-abc12345 '{"name":"...","status":"Draf","url":"..."}'
  python3 ~/MiracikcitTranscribe/studio.py merge editor/ed-abc12345 '{"status":"Siap"}'
  python3 ~/MiracikcitTranscribe/studio.py del editor/ed-abc12345
  python3 ~/MiracikcitTranscribe/studio.py list gaya    # semua kad gaya
  python3 ~/MiracikcitTranscribe/studio.py scan        # imbas folder sekarang
"""
import json, os, sys, time, urllib.request

HOME = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(HOME, "config.json")))


def call(action, **kw):
    body = json.dumps(dict(kw, key=cfg["key"], action=action)).encode()
    req = urllib.request.Request(cfg["sheet_url"], data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        out = json.loads(r.read().decode())
    if not out.get("ok"):
        sys.exit("Gagal: " + str(out.get("error")))
    return out


def stamp(d):
    d.setdefault("created", int(time.time() * 1000))
    d["updated"] = int(time.time() * 1000)
    return d


cmd = sys.argv[1] if len(sys.argv) > 1 else ""
if cmd == "get":
    print(json.dumps(call("dget", path=sys.argv[2]).get("doc"), ensure_ascii=False, indent=2))
elif cmd == "put":
    call("dset", path=sys.argv[2], data=stamp(json.loads(sys.argv[3]))); print("OK")
elif cmd == "merge":
    cur = call("dget", path=sys.argv[2]).get("doc") or {}
    cur.update(json.loads(sys.argv[3])); call("dset", path=sys.argv[2], data=stamp(cur)); print("OK")
elif cmd == "list":        # studio.py list gaya  -> semua dokumen dalam koleksi
    col = sys.argv[2].rstrip("/") + "/"
    docs = [dict(x["d"], id=x["p"][len(col):]) for x in call("pull", since=0).get("docs", []) if x["p"].startswith(col) and x.get("d")]
    print(json.dumps(docs, ensure_ascii=False, indent=2))
elif cmd == "del":
    call("dset", path=sys.argv[2], data=None); print("OK")
elif cmd == "scan":
    sys.path.insert(0, HOME)
    import worker
    worker.setup_log()

    class S:
        def call(self, action, **kw):
            return call(action, **kw)
    print(worker.push_scan(S(), force=True))
else:
    print(__doc__)
