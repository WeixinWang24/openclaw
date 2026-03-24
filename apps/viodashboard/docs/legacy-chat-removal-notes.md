# Legacy Chat Removal Notes

## Intent
Retire the legacy `type: 'chat'` websocket/event path from VioDashboard.

## Known legacy surfaces (to verify/update during removal)
- Event name: `chat`
- Old reasons/source labels: `legacy-chat:*`, `legacy.delta-compat`, `legacy.onChatEvent`
- Suspected producers: `src/server/runtime/chatEventCoordinator.mjs`
- Suspected consumers: `public/app.js`, `public/index.html`, `public/telemetry.js`

## Replacement authoritative sources
- `kernel.run`
- `projection.transcript`
- `session history`

## Removal rule
Legacy chat must not decide streaming/final/error/aborted UI state after retirement.
