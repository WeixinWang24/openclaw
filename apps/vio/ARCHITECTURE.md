# Vio Architecture

## Original narrow Phase 1 truth chain
Gateway truth -> gateway adapter -> runtime state -> projection -> UI modules

The original narrow Phase 1 built and proved this message-runtime core. That earlier scope is now considered complete.

## Current front-end architecture reading
The current Vio front-end should be read as three interacting layers:

### 1. Message-runtime core
- message-flow
- message-shell
- runtime event binding related to message lifecycle

This remains the most important architectural core inherited from the original narrow Phase 1.

### 2. Workspace surface composition
- page-level layout composition
- workspace shell
- explorer surface
- codeview / file-editing surface
- layout-resize behavior
- other workspace-support surfaces carried forward from the old VioDashboard layout

These surfaces are no longer well-described as merely excluded or accidental residue. They are now part of the active workspace-facing front-end composition.

### 3. App composition / bootstrap layer
- app startup ordering
- runtime wiring
- event stream hookup
- shell composition

This layer has now started to be separated more explicitly:
- `bootstrap-message-runtime.js`
- `bootstrap-workspace-shell.js`
- `bootstrap-event-stream.js`

`public/app.js` still remains the browser entry, but it has already been reduced into a thinner composition layer than before.

## Current source-of-truth status
The front-end source-of-truth transition has now materially progressed:
- human-edited front-end source now lives mainly in `src/`
- `public/modules/` now acts mainly as a browser-facing bridge layer
- `public/app.js` has already been reduced into a thinner composition entry

The remaining architecture question is no longer whether front-end source should move into `src`.
That move has already largely happened.

The remaining questions are now:
- how long `public/modules/` should remain as bridge surface
- whether `public/` should settle as a thin runtime-entry layer or a publish/artifact layer
- how to clean up leftover duplicate or superseded files without destabilizing the browser path

## Formal source / publish / runtime direction
The next architecture step should now be treated as a formal model, not ad-hoc cleanup:

- `src/` = human-edited front-end source-of-truth
- publish step = transforms `src/` into browser-runnable output
- `public/` = runtime-facing space, not a second source tree

Current implemented first pass:
- keep `public/index.html`, `public/styles.css`, and a thin `public/app.js`
- publish browser JS output into `public/runtime/src/` via `node apps/vio/scripts/publish-runtime.mjs`
- `public/app.js` now loads from the published runtime tree
- real browser smoke has verified that this published runtime path can initialize Vio
- `public/modules/` has been removed and is no longer part of the active browser runtime path

Remaining follow-up:
- decide whether `public/runtime/` remains the long-term runtime output home
- clean up superseded bridge-era files and stale docs that still describe the old bridge path
- refine the publish/runtime workflow if stronger tooling becomes necessary later

This means future front-end growth should follow:
- source in `src/`
- publish to runtime output
- browser load from published runtime path

## Server runtime
`src/server/` hosts the runtime chain that supports Vio's current server side:
- gateway adapter / rpc client
- runtime state (`chatRuntime`, `transcriptService`, diagnostics, session registry)
- projection (`chatProjection`)
- route surface (`/api/sessions`, `/api/sessions/:key/history`, `/api/sessions/:key/send`)
- static public serving

## Live gateway integration status
The current runtime is wired to the live local OpenClaw Gateway.

- `runner.mjs` uses `callLiveGateway(...)` from `src/server/gateway/liveGatewayClient.mjs`
- `liveGatewayClient.mjs` reads local gateway connection info from `~/.openclaw/openclaw.json`
- request/response calls are executed through `GatewayClient` from `dist/plugin-sdk/gateway-runtime.js`
- `liveGatewayEventBridge.mjs` provides a separate live event bridge for session subscription and event forwarding
- subscribed session keys are replayed on reconnect after `onHelloOk`

This means the runtime is no longer only a stub-side injection boundary. It now has a real local-gateway-backed request path and a matching event-subscription bridge for session message flow.

## Current architectural meaning
The important transition is now:
- before: narrow Phase 1 architecture proof and seed runtime proof
- now: completed narrow Phase 1 core + live local gateway path + broader old-layout migration in progress

This does **not** mean all runtime truth, shell reconciliation, or broader front-end layering work is finished.
It means the architecture question has shifted.

The main question is no longer:
- can Vio prove the narrow message-runtime seed?

The main question is now:
- can Vio continue broader workspace-surface consolidation without letting front-end source-of-truth and composition boundaries become muddy again?
