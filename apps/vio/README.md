# Vio

Vio is the rebuilt successor system seeded from the VioDashboard message-runtime core.

## Phase 1 scope
- Message Flow
- MessageShell
- minimal Page Shell

## Explicitly excluded from Phase 1
- message environment
- Claude interface
- explorer/editor/terminal
- replies
- camera/gesture/vision
- routing/telemetry/setup/diagnostics

## Current local runtime status
- Front-end Phase 1 modules currently live under `public/modules/`.
- `message-flow`, `message-shell`, and `page-shell` are intentionally kept in `public/modules/` as the current runtime truth for the Phase 1 front-end.
- Future modules and later feature work should default to `src/` unless they are explicitly part of the existing Phase 1 browser runtime chain.
- A minimal Phase 1 server skeleton now exists under `src/server/`.
- Local smoke harness: `node apps/vio/src/server/smoke.mjs`
- Local runner seed: `node apps/vio/src/server/runner.mjs`
- `runner.mjs` is intentionally not wired to a real Gateway client yet; it marks the injection boundary for the future gateway-backed adapter.
