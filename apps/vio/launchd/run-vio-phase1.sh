#!/bin/bash
set -euo pipefail
export PATH="/Users/visen24/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
cd /Users/visen24/MAS/openclaw_fork
exec /usr/bin/env node /Users/visen24/MAS/openclaw_fork/apps/vio/src/server/runner.mjs >> /Users/visen24/Library/Logs/VioPhase1/stdout.log 2>> /Users/visen24/Library/Logs/VioPhase1/stderr.log
