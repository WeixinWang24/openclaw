# Non-Authoritative Services Disabled

Date: 2026-03-24

## Decision
Temporarily hard-disable non-authoritative auxiliary services so VioDashboard can stabilize around authoritative backend message flow only.

Authoritative sources now intended to be:
- `kernel.run`
- `projection.transcript`
- `session history`

## Disabled now

### 1) Sidecar / mood bridge
Files:
- `src/moodBridge.mjs`
- `src/sidecarClient.mjs` (left in repo, but no longer used by mood bridge)

Status:
- `onUserPrompt()` -> no-op
- `onAssistantFinal()` -> no-op
- `onAssistantError()` -> no-op

### 2) Body / light telemetry UI
Files:
- `public/app.js`

Status:
- `refreshVioBodyState()` no longer fetches `/api/vio-body-state`
- environment/body display now shows `disabled · pending redesign`
- body/light link labels now show disconnected state

### 3) Notifications
Files:
- `src/server/notifications.mjs`
- transitively affects `src/server/agentTasks/runtimeBridge.mjs`
- transitively affects final reply notification path in `src/server/runtime/finalReplyService.mjs`

Status:
- `sendNotification()` is now a no-op
- helper notification wrappers still exist, but dispatch nothing

### 4) Gesture side-effects
Files:
- `src/server/gesture.mjs`

Status:
- gesture recognition/capture pipeline remains readable
- `applyGestureAction()` no longer emits side-effects
- returns `disabled` / `gesture-side-effects-disabled`

## Pending redesign / repair list
1. Rebuild an explicit runtime-facing auxiliary service contract.
2. Reintroduce notifications only after defining ownership, lifecycle, and failure semantics.
3. Redesign body/light telemetry as pure observability, never state authority.
4. Redesign gesture actions behind explicit command routing instead of hidden side-effects.
5. Remove dead sidecar client code if no replacement architecture keeps it.
