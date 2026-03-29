# Message Shell migration seed

Primary historical source currently lives in `apps/viodashboard/public/app.js` under `createNewChatShell(...)`.

Important extraction targets include:
- `mountSession`
- `renderCanonicalHistory`
- `reconcileHistory`
- `send`
- pending-row handling

This Vio-side seed should remain shell-bounded and must not reclaim message-flow ownership.
