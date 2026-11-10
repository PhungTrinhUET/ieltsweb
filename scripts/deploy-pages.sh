#!/usr/bin/env bash
# Deploy → https://ielts.lionelphung.id.vn/ (GitHub Pages, tên miền riêng; phungtrinhuet.github.io/ieltsweb/ tự chuyển về đây).
# Pages build bằng GitHub Actions (.github/workflows/pages.yml) mỗi lần push master,
# nên script này chỉ build thử ở máy cho chắc rồi push master. Theo dõi: tab Actions trên GitHub.
set -euo pipefail
cd "$(dirname "$0")/.."
BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" = master ] || { echo "Đang ở nhánh $BRANCH – chuyển về master (hoặc merge) rồi deploy."; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "Còn thay đổi chưa commit – commit trước khi deploy."; exit 1; }
npm run build
# Token gh còn hạn → HTTPS qua gh; không thì SSH (key ~/.ssh). DEPLOY_REMOTE=… để chỉ định.
if [ -n "${DEPLOY_REMOTE:-}" ]; then git push "$DEPLOY_REMOTE" master
elif gh auth status >/dev/null 2>&1; then
  git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push https://github.com/PhungTrinhUET/ieltsweb.git master
else git push git@github.com:PhungTrinhUET/ieltsweb.git master; fi
echo "Đã push master → Actions đang build. Khoảng 1–2 phút sau xem ở https://ielts.lionelphung.id.vn/"
