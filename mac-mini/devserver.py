#!/usr/bin/env python3
"""Uji app Studio di Mac mini tanpa kod rahsia Mira: http://localhost:8790
Fail app dihidang dari folder app/, dan /api dihantar ke Apps Script dengan kunci worker (config.json)."""
import http.server, json, os, sys, urllib.request
APP = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CFG = json.load(open(os.path.expanduser("~/MiracikcitTranscribe/config.json")))


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=APP, **k)

    def do_POST(self):
        if self.path != "/api":
            return self.send_error(404)
        b = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
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
