#!/usr/bin/env bash
# Assembles the static site into ${1:-_site}.
set -euo pipefail
OUT="${1:-_site}"
VERSION=$(node -p "require('./package.json').version")
DATE=$(date -u +%Y-%m-%d)

rm -rf "$OUT"
mkdir -p "$OUT/fonts"
cp site/index.html site/sitemap.xml llms.txt "$OUT/"
cp site/google*.html "$OUT/"
cp extension/fonts/DMSans-Variable.woff2 extension/fonts/OFL.txt "$OUT/fonts/"
cp extension/icons/icon16.png "$OUT/icon-16.png"
cp extension/icons/icon128.png "$OUT/icon-128.png"
touch "$OUT/.nojekyll"

sed -i "s/__VERSION__/${VERSION}/g" "$OUT/index.html"
sed -i "s/__DATE__/${DATE}/g" "$OUT/sitemap.xml"
echo "Built $OUT (v${VERSION}, ${DATE})"
