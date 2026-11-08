#!/usr/bin/env bash
# Build rồi đẩy dist/ lên nhánh gh-pages → https://phungtrinhuet.github.io/ieltsweb/
# (Không dùng GitHub Actions vì tài khoản đang bị khoá Actions do billing.)
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
touch dist/.nojekyll
# Audio để ở host ngoài (VITE_AUDIO_BASE trong .env.production.local) → không đẩy dist/audio lên Pages.
if grep -qs '^VITE_AUDIO_BASE=.\+' .env.production.local .env.production .env.local .env 2>/dev/null || [ -n "${VITE_AUDIO_BASE:-}" ]; then rm -rf dist/audio; echo "Bỏ dist/audio (dùng VITE_AUDIO_BASE)"; fi
TMP=$(mktemp -d)
cp -r dist/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy $(date '+%F %T')"
# Token gh còn hạn → HTTPS qua gh; không thì SSH (key ~/.ssh). DEPLOY_REMOTE=… để chỉ định.
if [ -n "${DEPLOY_REMOTE:-}" ]; then git push -f "$DEPLOY_REMOTE" gh-pages
elif gh auth status >/dev/null 2>&1; then
  git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -f https://github.com/PhungTrinhUET/ieltsweb.git gh-pages
else git push -f git@github.com:PhungTrinhUET/ieltsweb.git gh-pages; fi
rm -rf "$TMP"
echo "Đã deploy: https://phungtrinhuet.github.io/ieltsweb/ (GitHub cần ~1 phút để cập nhật)"
