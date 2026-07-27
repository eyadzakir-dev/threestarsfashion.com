#!/usr/bin/env python3
"""
Local dev server for Three Stars Fashion
=========================================
  ✅ Clean URLs  — /about, /services, /contact … all resolve without .html
  ✅ Live Reload — browser refreshes automatically on every file save
  ✅ Zero side-effects — no project files are modified

Usage (via Makefile):  make start
Direct usage:          python3 scripts/dev_server.py
"""

import os
import sys
import mimetypes
import subprocess

# ── 1. Self-bootstrap livereload ────────────────────────────────────────────

def _ensure(package):
    try:
        __import__(package)
    except ImportError:
        print(f"  📦 Installing {package}…")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", package, "-q"],
            stdout=subprocess.DEVNULL,
        )
        print(f"  ✅ {package} installed.")

_ensure("livereload")
from livereload import Server  # noqa: E402  (import after bootstrap)

# ── 2. Config ───────────────────────────────────────────────────────────────

# Project root is one level above this script (scripts/)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", 8080))

# Livereload injects a tiny WS client — this is the script tag it expects
LIVERELOAD_SNIPPET = b'\n<script src="/livereload.js?snipver=1"></script>\n'

# ── 3. Clean-URL resolver ────────────────────────────────────────────────────

def resolve(url_path: str):
    """
    Map a URL path to an absolute file path.

    Resolution order:
      1. /            → index.html
      2. /about       → about.html        (clean URL → .html)
      3. /styles.css  → styles.css        (assets served as-is)
      4. anything else → None (404)
    """
    # Strip query string / fragment
    url_path = url_path.split("?")[0].split("#")[0]

    if url_path == "/":
        candidate = os.path.join(ROOT, "index.html")
        return candidate if os.path.isfile(candidate) else None

    rel = url_path.lstrip("/")

    # Exact file match first (CSS, JS, images, fonts, etc.)
    exact = os.path.join(ROOT, rel)
    if os.path.isfile(exact):
        return exact

    # Clean URL: try appending .html
    with_html = os.path.join(ROOT, rel + ".html")
    if os.path.isfile(with_html):
        return with_html

    # Directory index fallback (future-proof)
    index = os.path.join(ROOT, rel, "index.html")
    if os.path.isfile(index):
        return index

    return None  # 404

# ── 4. WSGI application ──────────────────────────────────────────────────────

def app(environ, start_response):
    from urllib.parse import unquote
    url_path = unquote(environ.get("PATH_INFO", "/"))

    file_path = resolve(url_path)

    # ── 404 ──────────────────────────────────────────────────────────────────
    if file_path is None:
        body = (
            b"<html><body><h1>404 Not Found</h1>"
            b"<p>The page you requested does not exist.</p></body></html>"
        )
        start_response("404 Not Found", [
            ("Content-Type", "text/html; charset=utf-8"),
            ("Content-Length", str(len(body))),
        ])
        return [body]

    # ── Serve file ───────────────────────────────────────────────────────────
    mime_type, _ = mimetypes.guess_type(file_path)
    mime_type = mime_type or "application/octet-stream"

    with open(file_path, "rb") as fh:
        content = fh.read()

    # Inject livereload <script> just before </body> in HTML files only
    if mime_type == "text/html":
        content = content.replace(b"</body>", LIVERELOAD_SNIPPET + b"</body>", 1)
        mime_type = "text/html; charset=utf-8"

    start_response("200 OK", [
        ("Content-Type", mime_type),
        ("Content-Length", str(len(content))),
    ])
    return [content]

# ── 5. Entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    server = Server(app)

    # Watch all source files — triggers a browser refresh on save
    for pattern in ("*.html", "*.css", "*.js"):
        server.watch(os.path.join(ROOT, pattern))
    server.watch(os.path.join(ROOT, "assets"))

    print("")
    print("  Three Stars Fashion — Local Dev Server")
    print("  ═══════════════════════════════════════")
    print(f"  🌐  http://localhost:{PORT}")
    print(f"  🔄  Live Reload active  (browser refreshes on save)")
    print(f"  🔗  Clean URLs active   (/about, /services, /contact …)")
    print(f"  📁  Serving: {ROOT}")
    print("")
    print("  Press Ctrl+C to stop.")
    print("")

    server.serve(port=PORT, open_url_delay=1)
