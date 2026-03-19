# Project Roadmap — viodashboard

_Last updated: 2026-03-19T21:28:19.163Z_

## Project Design
- Goal: Build VioDashboard as a practical wrapper/runtime surface for OpenClaw workflows, with memory-system integration and recoverable project-state handling.
- Architecture approach: Keep response-roadmap UI state separate from project recovery state; use `data/roadmap.json` for reply/UI extraction and `roadmap.md` for session-recovery context.
- Constraints: Prefer minimal app-local changes first; avoid premature deep coupling between `roadmap.md` and `memory_system`.
- Rules already in effect: `roadmap.md` is a recovery-first project document and should be updated during code-project work.

## Current State
- Current focus: Separate response roadmap from project roadmap semantics and make `roadmap.md` useful for session recovery.
- Current phase: Early implementation of a recovery-oriented roadmap mechanism in VioDashboard.
- Blockers: Project-root detection and richer automatic change capture are still minimal.
- Latest state note: `roadmap.md` should capture project state, not just next-step bullets from one reply.
- Latest reply signal: Refactored roadmap semantics toward a recovery-first model.

## Implemented
- 2026-03-19T21:18:34.843Z — Initial `roadmap.md` automation landed in the app root.
- 2026-03-19T21:18:34.844Z — First append flow validated from the roadmap module.
- 2026-03-19T21:28:19.163Z — Reframed `roadmap.md` as a recovery-first project document instead of a persisted copy of response roadmap bullets.
  - Separated response-roadmap semantics from project-roadmap semantics.
  - Promoted `roadmap.md` toward a short-term recovery artifact.

## Next Steps
- Improve project-root detection so roadmap maintenance can target the actual active code project, not only the default VioDashboard root.
- Capture more state-relevant change signals, such as changed files, design decisions, and current blockers.
- Add experience-layer / short-term-layer runtime APIs so `roadmap.md` can align with the broader three-layer memory model.

## Recovery Notes
- Resume from: read this file first, then inspect `data/roadmap.json` only for reply/UI roadmap state.
- Key files to read first: `roadmap.md`, `src/server.mjs`, `src/server/projectRoadmap.mjs`, `src/server/memorySystem.mjs`.
- Active assumptions: `roadmap.md` is the project recovery document; `data/roadmap.json` remains response-roadmap/UI state.
- Initial context: Recovery-oriented roadmap model.
