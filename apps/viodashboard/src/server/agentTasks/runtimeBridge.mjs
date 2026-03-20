// Runtime bridge: connects the agent task store to real runtime signals.
// MVP: provides a demo/mock task seeder and placeholder hooks for future
// integration with Claude CLI PTY output and gateway events.

import { setCurrentTask, getCurrentTask, advancePhase, appendLog, markFinishedByClaude } from './store.mjs';
import { emitMilestone, emitTouchedFiles, emitValidation, emitCompletionHandoff } from './events.mjs';

/**
 * Seed a demo task for development and manual testing.
 * Demonstrates the full completion handoff lifecycle.
 */
export function seedDemoTask() {
  const existing = getCurrentTask();
  if (existing && existing.status === 'running') {
    return existing;
  }

  const task = setCurrentTask({
    title: 'Implement completion handoff state machine',
    owner: 'vio',
    executor: 'claude',
    status: 'running',
    phase: 'coding',
    promptSummary: 'Add structured completion handoff so finished work is durably visible and reviewable.',
    startedAt: new Date().toISOString(),
  });

  // Simulate coding phase
  advancePhase('coding', 'Claude started implementation');
  emitMilestone('Backend handoff model added', { detail: 'types, store, events extended' });
  emitMilestone('API review routes wired', { detail: 'start-review, accept, needs-fix endpoints' });
  emitMilestone('Frontend review actions added', { detail: 'review panel with accept/needs-fix buttons' });
  emitTouchedFiles([
    'src/server/agentTasks/types.mjs',
    'src/server/agentTasks/store.mjs',
    'src/server/agentTasks/events.mjs',
    'src/server/agentTasks/runtimeBridge.mjs',
    'src/server/routes/agentTasks.mjs',
    'public/claude.html',
    'public/claude.js',
    'public/claude.css',
  ]);

  // Simulate testing + completion
  advancePhase('testing', 'Running validation');
  emitValidation('Tests pass', { tests: { status: 'pass', summary: '4/4 passed' } });
  emitValidation('Commit created', { commit: { sha: 'abc1234', message: 'feat: completion handoff state machine' } });

  // Signal completion -- task is now finished_by_claude, waiting for review
  emitCompletionHandoff('Claude finished: completion handoff state machine implemented');

  appendLog({ level: 'info', text: 'Demo task seeded (finished_by_claude, awaiting review)' });

  return task;
}

/**
 * Placeholder: called when Claude CLI PTY emits output.
 * Future integration point.
 */
export function onClaudeOutput(text) {
  const task = getCurrentTask();
  if (!task || task.status !== 'running') { return; }
  appendLog({ level: 'debug', text: text.slice(0, 500) });
}

/**
 * Placeholder: called when gateway events indicate task progress.
 * Recognizes completion signals and triggers handoff.
 */
export function onGatewayEvent(event) {
  const task = getCurrentTask();
  if (!task) { return; }
  if (event.type === 'final' && task.status === 'running') {
    appendLog({ level: 'info', text: 'Gateway final reply received' });
    markFinishedByClaude('Claude completed via gateway signal');
  }
}

/**
 * Called when any runtime detects Claude has finished.
 * Ensures durable completion state regardless of signal source.
 */
export function onCompletionSignal(message = 'Claude signaled completion') {
  const task = getCurrentTask();
  if (!task || task.completionEventSeen) { return task; }
  return markFinishedByClaude(message);
}
