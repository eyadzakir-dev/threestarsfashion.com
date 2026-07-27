#!/usr/bin/env node
/**
 * Downloads every generated asset named in media/manifest.json and writes it
 * into public/assets/, converting as it goes.
 *
 * Division of labour: MCP tools cannot be called from a standalone Node script,
 * so the agent resolves each job_id to a hosted URL via the Higgsfield MCP and
 * records it in media/manifest.lock.json. This script only consumes that file.
 *
 * PATH RECONCILIATION: the manifest's target_path values are repo-relative
 * ("assets/slots/hero/poster.avif") but the asset tree moved to public/ during
 * step 2 so its URLs stay unchanged. target_path is therefore resolved relative
 * to public/. The manifest itself is left untouched — it is an input document.
 *
 * Images  -> AVIF + WebP siblings, plus poster.json carrying intrinsic
 *            dimensions so MediaSlot can emit explicit width/height (CLS is
 *            0.000 site-wide and has no headroom).
 * Video   -> muted MP4 + WebM, audio stripped entirely, each under 2 MB.
 *
 * Run:  node scripts/fetch_media.mjs [--force]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const FORCE = process.argv.includes('--force');
const PUBLIC = 'public';
const TMP = '.media-tmp';
const MAX_VIDEO_BYTES = 2 * 1024 * 1024;

const manifest = JSON.parse(readFileSync('media/manifest.json', 'utf8'));
const lock = JSON.parse(readFileSync('media/manifest.lock.json', 'utf8'));

mkdirSync(TMP, { recursive: true });

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const done = [];
const skipped = [];
const failed = [];

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

/** Collect every entry the manifest actually wants written. */
function collectEntries() {
  const out = [];
  const s = manifest.slots ?? {};

  for (const [slot, def] of Object.entries(s)) {
    if (def.status === 'AWAITING REAL MEDIA' || def.poster === null) {
      skipped.push({
        what: `slot "${slot}"`,
        why: def.note?.split('.')[0] ??
             'deliberately empty — awaiting real media. Do NOT fill with generated facility imagery.',
      });
      continue;
    }
    if (def.poster) out.push({ kind: 'image', name: `${slot}/poster`, ...def.poster });
    if (def.loop) out.push({ kind: 'video', name: `${slot}/loop`, ...def.loop });
    for (const f of def.frames ?? []) {
      out.push({ kind: 'image', name: `${slot}/${basename(f.target_path, '.avif')}`, ...f });
    }
  }

  for (const l of manifest.library ?? []) {
    out.push({ kind: 'image', name: `library/${basename(l.target_path, '.avif')}`, ...l });
  }

  for (const r of manifest.review_required ?? []) {
    skipped.push({
      what: `job ${r.job_id.slice(0, 8)} (${r.subject})`,
      why: `${r.status}. ${r.reason?.split('.')[0]}.`,
    });
  }

  return out;
}

async function handleImage(e) {
  const resolved = lock.jobs?.[e.job_id];
  if (!resolved?.url) { failed.push({ what: e.name, why: 'no resolved URL in manifest.lock.json' }); return; }

  const target = join(PUBLIC, e.target_path);            // <- path reconciliation
  const outDir = dirname(target);
  const stem = basename(e.target_path).replace(/\.[^.]+$/, '');
  const avifPath = join(outDir, `${stem}.avif`);
  const webpPath = join(outDir, `${stem}.webp`);
  const jsonPath = join(outDir, `${stem}.json`);

  if (!FORCE && existsSync(avifPath) && existsSync(webpPath)) {
    skipped.push({ what: e.name, why: 'already present (use --force to redo)' });
    return;
  }

  mkdirSync(outDir, { recursive: true });
  const src = join(TMP, `${e.job_id}.src`);
  await download(resolved.url, src);

  const meta = await sharp(src).metadata();
  await sharp(src).avif({ quality: 62, effort: 6 }).toFile(avifPath);
  await sharp(src).webp({ quality: 78, effort: 5 }).toFile(webpPath);
  writeFileSync(jsonPath, JSON.stringify({ width: meta.width, height: meta.height }) + '\n');

  done.push({
    what: e.name,
    detail: `${meta.width}x${meta.height}  avif ${kb(statSync(avifPath).size)}  ` +
            `webp ${kb(statSync(webpPath).size)}`,
  });
}

