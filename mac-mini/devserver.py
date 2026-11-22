#!/usr/bin/env python3
"""Uji app Studio di Mac mini tanpa kod rahsia Mira: http://localhost:8790
Fail app dihidang dari folder app/, dan /api dihantar ke Apps Script dengan kunci worker (config.json).
Baca sahaja secara default (data sebenar Mira tak diubah masa uji). DEV_RW=1 untuk benarkan tulis."""
import http.server, json, os, sys, urllib.request
APP = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CFG = json.load(open(os.path.expanduser("~/MiracikcitTranscribe/config.json")))


WRITES = {"put", "update_values", "cal_create", "cal_update", "cal_delete", "job_add", "upload", "product_add", "file_delete", "setup"}


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=APP, **k)

    def do_GET(self):
        # uji editor PWA: /edlocal/<id>/<fail> dari folder page yang didaftar oleh edpwa.py --local
        if self.path.startswith("/edlocal/"):
            import urllib.parse
            bits = urllib.parse.unquote(self.path.split("?")[0]).split("/", 3)
            vid, rest = bits[2], (bits[3] if len(bits) > 3 else "")
            lm = json.load(open(os.path.expanduser("~/MiracikcitTranscribe/edpwa_local.json")))
            d = lm.get(vid)
            if not d:
                return self.send_error(404)
            if rest == "__manifest":
                sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
                import edpwa
                out = json.dumps({"title": vid, "dir": d, "files": {r: "L" for r in edpwa.files_of(d)}}).encode()
                ctype = "application/json"
            else:
                f = os.path.realpath(os.path.join(d, rest))
                if not f.startswith(os.path.realpath(d)) or not os.path.isfile(f):
                    return self.send_error(404)
                out = open(f, "rb").read(); ctype = "application/octet-stream"
            self.send_response(200); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(out))); self.end_headers(); self.wfile.write(out)
            return
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api":
            return self.send_error(404)
        b = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if not os.environ.get("DEV_RW") and b.get("action") in WRITES:
            print("BACA SAHAJA, disekat:", b.get("action"), json.dumps(b.get("args") or b.get("type") or b.get("p") or "")[:160], flush=True)
            out = json.dumps({"ok": True, "payload": {}, "id": "dev-ro"}).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(out)
            return
        b.pop("code", None)
        b["key"] = CFG["key"]
        req = urllib.request.Request(CFG["sheet_url"], data=json.dumps(b).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r:
            out = r.read()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *a):
        pass


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
print(f"Studio dev: http://localhost:{port}")
http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
