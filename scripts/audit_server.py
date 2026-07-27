#!/usr/bin/env python3
"""
Static server for Lighthouse audits. Clean-URL resolution, nothing injected.

Deliberately NOT dev_server.py: that one injects a livereload <script> into
every HTML response, which adds a request and JS execution and would skew the
numbers. Baseline and post-migration runs must use this identical server or the
comparison is meaningless.

    python3 scripts/audit_server.py --root .     --port 8080   # legacy site
    python3 scripts/audit_server.py --root dist  --port 8080   # astro build

Resolution order matches GitHub Pages: exact file, then <path>.html, then
<path>/index.html, then 404.html.
"""
import argparse
import functools
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


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        # Must percent-decode: several asset directories contain spaces
        # ("4 Pics home page", "Cutting Area") and one filename has parentheses.
        # Without this they arrive as %20 and 404 — which silently understates
        # every metric by not loading the images at all.
        path = urllib.parse.unquote(path, errors="surrogatepass")
        rel = path.lstrip("/")

        if not rel:
            return os.path.join(ROOT, "index.html")

        exact = os.path.join(ROOT, rel)
        if os.path.isfile(exact):
            return exact

        with_html = os.path.join(ROOT, rel + ".html")
        if os.path.isfile(with_html):
            return with_html

        index = os.path.join(ROOT, rel, "index.html")
        if os.path.isfile(index):
            return index

        custom_404 = os.path.join(ROOT, "404.html")
        if os.path.isfile(custom_404):
            return custom_404

        return exact

    def end_headers(self):
        # No caching, so repeat runs measure the same cold path.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


handler = functools.partial(Handler, directory=ROOT)
with Server(("127.0.0.1", args.port), handler) as httpd:
    print(f"serving {ROOT} on http://127.0.0.1:{args.port}", flush=True)
    httpd.serve_forever()
