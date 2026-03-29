# Message Flow migration seed

This module is the first Vio Phase 1 migration target.

## Historical source focus
The current VioDashboard `public/app.js` contains the main flow-owned functions that should be extracted and renamed into this module family, including patterns equivalent to:
- session list fetch
- session selection flow
- history hydration flow
- session refresh flow
- send lifecycle initiation

## Initial Vio intent
This module should own front-end interaction flow, not bounded transcript rendering and not runtime truth.
