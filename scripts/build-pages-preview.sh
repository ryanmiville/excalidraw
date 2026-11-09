#!/usr/bin/env bash
# Builds the app for the GitHub Pages site at
# https://ryanmiville.github.io/excalidraw/ (served from /docs on master).
set -euo pipefail
cd "$(dirname "$0")/.."
(
  cd excalidraw-app
  VITE_APP_BASE_PATH=/excalidraw/ \
    VITE_APP_DISABLE_PWA=true \
    VITE_APP_DISABLE_SENTRY=true \
    VITE_APP_GIT_SHA="$(git rev-parse --short HEAD)" \
    npx vite build
)
rm -rf docs
cp -r excalidraw-app/build docs
# old preview links (/tablet/, /text/) now land on the main site
for preview in tablet text; do
mkdir -p "docs/$preview"
cat > "docs/$preview/index.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=/excalidraw/">
<script>location.replace("/excalidraw/" + location.search + location.hash)</script>
<a href="/excalidraw/">Excalidraw</a>
HTML
done
touch docs/.nojekyll
