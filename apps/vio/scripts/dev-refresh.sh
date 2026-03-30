#!/bin/bash
set -euo pipefail
cd /Users/visen24/MAS/openclaw_fork

echo '[vio] publish runtime'
node apps/vio/scripts/publish-runtime.mjs

echo '[vio] kickstart launchd service'
launchctl kickstart -k gui/$(id -u)/com.vio.phase1

echo '[vio] wait for 8792'
for i in 1 2 3 4 5 6 7 8 9 10; do
  if /usr/bin/curl -sf http://127.0.0.1:8792/ >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo '[vio] smoke browser path'
node apps/vio/scripts/smoke-browser.mjs

echo '[vio] refresh complete'
