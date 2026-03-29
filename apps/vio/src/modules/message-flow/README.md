# message-flow

This module owns Vio Phase 1 front-end interaction flow.

## Owned scope
- session list fetch coordination
- session selection flow
- history hydration flow
- send initiation flow
- refresh / reconcile flow

## Non-owned scope
- bounded transcript rendering (`message-shell`)
- page layout (`page-shell`)
- backend runtime truth

## Historical extraction target
Primary source currently lives inside `apps/viodashboard/public/app.js` in functions such as:
- `fetchDashboardSessions`
- `fetchMessageFlowHistory`
- `selectMessageFlowSession`
- `refreshSessionHistory`
- `scheduleSessionRefresh`
