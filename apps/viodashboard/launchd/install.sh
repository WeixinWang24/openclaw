#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_JS="$ROOT/src/config.mjs"
AGENTS_DIR="$HOME/Library/LaunchAgents"
UID_NOW="$(id -u)"

CFG="$(CONFIG_JS="$CONFIG_JS" /opt/homebrew/bin/node --input-type=module <<'NODE'
const mod = await import(process.env.CONFIG_JS);
console.log(mod.APP_LOG_DIR);
console.log(mod.LAUNCHD_LABEL);
console.log(mod.LAUNCHD_PLIST_NAME);
NODE
)"
LOG_DIR="$(printf '%s\n' "$CFG" | sed -n '1p')"
LAUNCHD_LABEL="$(printf '%s\n' "$CFG" | sed -n '2p')"
LAUNCHD_PLIST_NAME="$(printf '%s\n' "$CFG" | sed -n '3p')"

MODE="${1:-source}"
case "$MODE" in
  source|runtime) ;;
  *)
    echo "Usage: $0 [source|runtime]" >&2
    exit 1
    ;;
esac

mkdir -p "$AGENTS_DIR" "$LOG_DIR"

cp "$ROOT/launchd/$LAUNCHD_PLIST_NAME" "$AGENTS_DIR/"
printf '%s\n' "$MODE" > "$ROOT/launchd/.run-mode"
if [[ "$MODE" == "runtime" ]]; then
  bash "$ROOT/launchd/sync-runtime.sh"
fi
launchctl bootout "gui/$UID_NOW" "$AGENTS_DIR/$LAUNCHD_PLIST_NAME" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID_NOW" "$AGENTS_DIR/$LAUNCHD_PLIST_NAME"
launchctl kickstart -k "gui/$UID_NOW/$LAUNCHD_LABEL"

echo "Installed and loaded: $LAUNCHD_LABEL"
echo "Mode: $MODE"
echo "Open: http://127.0.0.1:8791"
