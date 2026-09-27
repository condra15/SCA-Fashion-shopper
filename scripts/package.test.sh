#!/usr/bin/env bash
# Tests for scripts/package.sh. Run from anywhere: scripts/package.test.sh
#
# Every case runs the packager against a throwaway copy of the repo, so the
# real working tree and its dist/ are never touched.

set -o pipefail

repo=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

failures=0
check() { # $1 = description; the rest is a command that must succeed
  local description=$1
  shift
  if "$@"; then
    echo "ok   - $description"
  else
    echo "FAIL - $description"
    failures=$((failures + 1))
  fi
}

# A copy of the working tree, planted with the files that must NOT ship:
# CLAUDE.md, notes.md and README.md come along from the repo, plus a stand-in
# .git directory, local-only docs/agents/ and .DS_Store files.
make_fixture() {
  local dir="$tmp/$1"
  mkdir -p "$dir"
  rsync -a --exclude .git --exclude dist "$repo/" "$dir/"
  mkdir -p "$dir/.git/objects" "$dir/docs/agents"
  echo "ref: refs/heads/main" >"$dir/.git/HEAD"
  echo "local only" >"$dir/docs/agents/domain.md"
  touch "$dir/.DS_Store" "$dir/js/.DS_Store" "$dir/icons/.DS_Store"
  echo "$dir"
}

lacks_prefix() { # $1 = prefix, $2 = zip listing
  local entry
  while IFS= read -r entry; do
    case $entry in "$1"*) return 1 ;; esac
  done <<<"$2"
}

lacks_match() { ! grep -qE -- "$1" <<<"$2"; }

only_runtime_files() {
  ! grep -vqE '^(manifest\.json|background\.js|index\.html|(js|style|pages|icons)/.*)$' <<<"$1"
}

no_zip_in() { ! ls "$1"/dist/*.zip >/dev/null 2>&1; }

# --- A clean build ships the runtime files and nothing else ------------------

fixture=$(make_fixture clean)
sed -i '' 's/"version": "[^"]*"/"version": "9.9.9"/' "$fixture/manifest.json"
"$fixture/scripts/package.sh" >/dev/null 2>&1
status=$?
zip="$fixture/dist/SCA-Fashion-shopper-9.9.9.zip"
listing=$(zipinfo -1 "$zip" 2>/dev/null)

check "exits 0 on a clean tree" [ "$status" -eq 0 ]
check "names the zip after the manifest version" [ -f "$zip" ]
check "puts manifest.json at the zip root" grep -qxF manifest.json <<<"$listing"

while IFS= read -r file; do
  check "ships $file" grep -qxF "$file" <<<"$listing"
done < <(cd "$fixture" && find manifest.json background.js index.html js style pages icons -type f ! -name .DS_Store | sort)

check "ships only manifest.json, background.js, index.html, js/, style/, pages/, icons/" only_runtime_files "$listing"
for banned in .git/ CLAUDE.md notes.md README.md docs/ .gitignore scripts/ dist/ __MACOSX; do
  check "does not ship $banned" lacks_prefix "$banned" "$listing"
done
check "does not ship any .DS_Store" lacks_match '(^|/)\.DS_Store$' "$listing"

# A rebuild replaces the zip rather than updating it in place, so files
# deleted since the last build do not linger.
echo "export {};" >"$fixture/js/stale.js"
"$fixture/scripts/package.sh" >/dev/null 2>&1
rm "$fixture/js/stale.js"
"$fixture/scripts/package.sh" >/dev/null 2>&1
check "drops files deleted since the previous build" lacks_prefix js/stale.js "$(zipinfo -1 "$zip" 2>/dev/null)"

# --- Every local reference must resolve inside the package -------------------

# A page references a file that exists on disk but sits outside the allowlist.
fixture=$(make_fixture html-ref)
mkdir -p "$fixture/assets" && touch "$fixture/assets/logo.svg"
sed -i '' 's|</head>|<link rel="icon" href="assets/logo.svg"></head>|' "$fixture/index.html"
output=$("$fixture/scripts/package.sh" 2>&1)
status=$?
check "fails when a page references a file outside the package" [ "$status" -ne 0 ]
check "names the unpackaged page reference" grep -qF "assets/logo.svg" <<<"$output"
check "leaves no zip behind after a failed reference check" no_zip_in "$fixture"

# A module imports a file that does not exist.
fixture=$(make_fixture js-import)
echo 'import "./missing.js";' >>"$fixture/js/login.js"
output=$("$fixture/scripts/package.sh" 2>&1)
status=$?
check "fails when a module imports a file that is not packaged" [ "$status" -ne 0 ]
check "names the missing import" grep -qF "missing.js" <<<"$output"

# The manifest points at a file that does not exist.
fixture=$(make_fixture manifest-ref)
sed -i '' 's|icons/icon128.png|icons/icon256.png|' "$fixture/manifest.json"
output=$("$fixture/scripts/package.sh" 2>&1)
status=$?
check "fails when manifest.json references a file that is not packaged" [ "$status" -ne 0 ]
check "names the missing manifest reference" grep -qF "icons/icon256.png" <<<"$output"

echo
if [ "$failures" -eq 0 ]; then
  echo "All package.sh tests passed."
else
  echo "$failures package.sh test(s) failed."
  exit 1
fi
