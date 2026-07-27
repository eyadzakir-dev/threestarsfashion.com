/**
 * Build-time media resolution for MediaSlot. Runs in Node during `astro build`
 * (and per-request in `astro dev`), never in the browser.
 *
 * Two jobs:
 *  1. Find which formats actually exist on disk, so a slot degrades cleanly and
 *     real footage can be added later by dropping a file at the path.
 *  2. Report intrinsic dimensions so every <img> gets explicit width/height.
 *     CLS is 0.000 site-wide today and has no headroom — it can only get worse.
 *     Dimensions come from a .json sidecar if the media pipeline wrote one, and
 *     otherwise are read off the file with sharp. That second path is what lets
 *     the legacy factory photography (no sidecar) go through MediaSlot at all,
 *     rather than needing a bare <img> that step 9 would flag.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const PUBLIC_DIR = 'public';

export interface ResolvedMedia {
  avif: string | null;
  webp: string | null;
  fallback: string | null;
  mp4: string | null;
  webm: string | null;
  width: number | null;
  height: number | null;
}

/** Cache promises, not values: many pages reuse the same images. */
const cache = new Map<string, Promise<ResolvedMedia>>();

// SVG must be here: all 12 client logos in assets/Brands/ are SVG, and leaving
// it out made every one of them silently resolve to the empty-slot state.
const IMAGE_EXTS = ['avif', 'webp', 'svg', 'jpg', 'jpeg', 'png'] as const;

/** URL-encode each path segment; several asset dirs contain spaces and parens. */
const toUrl = (...parts: string[]) =>
  '/' + parts.join('/').split('/').filter(Boolean).map(encodeURIComponent).join('/');

async function readDimensions(absPath: string, dir: string, stem: string) {
  const sidecar = join(PUBLIC_DIR, dir, `${stem}.json`);
  if (existsSync(sidecar)) {
    try {
      const { width, height } = JSON.parse(readFileSync(sidecar, 'utf8'));
      if (width && height) return { width, height };
    } catch { /* fall through to sharp */ }
  }
  try {
    const meta = await sharp(absPath).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

async function resolve(dir: string, stem: string): Promise<ResolvedMedia> {
  const found: Partial<Record<(typeof IMAGE_EXTS)[number], string>> = {};
  let firstAbs: string | null = null;

  for (const ext of IMAGE_EXTS) {
    const abs = join(PUBLIC_DIR, dir, `${stem}.${ext}`);
    if (existsSync(abs)) {
      found[ext] = toUrl(dir, `${stem}.${ext}`);
      firstAbs ??= abs;
    }
  }

  // SVG wins outright where present — it is resolution-independent, so serving
  // a raster derivative of a logo would be strictly worse.
  const raster = found.svg ?? found.jpg ?? found.jpeg ?? found.png ?? null;
  const fallback = raster ?? found.webp ?? found.avif ?? null;

  const mp4Abs = join(PUBLIC_DIR, dir, 'loop.mp4');
  const webmAbs = join(PUBLIC_DIR, dir, 'loop.webm');

  const dims = firstAbs
    ? await readDimensions(firstAbs, dir, stem)
    : { width: null, height: null };

  return {
    avif: found.avif ?? null,
    webp: found.webp ?? null,
    fallback,
    mp4: existsSync(mp4Abs) ? toUrl(dir, 'loop.mp4') : null,
    webm: existsSync(webmAbs) ? toUrl(dir, 'loop.webm') : null,
    width: dims.width,
    height: dims.height,
  };
}

export function resolveMedia(dir: string, stem: string): Promise<ResolvedMedia> {
  const key = `${dir}::${stem}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = resolve(dir, stem);
    cache.set(key, hit);
  }
  return hit;
}
