#!/usr/bin/env bash
# Vendor the seakim design system's published surface into web/vendor/seakim.
#
# We vendor rather than install the private git package so no build context
# (CI, prod Dokploy, QA Dokploy) needs repo credentials. The vendored files ARE
# committed; this script only needs the source repo present when *re-vendoring*
# on a version bump. See tasks/todo.md.
#
# Usage:  ./web/scripts/vendor-seakim.sh [path-to-seakim-design-system]
#         SEAKIM_SRC=/path ./web/scripts/vendor-seakim.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
web_dir="$(cd "$here/.." && pwd)"
src="${1:-${SEAKIM_SRC:-$web_dir/../../seakim-design-system}}"
dest="$web_dir/vendor/seakim"

if [[ ! -f "$src/package.json" ]]; then
  echo "error: seakim-design-system not found at: $src" >&2
  echo "pass the path as arg 1 or set SEAKIM_SRC." >&2
  exit 1
fi

# What we vendor. The runtime surface (barrel, components, tokens, styles) plus
# the governance surface — conformance.md, spec/, decisions/ (ADRs), guidelines/.
# The DS's rules are Law for UI/colour decisions in this repo (see CLAUDE.md), so
# they ride along version-pinned instead of living only in the source repo.
surface=(
  index.js index.d.ts styles.css components tokens ui_kits/shared
  conformance.md spec decisions guidelines
)

rm -rf "$dest"
mkdir -p "$dest/ui_kits"
for item in "${surface[@]}"; do
  mkdir -p "$dest/$(dirname "$item")"
  cp -R "$src/$item" "$dest/$item"
done

# Kill the Google Fonts @import — we self-host the same families via next/font
# (app/fonts.ts), which assigns the identical CSS vars. Leaving it in would fetch
# the fonts a second time at runtime. The :root fallback block stays.
fonts="$dest/tokens/fonts.css"
grep -v 'fonts.googleapis.com' "$fonts" > "$fonts.tmp" && mv "$fonts.tmp" "$fonts"

# Record the vendored version so drift from the source repo is visible.
cp "$src/VERSION" "$dest/VENDORED_VERSION"

echo "vendored seakim design system v$(cat "$dest/VENDORED_VERSION") → web/vendor/seakim"
