# viostate v0.1

## Goal

Introduce a device-aware runtime state backbone for VioDashboard.

This first version focuses on:
- device-scoped state isolation
- workspace/session/checkpoint structure
- `active.json` as the recovery entrypoint
- `summaries/latest.json` as a best-effort derived summary
- keeping heartbeat out of the runtime authority path

## Directory shape

```text
viostate/
  devices/
    <deviceId>/
      device.json
      workspaces/
        <workspaceKey>/
          workspace.json
          active.json
          summaries/
            latest.json
          sessions/
            <sessionId>/
              session.json
              checkpoints/
                <timestamp>.json
```

## Runtime write chain

`saveViostateSnapshot()` is the main entrypoint.

Write order:
1. resolve `deviceId`
2. resolve `workspaceKey`
3. ensure `device.json`
4. ensure `workspace.json`
5. upsert `session.json`
6. append a checkpoint when needed
7. overwrite `active.json`
8. best-effort rewrite `summaries/latest.json`

## Boundary rules

- `session.json` is rolling runtime state.
- checkpoint files are append-only recovery points.
- `active.json` is a short recovery index, not a history log.
- `summaries/latest.json` is derived and rebuildable.
- heartbeat may repair/rebuild summaries later, but should not own runtime state writes.

## Current module layout

```text
src/server/viostate/
  index.mjs
  types.mjs
  constants.mjs
  paths.mjs
  ids.mjs
  fs.mjs
  records.mjs
  runtime.mjs
  summary.mjs
  service.mjs
```

## Known v0.1 gaps

- `resolveWorkspaceKey()` is still coarse.
- latest-checkpoint scanning is stubbed for now.
- `session.lastCheckpointPath` is only updated in-memory in the first pass.
- summary staleness marking / repair hooks are not wired yet.
- no production call site is connected yet.

## Recommended first integration points

Prefer these events:
1. focus change
2. explicit save / summarize action
3. milestone / phase completion

Avoid in the first pass:
- high-frequency UI micro-events
- heartbeat timer writes
- per-keystroke state updates
