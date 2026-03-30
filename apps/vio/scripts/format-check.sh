#!/bin/bash
set -euo pipefail

cd /Users/visen24/MAS/openclaw_fork

echo '[vio] scoped format check'
pnpm exec python3 - <<'PY'
import subprocess
from pathlib import Path

roots = [
    Path('apps/vio/src/app'),
    Path('apps/vio/src/modules'),
    Path('apps/vio/src/shared'),
    Path('apps/vio/scripts'),
]
allowed = {'.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.md', '.html', '.css'}
files = []
for root in roots:
    if not root.exists():
        continue
    for p in sorted(root.rglob('*')):
        if p.is_file() and p.suffix in allowed and 'node_modules' not in p.parts:
            files.append(str(p))
files += [
    'apps/vio/public/app.js',
    'apps/vio/public/index.html',
    'apps/vio/public/styles.css',
]
if not files:
    raise SystemExit('no Vio files found for scoped format check')
for f in files:
    subprocess.run(['pnpm', 'exec', 'oxfmt', '--check', '--threads=1', f], check=True)
print(f'checked {len(files)} Vio files')
PY

echo '[vio] scoped format check passed'
