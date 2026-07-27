#!/usr/bin/env python3
"""
Static server that mimics GitHub Pages resolution, for Lighthouse audits and
URL-contract checks. Clean URLs, nothing injected.

Deliberately NOT dev_server.py: that one injects a livereload <script> into
every HTML response, which adds a request and JS execution and would skew the
numbers. Baseline and post-migration runs must use this identical server.

    python3 scripts/audit_server.py --root .     --port 8080   # legacy site
    python3 scripts/audit_server.py --root dist  --port 8080   # astro build

Resolution order matches Pages: exact file, then <path>.html, then
<path>/index.html. Anything unmatched serves 404.html with a real 404 status —
not a 200, which would make a broken link look fine.
"""
import argparse
import http.server
import os
import socketserver
import sys
import urllib.parse

parser = argparse.ArgumentParser()
parser.add_argument("--root", default=".")
parser.add_argument("--port", type=int, default=8080)
args = parser.parse_args()

ROOT = os.path.abspath(args.root)
if not os.path.isdir(ROOT):
    sys.exit(f"Not a directory: {ROOT}")

EXT_TYPES = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json", ".webmanifest": "application/manifest+json",
    ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif",
    ".ico": "image/x-icon", ".woff2": "font/woff2", ".mp4": "video/mp4",
    ".webm": "video/webm",
}


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "audit-server/1.0"

    def resolve(self, path):
        """Return (abs_path, status). Mirrors GitHub Pages."""
        path = path.split("?", 1)[0].split("#", 1)[0]
        # Must percent-decode: several asset directories contain spaces
        # ("4 Pics home page", "Cutting Area") and one filename has parentheses.
        # Without this they arrive as %20 and 404 — which silently understates
        # every metric by not loading the images at all.
        path = urllib.parse.unquote(path, errors="surrogatepass")
        rel = path.lstrip("/")

        if not rel:
            return os.path.join(ROOT, "index.html"), 200

        # Block traversal outside ROOT.
        candidate = os.path.normpath(os.path.join(ROOT, rel))
        if not candidate.startswith(ROOT):
            return None, 403

        for probe in (candidate, candidate + ".html", os.path.join(candidate, "index.html")):
            if os.path.isfile(probe):
                return probe, 200

        fallback = os.path.join(ROOT, "404.html")
        return (fallback if os.path.isfile(fallback) else None), 404

    def _send(self, body_only=False):
        target, status = self.resolve(self.path)

        if target is None:
            body = b"404 Not Found" if status == 404 else b"403 Forbidden"
            ctype = "text/plain; charset=utf-8"
        else:
            try:
                with open(target, "rb") as fh:
                    body = fh.read()
            except OSError:
                body, status, ctype = b"500", 500, "text/plain; charset=utf-8"
            else:
                ctype = EXT_TYPES.get(os.path.splitext(target)[1].lower(),
                                      "application/octet-stream")

        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        # No caching, so repeat runs measure the same cold path.
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.end_headers()
        if not body_only:
            self.wfile.write(body)

    def do_GET(self):
        self._send()

    def do_HEAD(self):
        self._send(body_only=True)

    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


with Server(("127.0.0.1", args.port), Handler) as httpd:
    print(f"serving {ROOT} on http://127.0.0.1:{args.port}", flush=True)
    httpd.serve_forever()
