#!/bin/bash
# Naikkan versi supaya phone ambil fail terbaru: ./bump.sh
cd "$(dirname "$0")"
OLD=$(grep -o "version: '[^']*'" js/config.js | cut -d"'" -f2)
D=$(date +%Y.%m.%d); N=1
[[ "$OLD" == "$D-"* ]] && N=$(( ${OLD##*-} + 1 ))
NEW="$D-$N"
grep -rl -- "$OLD" index.html sw.js js/config.js | xargs sed -i '' "s/$OLD/$NEW/g"
echo "$OLD -> $NEW"
