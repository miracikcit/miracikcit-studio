#!/bin/bash
# Hantar perubahan Studio ke semua device: ./deploy.sh "apa yang diubah"
# Semak JS, naikkan versi, commit, push. Phone tunjuk "Versi baru Studio" dalam ~1 minit.
set -e
cd "$(dirname "$0")"
MSG="${1:-Kemaskini Studio}"
for f in js/*.js js/core/*.js js/tabs/*.js sw.js; do
  node -e "new Function(require('fs').readFileSync(process.argv[1],'utf8'))" "$f" || { echo "RALAT JS dalam $f, tak dihantar"; exit 1; }
done
if [ -z "$(git status --porcelain)" ]; then echo "Tiada perubahan."; exit 0; fi
./bump.sh
git add -A
git commit -q -m "$MSG" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
echo "Dihantar: $(grep -o "version: '[^']*'" js/config.js)"
if git diff --name-only HEAD~1 HEAD | grep -q '^apps-script/'; then
  echo "PERHATIAN: apps-script/Code.gs berubah. Mira perlu tampal dan Deploy > Manage deployments > versi baru."
fi
