#!/bin/bash
set -euo pipefail

cd /Users/visen24/MAS/openclaw_fork

echo '[vio] source/runtime path sanity check'
for target in \
  apps/vio/src/app/bootstrap/bootstrap-message-runtime.js \
  apps/vio/src/app/bootstrap/bootstrap-workspace-shell.js \
  apps/vio/src/modules/phase1/page-shell/index.js \
  apps/vio/public/app.js \
  apps/vio/scripts/publish-runtime.mjs \
  apps/vio/scripts/smoke-browser.mjs
  do
  if [ ! -f "$target" ]; then
    echo "[vio] missing required file: $target" >&2
    exit 1
  fi
done

echo '[vio] publish runtime'
node apps/vio/scripts/publish-runtime.mjs

echo '[vio] browser-path smoke'
node apps/vio/scripts/smoke-browser.mjs

echo '[vio] dev check passed'
