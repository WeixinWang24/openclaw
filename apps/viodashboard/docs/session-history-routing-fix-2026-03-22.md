# VioDashboard session history + routing fix — 2026-03-22

## Symptoms

- Rapidly switching between session tabs could show the wrong message history.
- Replies from `review` could appear under `main` in VioDashboard.
- Sending from VioDashboard to non-main sessions could appear unreliable until refresh.

## Root causes

### 1) Frontend session-switch race

Older history requests could resolve after a newer tab selection and overwrite the currently selected pane.

### 2) Lost session routing on chat events

Gateway chat events for non-main sessions were not preserving `sessionKey` all the way through the dashboard bridge, so the frontend could fall back to the gateway main session and render replies in the wrong tab.

## Fixes applied

### Frontend (`public/app.js`)

- Added `sessionSelectionSeq` generation on session selection.
- Added stale-render guards before rendering fetched history.
- Added targeted refresh scheduling for non-main session sends.
- Added optimistic user-message render for non-main sends.
- Added buffered main-session stream continuity so switching away from `main` during streaming does not lose the visible tail when switching back.
- Forced refresh when selecting a session marked dirty/pending or when selecting a streaming main session.

### Bridge (`src/server/gatewayBridge.mjs`)

- Preserved `sessionKey` on forwarded chat events.
- Restricted main-run correlation logic to main-session events only.
- Avoided applying main-only finalization/token-side effects to non-main session events.

## Validation observed

Confirmed during manual testing:

- rapid tab switching no longer corrupted the visible history pane
- `review` replies no longer rendered under `main`
- sending inside VioDashboard `review` produced replies in `review`
- Gateway UI and VioDashboard session views aligned again after refresh

## Follow-up

Keep the current debug lines temporarily for soak testing.
If no regressions show up after normal use, reduce noisy `cache/start/resolved` debug output later while keeping the key stale/routing diagnostics.

---

## 2026-03-24 perf follow-up: cold first history

### New symptom

After the routing fix, the first `GET /api/sessions/:key/history` after dashboard reload could still take several seconds, even when later refreshes were fast.

### What was measured

Observed timings during investigation:

- `history_default` cold path: about `6908ms`
- `history_refresh=true` warm path: about `1267ms`
- transcript normalization itself: about `0ms`
- warm `sessions.get` fetch inside transcript service: about `107ms`

Direct helper/RPC timing isolated the cold-start cost further:

- `gateway-rpc-*.js` first dynamic import: about `1013ms`
- `gatewayCall('sessions.get')` cold #1: about `3276ms`
- `gatewayCall('sessions.get')` warm #2: about `349ms`
- `gatewayCall('sessions.get')` warm #3: about `14ms`

### Root cause refinement

The main remaining delay was not history normalization or rendering. The dominant cold-start cost came from:

1. dynamic resolution/import of the OpenClaw gateway helper from `dist/`
2. first helper-backed `sessions.get` initialization cost

### Fixes applied

#### Backend history path softening

- Added runtime timing diagnostics for transcript fetches.
- Reduced transcript overfetch to a more conservative window.
- Changed `/api/sessions/:key/history` to prefer cached/projection-backed responses when available, then refresh in the background.

#### Startup prewarm

- Added startup-time `warmGatewayCaller()` prewarm in `src/server.mjs`.
- Added helper-resolution timing logs in `src/server/gatewayBridge.mjs`.
- Kept runtime RPC fallback behavior intact if bridge-scope fast path is unavailable.

### Validation observed after prewarm

After reload with helper prewarm enabled:

- first history after reload: about `134ms`
- second history request: about `2ms` (cache hit)
- `/api/sessions` first list: about `101ms`, second list: about `7ms`
- non-main sessions also stayed fast:
  - `agent:main:main` refresh: `23ms`
  - `agent:main:subagent:...` refresh: `15ms`
  - `agent:main:heartbeat` refresh: `8ms`

### Takeaway

If session history feels slow again, check helper cold-start and gateway helper resolution before blaming transcript shaping or frontend render work. For this incident, startup prewarm removed the largest user-visible first-load delay.
