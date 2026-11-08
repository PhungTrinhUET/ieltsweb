#!/usr/bin/env bash
# Build rồi đẩy dist/ lên nhánh gh-pages → https://phungtrinhuet.github.io/ieltsweb/
# (Không dùng GitHub Actions vì tài khoản đang bị khoá Actions do billing.)
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
touch dist/.nojekyll
TMP=$(mktemp -d)
cp -r dist/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy $(date '+%F %T')"
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' \
  push -f https://github.com/PhungTrinhUET/ieltsweb.git gh-pages
rm -rf "$TMP"
echo "Đã deploy: https://phungtrinhuet.github.io/ieltsweb/ (GitHub cần ~1 phút để cập nhật)"
