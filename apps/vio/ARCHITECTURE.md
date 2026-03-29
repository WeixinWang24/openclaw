# Vio Architecture

## Phase 1 truth chain
Gateway truth -> gateway adapter -> runtime state -> projection -> UI modules

## Phase 1 front-end modules
- page-shell
- message-flow
- message-shell

## Rule
`public/app.js` is bootstrap only. Excluded module families must remain absent until post-Phase-1 review.

## Phase 1 server seed
`src/server/` now hosts the minimal runtime chain for Phase 1:
- gateway adapter / rpc client
- runtime state (`chatRuntime`, `transcriptService`, diagnostics, session registry)
- projection (`chatProjection`)
- route surface (`/api/sessions`, `/api/sessions/:key/history`, `/api/sessions/:key/send`)
- static public serving

The current `runner.mjs` defines the intended injection boundary for a future real Gateway-backed `gatewayCall` implementation. Until that adapter is wired, smoke coverage should prefer the local stubbed harness rather than pretending the real bridge exists.

## Current real-gateway adapter blocker
As of 2026-03-29, the live local Gateway config was last written by OpenClaw `2026.3.24`, while this repo's currently installed `node_modules/openclaw` client/dist payload is still `2026.3.13`. Do not wire `runner.mjs` to the repo-local dist Gateway client until the client/runtime versions are aligned, or the adapter explicitly targets the live runtime's matching client implementation.
