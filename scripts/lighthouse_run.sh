#!/usr/bin/env bash
# Lighthouse harness. Must be run identically for the baseline and the
# post-migration comparison, or the numbers mean nothing.
#
#   scripts/lighthouse_run.sh http://127.0.0.1:8080 .lighthouse/baseline 5
#
# 5 runs, not 3. At 3 a single contended run moves the median by up to 21
# performance points (observed on /services: 66/61/87). Run with the machine
# otherwise idle.
#
# Assumes scripts/audit_server.py is already serving the target root.
set -euo pipefail

BASE="${1:-http://127.0.0.1:8080}"
OUT="${2:-.lighthouse/baseline}"
RUNS="${3:-5}"

PAGES=( "/" "/about" "/services" "/facilities" "/certifications" \
        "/logistics" "/faq" "/contact" "/privacy-policy" )

mkdir -p "$OUT"

for page in "${PAGES[@]}"; do
  slug="${page#/}"
  slug="${slug:-index}"
  for run in $(seq 1 "$RUNS"); do
    echo "→ ${page} run ${run}/${RUNS}"
    npx --yes lighthouse@12 "${BASE}${page}" \
      --quiet \
      --output=json \
      --output-path="${OUT}/${slug}.${run}.json" \
      --only-categories=performance,accessibility,best-practices,seo \
      --form-factor=mobile \
      --throttling-method=simulate \
      --max-wait-for-load=45000 \
      --chrome-flags="--headless=new --no-sandbox --disable-gpu" \
      || echo "  !! failed: ${page} run ${run}"
  done
done

echo "done → ${OUT}"
