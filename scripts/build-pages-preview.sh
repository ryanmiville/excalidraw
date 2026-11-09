#!/usr/bin/env bash
# Builds the app for the GitHub Pages preview at
# https://ryanmiville.github.io/excalidraw/ (served from /docs on this branch).
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
touch docs/.nojekyll
