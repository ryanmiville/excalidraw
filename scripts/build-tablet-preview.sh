#!/usr/bin/env bash
# Builds the customizable-toolbar app and copies it into a checkout of the
# Pages branch (claude/project-thread-eezqdh), served at
# https://ryanmiville.github.io/excalidraw/tablet/
# usage: scripts/build-tablet-preview.sh <path-to-pages-branch-checkout>
set -euo pipefail
PAGES="${1:?path to pages branch checkout}"
cd "$(dirname "$0")/.."
(
  cd excalidraw-app
  VITE_APP_BASE_PATH=/excalidraw/tablet/ \
    VITE_APP_DISABLE_PWA=true \
    VITE_APP_DISABLE_SENTRY=true \
    VITE_APP_GIT_SHA="$(git rev-parse --short HEAD)" \
    npx vite build
)
rm -rf "$PAGES/docs/tablet"
cp -r excalidraw-app/build "$PAGES/docs/tablet"
