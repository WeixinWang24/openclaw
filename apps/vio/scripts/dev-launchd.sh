#!/bin/bash
set -euo pipefail

LABEL="com.vio.phase1"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
PORT="8792"
USER_DOMAIN="gui/$(id -u)"

usage() {
  cat <<EOF
Usage: $(basename "$0") <status|start|stop|restart|logs>

Commands:
  status   Show launchd state and probe http://127.0.0.1:${PORT}/
  start    bootstrap launchd plist if needed, then kickstart service
  stop     stop launchd service if loaded
  restart  stop (best effort) then start
  logs     tail recent VioPhase1 launchd logs
EOF
}

ensure_plist() {
  mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/VioPhase1"
  if [[ ! -f "$PLIST" ]]; then
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>/Users/visen24/MAS/openclaw_fork/apps/vio/launchd/run-vio-phase1.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/visen24/MAS/openclaw_fork</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ProcessType</key>
    <string>Background</string>
    <key>StandardOutPath</key>
    <string>/Users/visen24/Library/Logs/VioPhase1/launchd-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/visen24/Library/Logs/VioPhase1/launchd-stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>/Users/visen24/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
      <key>NODE_ENV</key>
      <string>production</string>
    </dict>
  </dict>
</plist>
EOF
    echo "Wrote $PLIST"
  fi
}

probe_http() {
  python3 - <<'PY'
import urllib.request
try:
    with urllib.request.urlopen('http://127.0.0.1:8792/', timeout=2) as r:
        print(f'HTTP 127.0.0.1:8792 -> {r.status}')
except Exception as e:
    print(f'HTTP 127.0.0.1:8792 -> DOWN ({e})')
PY
}

wait_http_up() {
  python3 - <<'PY'
import time, urllib.request, sys
for _ in range(20):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8792/', timeout=1.5) as r:
            print(f'HTTP 127.0.0.1:8792 -> {r.status}')
            raise SystemExit(0)
    except Exception:
        time.sleep(0.4)
print('HTTP 127.0.0.1:8792 -> DOWN')
raise SystemExit(1)
PY
}

kill_port_owner() {
  python3 - <<'PY'
import os, signal, subprocess
out = subprocess.check_output(['ps','-axo','pid=,command='], text=True)
for line in out.splitlines():
    s = line.strip()
    if 'apps/vio/src/server/runner.mjs' not in s:
        continue
    pid = int(s.split(None, 1)[0])
    try:
        os.kill(pid, signal.SIGTERM)
        print(f'Terminated stale runner pid={pid}')
    except ProcessLookupError:
        pass
PY
}

show_status() {
  echo "== launchctl =="
  launchctl print "${USER_DOMAIN}/${LABEL}" 2>/dev/null | sed -n '1,60p' || echo "Service not loaded"
  echo
  echo "== http probe =="
  probe_http
}

start_service() {
  ensure_plist
  kill_port_owner || true
  launchctl bootout "$USER_DOMAIN/$LABEL" 2>/dev/null || true
  launchctl bootstrap "$USER_DOMAIN" "$PLIST"
  launchctl enable "$USER_DOMAIN/$LABEL" 2>/dev/null || true
  launchctl kickstart -k "$USER_DOMAIN/$LABEL"
  wait_http_up
  show_status
}

stop_service() {
  launchctl bootout "$USER_DOMAIN/$LABEL" 2>/dev/null || true
  kill_port_owner || true
  echo "Stopped ${LABEL}"
}

show_logs() {
  for f in "$HOME/Library/Logs/VioPhase1/launchd-stdout.log" "$HOME/Library/Logs/VioPhase1/launchd-stderr.log" "$HOME/Library/Logs/VioPhase1/stdout.log" "$HOME/Library/Logs/VioPhase1/stderr.log"; do
    if [[ -f "$f" ]]; then
      echo "== $f =="
      tail -n 80 "$f"
      echo
    fi
  done
}

cmd="${1:-status}"
case "$cmd" in
  status) show_status ;;
  start) start_service ;;
  stop) stop_service ;;
  restart) stop_service; start_service ;;
  logs) show_logs ;;
  *) usage; exit 2 ;;
esac
