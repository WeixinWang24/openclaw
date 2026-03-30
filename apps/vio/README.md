# Vio

Vio is the rebuilt successor system seeded from the VioDashboard message-runtime core.

## Original Phase 1 scope
The originally defined narrow Phase 1 was:
- Message Flow
- MessageShell
- minimal Page Composer

That original narrow Phase 1 is now considered complete.

## Current front-end migration stage
Vio is no longer only in the original narrow Phase 1 bootstrap state.

The project has now moved into a broader front-end migration stage that includes:
- continued message-runtime core work
- migration of the old VioDashboard layout shell
- migration of selected related workspace-support functionality

This means the current front-end should not be described as only the original minimal page composer anymore.

## Current local runtime status
- Human-edited front-end source-of-truth has now moved substantially into `src/`.
- The main front-end JS modules now live under:
  - `src/app/bootstrap/`
  - `src/modules/phase1/`
  - `src/modules/runtime-support/`
  - `src/modules/workspace-support/`
- A first formal publish/runtime path now exists.
- Current browser-runnable JS is published into `public/runtime/src/`.
- `src/app.js` is the browser-entry source-of-truth.
- `publish-runtime.mjs` now republishes that entry into `public/app.js` and rewrites its import path for the browser runtime tree.
- `public/modules/` has now been removed from the active runtime path and retired as the browser module tree.
- The current front-end runtime includes not only message runtime modules, but also active workspace-surface modules such as explorer, codeview/code-reader, and layout-resize behavior.
- Front-end source-of-truth consolidation is therefore no longer only a plan; the main JS migration into `src/` has already happened, the first publish/runtime step has been validated in a real browser smoke, and the old `public/modules/` bridge layer has been retired.
- A minimal Phase 1 server runtime exists under `src/server/`.
- Local smoke harness: `node apps/vio/src/server/smoke.mjs`
- Local runner: `node apps/vio/src/server/runner.mjs`
- Runtime publish step: `node apps/vio/scripts/publish-runtime.mjs`
- Browser-path smoke: `node apps/vio/scripts/smoke-browser.mjs`
- Fast local dev check: `pnpm vio:dev-check`
- Scoped format check: `pnpm vio:format-check`
- Fast refresh workflow: `pnpm vio:dev-refresh`
- Direct refresh script: `bash apps/vio/scripts/dev-refresh.sh`
- launchd service: `com.vio.phase1` on port `8792`
- launchd helper: `bash apps/vio/scripts/dev-launchd.sh status|start|stop|restart|logs`
- `runner.mjs` now calls the live local OpenClaw Gateway through `gateway/liveGatewayClient.mjs`.
- The live gateway client reads connection details from `~/.openclaw/openclaw.json` and connects to the local Gateway via `GatewayClient` from the repo dist runtime.
- A live event bridge also exists under `src/server/gateway/liveGatewayEventBridge.mjs` and can subscribe to `sessions.messages.subscribe` for session event flow.
- The runtime is no longer only a future gateway injection boundary; it now has a real local-gateway-backed path for request/response integration.

## Current engineering focus
The main engineering focus is now:
1. keep the live gateway-backed runtime path healthy
2. continue broader old-layout migration deliberately
3. refine the source -> publish -> runtime workflow now that the transition has landed
4. keep runtime entry and publish scope clean as more modules arrive

## Current stable baseline (2026-03 Claude PTY recovery work)
Right now the most reliable browser surface is the **minimal Claude PTY recovery shell**.

That baseline currently provides:
- a minimal browser page served from `src/app.js` -> published to `public/app.js`
- automatic Claude PTY start/attach on page load
- auto-recovery when page attach finds a `running` session whose PTY stream is blank
- clean restart behavior when the last Claude PTY session had already terminated

Practical implication:
- if richer old-shell UI work is unstable, prefer keeping this minimal Claude PTY shell healthy first
- treat it as the known-good operational baseline before reintroducing more complex dashboard/layout layers

## Publish / launch workflow
Current recommended workflow:

### Fast local check
```bash
pnpm vio:dev-check
```

This will:
1. run scoped format check for `apps/vio`
2. publish front-end runtime output
3. run browser-path smoke

### Fast refresh
```bash
pnpm vio:dev-refresh
```

This will:
1. publish front-end runtime output
2. kickstart launchd service `com.vio.phase1`
3. wait for port `8792`
4. run browser-path smoke

### Manual path
```bash
node apps/vio/scripts/publish-runtime.mjs
bash apps/vio/scripts/dev-launchd.sh restart
node apps/vio/scripts/smoke-browser.mjs
```

### Quick troubleshooting
```bash
bash apps/vio/scripts/dev-launchd.sh status
bash apps/vio/scripts/dev-launchd.sh logs
```

If the page opens but Claude PTY is blank on first attach, the current minimal shell is expected to auto-recover it. If service state itself looks bad, restart launchd first before debugging front-end behavior.

Current publish scope:
- `src/app/`
- `src/modules/`
- `src/shared/`

Current runtime output:
- `public/runtime/src/`

## Session-aware run lifecycle contract
Phase 1 now treats session run status as flow-owned runtime truth, not shell-local transient UI state.

If later modules need to know whether a session is currently active / thinking / streaming / terminal, they should read that state from MessageFlow rather than infer it from chat DOM or MessageShell internals.

Current intended read path:
- `flow.getSessionRunState(sessionKey)`

Current lifecycle shape:
- `runId`
- `status` (`idle | started | acknowledged | streaming | final | error | aborted`)
- `updatedAt`
- `source`

Write / sync paths:
- realtime kernel events -> `flow.applyRunEvent(event)`
- history / projection refresh -> `flow.syncSessionRunStateFromView(sessionKey, view, viewMeta)`

Pending cleanup rule:
- terminal run states (`final`, `error`, `aborted`) are allowed to settle lingering pending message rendering for that session after refresh reconciliation.

Guideline for future workspace-facing modules:
- use MessageFlow as the session-aware run-state owner
- do not store independent streaming truth in Explorer / CodeReader / page/workspace UI modules unless that state is explicitly derived from MessageFlow
