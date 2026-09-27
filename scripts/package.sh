#!/usr/bin/env bash
# Builds the Chrome Web Store upload: dist/SCA-Fashion-shopper-<version>.zip
#
# The zip is built from an explicit allowlist of runtime files, never from the
# whole folder, so CLAUDE.md, notes.md, docs/, .git/ and whatever else lands in
# the repo later stay out of the package. After zipping, every local file that
# manifest.json, the HTML pages and the JS modules reference is checked against
# the zip's contents; a reference that is missing fails the build.

set -euo pipefail

cd "$(dirname "$0")/.."

# Everything the extension loads at runtime. A new top-level file or folder
# must be added here, or the reference check below will fail the build.
runtime=(manifest.json background.js index.html js style pages icons)

version=$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json)
[ -n "$version" ] || { echo "error: no version found in manifest.json" >&2; exit 1; }

out="dist/SCA-Fashion-shopper-$version.zip"
mkdir -p dist
rm -f "$out" # zip updates an existing archive in place, which would keep deleted files

# -X leaves out macOS extended attributes; Info-ZIP never writes __MACOSX/.
zip -X -r -q "$out" "${runtime[@]}" -x '*.DS_Store'

# Check references against the zip's own contents by unpacking it.
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
unzip -q "$out" -d "$stage"

missing=0
require() { # $1 = referring file, $2 = its directory, $3 = the reference
  local ref=${3%%[?#]*}
  case $ref in '' | *:* | //* | /*) return 0 ;; esac # external, data:, anchors, absolute
  if [ ! -e "$stage/$2/$ref" ]; then
    echo "error: $1 references $ref, which is not in the package" >&2
    missing=1
  fi
}

while IFS= read -r ref; do
  require manifest.json . "$ref"
done < <(grep -oE '"[^"]+\.(html|js|css|png|jpg|jpeg|svg|gif|ico|json)"' "$stage/manifest.json" | tr -d '"')

while IFS= read -r file; do
  dir=$(dirname "$file")
  case $file in # grep finding nothing (a module with no imports) is not an error
    *.html) refs=$({ grep -oE '(src|href)="[^"]*"' "$stage/$file" || true; } | sed -E 's/^[a-z]+="//; s/"$//') ;;
    *.js) refs=$({ grep -oE "(from|import)[[:space:]]*\(?[\"'][^\"']+[\"']" "$stage/$file" || true; } | sed -E "s/.*[\"']([^\"']+)[\"']$/\1/") ;;
  esac
  while IFS= read -r ref; do
    require "$file" "$dir" "$ref"
  done <<<"$refs"
done < <(cd "$stage" && find . \( -name '*.html' -o -name '*.js' \) | sed 's|^\./||' | sort)

if [ "$missing" -ne 0 ]; then
  rm -f "$out"
  echo "error: no package written; add the missing files, or their folder to runtime= in scripts/package.sh" >&2
  exit 1
fi

echo "$out"
