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

## Recovery read chain

`restoreWorkspaceState()` now provides the first unified recovery read path.

Read order:
1. read `device.json`
2. read `workspace.json`
3. read `active.json`
4. read `summaries/latest.json`
5. resolve the active session
6. load `session.json`
7. load the newest checkpoint for that session
8. return a compact `recoveryView` with headline / focus / task / resume hint / next steps / decisions / blockers

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

- `resolveWorkspaceKey()` is now repo/subproject-aware, but still basic.
- latest-checkpoint scanning exists for the active session, but broader recovery helpers are still thin.
- summary staleness marking / repair hooks are not wired yet.
- the first production call site is connected through `agentTasks` lifecycle events.
- no heartbeat maintenance / stale repair flow is connected yet.

## Recommended first integration points

Prefer these events:
1. focus change
2. explicit save / summarize action
3. milestone / phase completion

Avoid in the first pass:
- high-frequency UI micro-events
- heartbeat timer writes
- per-keystroke state updates