/** Encode to a byte ceiling. Two-pass so the bitrate actually lands. */
function encodeVideo(src, out, codec, bytes, seconds) {
  // Target 92% of the ceiling to leave room for container overhead.
  const kbps = Math.max(120, Math.floor((bytes * 0.92 * 8) / seconds / 1000));
  const common = ['-y', '-i', src, '-an', '-map_metadata', '-1', '-movflags', '+faststart'];
  const args = codec === 'webm'
    ? [...common.filter((a) => a !== '-movflags' && a !== '+faststart'),
       '-c:v', 'libvpx-vp9', '-b:v', `${kbps}k`, '-row-mt', '1', '-pix_fmt', 'yuv420p', out]
    : [...common, '-c:v', 'libx264', '-b:v', `${kbps}k`, '-profile:v', 'high',
       '-pix_fmt', 'yuv420p', out];
  execFileSync('ffmpeg', args, { stdio: 'pipe' });
  return statSync(out).size;
}

async function handleVideo(e) {
  const resolved = lock.jobs?.[e.job_id];
  if (!resolved?.url) { failed.push({ what: e.name, why: 'no resolved URL in manifest.lock.json' }); return; }

  const target = join(PUBLIC, e.target_path);
  const outDir = dirname(target);
  const stem = basename(e.target_path).replace(/\.[^.]+$/, '');
  const mp4 = join(outDir, `${stem}.mp4`);
  const webm = join(outDir, `${stem}.webm`);

  if (!FORCE && existsSync(mp4) && existsSync(webm)) {
    skipped.push({ what: e.name, why: 'already present (use --force to redo)' });
    return;
  }

  mkdirSync(outDir, { recursive: true });
  const src = join(TMP, `${e.job_id}.mp4`);
  await download(resolved.url, src);

  const seconds = e.duration_sec ?? resolved.duration_sec ?? 5;
  const sizes = {};
  for (const [codec, out] of [['mp4', mp4], ['webm', webm]]) {
    let size = encodeVideo(src, out, codec, MAX_VIDEO_BYTES, seconds);
    // One corrective pass if the first landed over the ceiling.
    if (size > MAX_VIDEO_BYTES) {
      const scaled = Math.floor(MAX_VIDEO_BYTES * (MAX_VIDEO_BYTES / size) * 0.9);
      size = encodeVideo(src, out, codec, scaled, seconds);
    }
    sizes[codec] = size;
    if (size > MAX_VIDEO_BYTES) {
      failed.push({ what: `${e.name}.${codec}`, why: `${kb(size)} exceeds the 2 MB ceiling` });
    }
  }

  // Prove the audio track is gone rather than trusting -an.
  const streams = execFileSync('ffprobe',
    ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', mp4],
    { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const hasAudio = streams.includes('audio');
  if (hasAudio) failed.push({ what: `${e.name}.mp4`, why: 'audio track still present' });

  done.push({
    what: e.name,
    detail: `${seconds}s  mp4 ${kb(sizes.mp4)}  webm ${kb(sizes.webm)}  ` +
            `streams: ${streams.join('+')}${hasAudio ? ' AUDIO PRESENT' : ' (audio stripped)'}`,
  });
}

// ---------------------------------------------------------------------------

const entries = collectEntries();

for (const e of entries) {
  if (e.regenerate) {
    skipped.push({
      what: e.name,
      why: e.regenerate_reason ?? 'flagged regenerate in the manifest',
    });
    continue;
  }
  try {
    if (e.kind === 'image') await handleImage(e);
    else await handleVideo(e);
  } catch (err) {
    failed.push({ what: e.name, why: err.message });
  }
}

rmSync(TMP, { recursive: true, force: true });

const section = (title, rows, fmt) => {
  if (!rows.length) return;
  console.log(`\n${title}`);
  for (const r of rows) console.log(`  ${fmt(r)}`);
};

section('WRITTEN', done, (r) => `${r.what.padEnd(26)} ${r.detail}`);
section('SKIPPED', skipped, (r) => `${r.what.padEnd(26)} ${r.why}`);
section('CONFLICTS TO RESOLVE BEFORE LAUNCH', Object.entries(lock.jobs ?? {})
  .filter(([, v]) => v._note)
  .map(([id, v]) => ({ what: id.slice(0, 8), why: v._note })),
  (r) => `${r.what.padEnd(26)} ${r.why}`);
section('FAILED', failed, (r) => `${r.what.padEnd(26)} ${r.why}`);

console.log(`\n${done.length} written, ${skipped.length} skipped, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
