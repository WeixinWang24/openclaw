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
