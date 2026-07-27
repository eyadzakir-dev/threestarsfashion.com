// @ts-check
import { defineConfig } from 'astro/config';

// The URL contract is load-bearing. Nine URLs are indexed and resolve
// extensionless with no trailing slash (/about, never /about/ or /about.html).
//
//   trailingSlash: 'never'   — no redirect from /about to /about/
//   build.format: 'file'     — emits dist/about.html, not dist/about/index.html
//
// Astro's defaults would emit /about/ and 301 every indexed URL. Do not change
// either of these without re-reading PARITY.md §2.
export default defineConfig({
  site: 'https://threestarsfashion.com',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
});
