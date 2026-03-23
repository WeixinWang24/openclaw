---
name: viodashboard-claude-dispatch
description: Dispatch coding or investigation tasks to Claude Code through the VioDashboard Claude panel and verify the real delivery path. Use when a user asks to send work through the sidecar Claude task dashboard instead of local edits or ACP, especially for tasks in apps/viodashboard or /Users/visen24/MAS/openclaw_fork. Also use when diagnosing why a dashboard task looked completed, whether the composer uses POST dispatch correctly, or whether results were actually delivered.
---

# VioDashboard Claude Dispatch

Use the dashboard as a product surface, not as a raw terminal.

## Core rule

When sending a task through the VioDashboard Claude composer, treat the intended path as:

1. Frontend composer submit
2. `POST /api/agent-tasks/dispatch`
3. `sendClaudeInput(...)`
4. Claude sidecar / terminal runtime
5. agent-task lifecycle + dashboard status updates

Do **not** assume the correct way is to paste text into the PTY directly.

If browser automation is used, it is acceptable to fill the composer UI and trigger its submit flow, but the goal is to exercise the app's real dispatch path, not bypass it.

## Relevant code to inspect first

### Frontend

- `apps/viodashboard/public/index.html`
  - `#claudeComposer`
  - `#claudeComposerInput`
  - `#claudeComposerSendBtn`
- `apps/viodashboard/public/app.js`
  - `submitClaudeComposer()`
  - debug lines:
    - `Claude composer send len=...`
    - `Claude composer send accepted.`

Important behavior in `submitClaudeComposer()`:

```js
await fetch("/api/agent-tasks/dispatch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: value, cwd: claude.cwd }),
});
```

### Backend

- `apps/viodashboard/src/server/routes/agentTasks.mjs`
  - `POST /api/agent-tasks/dispatch`
- `apps/viodashboard/src/server.mjs`
  - lower-level `POST /api/claude/input`
- `apps/viodashboard/src/server/agentTasks/runtimeBridge.mjs`
  - task/runtime binding
  - completion detection
  - handoff logic

## Dispatch workflow

### 1. Confirm the intended path before sending

Check that the composer still submits to `/api/agent-tasks/dispatch` and has not drifted back to a direct terminal-only path.

If the user asks to validate the module itself, inspect:

- `submitClaudeComposer()` in `public/app.js`
- `handleAgentTaskRoutes()` in `src/server/routes/agentTasks.mjs`

### 2. Send through the composer path

Preferred approaches:

- Use the browser/UI to fill the Claude composer and submit
- Or call the same API path deliberately if testing the backend path itself

Do not describe this as "just pasting into Claude" unless you are explicitly bypassing the UI for a low-level terminal test.

### 3. Verify acceptance

A successful submit should usually produce these signs:

- composer input clears
- send button disables briefly / shows sending state
- debug log contains:
  - `Claude composer send len=...`
  - `Claude composer send accepted.`

These indicate the frontend submit path succeeded.

## Completion/result verification

Dashboard "completed" is **not** enough to prove correct delivery.

Always separate:

- **dispatch success**
- **runtime completion**
- **actual code/result delivery**

### Reliable verification order

1. Check repo diff / changed files in the target repo
2. Check whether touched files match the requested task
3. Only then trust dashboard completion as meaningful delivery

For target repo work, inspect for example:

```bash
cd /Users/visen24/MAS/openclaw_fork
git status --short
git diff -- <likely paths>
```

### Treat these as weak signals only

- `apps/viodashboard/data/claude/claude-default.status.json`
- `apps/viodashboard/data/claude/claude-default.log`

They may reflect stale or generic termination state and may not contain a structured final summary for the latest task.

## When the dashboard says Claude completed but the result is unclear

Use this triage:

1. Inspect repo diff in the requested working tree
2. Compare changed files against the requested task scope
3. If unrelated files changed, conclude the delivery binding is unreliable for that run
4. Report separately:
   - dispatch path worked
   - completion status fired
   - result attribution / recovery did not reliably prove correct task delivery

## How to talk about the module accurately

Prefer wording like:

- "I submitted the task through the dashboard composer, which posts to `/api/agent-tasks/dispatch`."
- "The dashboard accepted the dispatch, but I still need to verify repo-side delivery."
- "Completion status alone does not prove the requested fix was applied."

Avoid wording like:

- "I just pasted the task into Claude" when the real path was the composer POST flow
- "Claude finished the fix" before checking repo diff

## Known lessons to preserve

- Composer send is a real product/API path, not merely a terminal paste shortcut.
- `POST /api/agent-tasks/dispatch` is the main task entry point for the dashboard Claude module.
- `/api/claude/input` is a lower-level terminal input API, not the main composer contract.
- Current dashboard completion signaling can be stronger than its result-recovery/structured-summary layer.
- When in doubt, verify the target repo diff instead of trusting sidecar status artifacts.
