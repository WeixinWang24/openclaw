#!/bin/bash
set -euo pipefail
cd /Users/visen24/MAS/openclaw_fork
exec /usr/bin/env node /Users/visen24/MAS/openclaw_fork/apps/vio/src/server/runner.mjs >> /Users/visen24/Library/Logs/VioPhase1/stdout.log 2>> /Users/visen24/Library/Logs/VioPhase1/stderr.log
