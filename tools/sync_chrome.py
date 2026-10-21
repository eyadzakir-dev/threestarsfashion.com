#!/usr/bin/env python3
"""Fill the shared chrome on every English and Arabic page.

Each page carries three marked blocks that this script owns:
  <!-- chrome:head -->     hreflang links, the language redirect and the font stylesheet
  <!-- chrome:header -->   skip link and header (tools/partials/header.<lang>.html)
  <!-- chrome:footer -->   footer (tools/partials/footer.<lang>.html)

English pages live at the repo root (and careers/); each Arabic twin lives at the same
relative path under ar/. Edit the partials (both languages together), then run:

    python3 tools/sync_chrome.py

Everything page-specific (title, meta, canonical, JSON-LD, stylesheets) stays outside the blocks.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTIALS = ROOT / "tools" / "partials"
SITE = "https://threestarsfashion.com"
FONTS = {
    "en": "family=Archivo:wdth,wght@62..125,300..900&family=IBM+Plex+Mono:wght@400;500",
    "ar": "family=Archivo:wdth,wght@62..125,300..900&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700",
}

# Cloudflare Web Analytics (cookieless, so no consent banner). Module scripts run after the
# page is parsed, so loading it in <head> behaves like Cloudflare's end-of-body snippet. Paste the site token from
# dash.cloudflare.com > Analytics & Logs > Web Analytics, then re-run this script.
# Left empty, no analytics script is added to any page.
CLOUDFLARE_ANALYTICS_TOKEN = "cd7ba63539984a3bbb3b4295923c2b8a"

# An explicit choice from the header switch wins; otherwise a browser set to Arabic first
# lands on the Arabic twin of an English page. Arabic URLs are never redirected away for
# first-time visitors, so shared Arabic links and search crawlers always see Arabic.
LANG_SCRIPT = """  <script>
    (function () {
      try {
        if (/bot|crawl|spider|slurp|lighthouse/i.test(navigator.userAgent)) return;
        var page = document.documentElement.lang;
        var saved = localStorage.getItem("tsf-lang");
        var first = (navigator.languages && navigator.languages[0]) || navigator.language || "";
        var want = saved || (page === "en" && /^ar\\b/i.test(first) ? "ar" : "");
        if (!want || want === page) return;
        var twin = document.querySelector('link[rel="alternate"][hreflang="' + want + '"]');
        if (twin) location.replace(new URL(twin.href).pathname + location.search + location.hash);
      } catch (error) {}
    })();
  </script>"""


def url_path(rel: Path) -> str:
    """careers/index.html -> /careers/ ; about.html -> /about ; index.html -> /"""
    parts = list(rel.parts)
    if parts[-1] == "index.html":
        parts = parts[:-1]
        return "/" + "".join(p + "/" for p in parts)
    parts[-1] = parts[-1][: -len(".html")]
    return "/" + "/".join(parts)


def pages():
    skip = {"tools", "assets", "node_modules", ".git"}
    for path in sorted(ROOT.rglob("*.html")):
        rel = path.relative_to(ROOT)
        if rel.parts[0] in skip:
            continue
        lang = "ar" if rel.parts[0] == "ar" else "en"
        base = Path(*rel.parts[1:]) if lang == "ar" else rel
        yield path, lang, base


def page_key(base: Path) -> str:
    first = base.parts[0]
    if first == "index.html":
        return "home"
    if first == "careers":
        return "careers"
    if first == "products":
        return "services"  # product pages sit under Services in the nav
    return first[: -len(".html")]


ANALYTICS_SCRIPT = (
    "  <script type=\"module\" src=\"https://static.cloudflareinsights.com/beacon.min.js\" "
    "data-cf-beacon='{{\"token\": \"{token}\"}}'></script>"
)


def head_block(lang: str, base: Path) -> str:
    en = url_path(base)
    ar = "/ar" + en
    return "\n".join([
        "<!-- chrome:head -->",
        f'  <link rel="alternate" hreflang="en" href="{SITE}{en}">',
        f'  <link rel="alternate" hreflang="ar" href="{SITE}{ar}">',
        f'  <link rel="alternate" hreflang="x-default" href="{SITE}{en}">',
        LANG_SCRIPT,
        '  <link rel="preconnect" href="https://fonts.googleapis.com">',
        '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        f'  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?{FONTS[lang]}&display=swap">',
        *([ANALYTICS_SCRIPT.format(token=CLOUDFLARE_ANALYTICS_TOKEN)] if CLOUDFLARE_ANALYTICS_TOKEN else []),
        "<!-- /chrome:head -->",
    ])


def fill(template: str, lang: str, base: Path, key: str) -> str:
    home = "/" if lang == "en" else "/ar/"
    other = "ar" if lang == "en" else "en"
    twin = (ROOT / "ar" / base) if other == "ar" else (ROOT / base)
    if twin.exists():
        alt = ("/ar" if other == "ar" else "") + url_path(base)
    else:
        alt = "/ar/" if other == "ar" else "/"
    out = template.replace("{{home}}", home).replace("{{alt}}", alt)
    # Mark the current page in every nav (header, mobile menu).
    return re.sub(
        r'(<a [^>]*data-nav="%s")' % re.escape(key),
        r'\1 aria-current="page"',
        out,
    )


def replace_block(html: str, name: str, block: str, fallback: re.Pattern) -> str:
    marked = re.compile(r"<!-- chrome:%s -->.*?<!-- /chrome:%s -->" % (name, name), re.S)
    if marked.search(html):
        return marked.sub(lambda _: block, html, count=1)
    if not fallback.search(html):
        raise SystemExit(f"no {name} found")
    return fallback.sub(lambda _: block, html, count=1)


def sync(path: Path, lang: str, base: Path) -> bool:
    html = path.read_text(encoding="utf-8")
    original = html
    declared = re.search(r'<html lang="([a-z]+)"', html)
    if not declared or declared.group(1) != lang:
        print(f"! {path.relative_to(ROOT)}: <html lang> should be {lang}", file=sys.stderr)
    key = page_key(base)

    # First run on a page: drop its own font links; they move into the head block.
    if "<!-- chrome:head -->" not in html:
        html = re.sub(r'\n\s*<link rel="preconnect" href="https://fonts\.[^"]+"[^>]*>', "", html)
        html = re.sub(r'\n\s*<link rel="stylesheet" href="https://fonts\.googleapis\.com/[^"]+">', "", html)
        html = re.sub(r'(<link rel="canonical" href="[^"]+">)', r"\1\n  <!-- chrome:head --><!-- /chrome:head -->", html, count=1)
    html = replace_block(html, "head", head_block(lang, base), re.compile(r"$^"))

    header = fill((PARTIALS / f"header.{lang}.html").read_text(encoding="utf-8").rstrip("\n"), lang, base, key)
    footer = fill((PARTIALS / f"footer.{lang}.html").read_text(encoding="utf-8").rstrip("\n"), lang, base, key)
    html = replace_block(html, "header", header, re.compile(r'[ \t]*<a class="skip".*?</header>', re.S))
    html = replace_block(html, "footer", footer, re.compile(r'[ \t]*<footer class="ftr">.*?</footer>', re.S))

    if html != original:
        path.write_text(html, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = [str(p.relative_to(ROOT)) for p, lang, base in pages() if sync(p, lang, base)]
    print(f"{len(changed)} page(s) updated" + (": " + ", ".join(changed) if changed else ""))


if __name__ == "__main__":
    main()
