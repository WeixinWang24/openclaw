// Runtime bridge: connects the agent task store to real runtime signals.
// MVP: provides a demo/mock task seeder and placeholder hooks for future
// integration with Claude CLI PTY output and gateway events.

import { setCurrentTask, getCurrentTask, advancePhase, appendLog } from './store.mjs';
import { emitMilestone, emitTouchedFiles } from './events.mjs';

/**
 * Seed a demo task for development and manual testing.
 * In production this would be triggered by Vio dispatching work to Claude.
 */
export function seedDemoTask() {
  const existing = getCurrentTask();
  if (existing && existing.status === 'running') {
    return existing;
  }

  const task = setCurrentTask({
    title: 'Implement Claude task page MVP',
    owner: 'vio',
    executor: 'claude',
    status: 'running',
    phase: 'coding',
    promptSummary: 'Build the first usable frontend+backend version of a structured Claude task visibility page.',
    startedAt: new Date().toISOString(),
  });

  // Simulate some history
  advancePhase('coding', 'Claude started implementation');
  emitMilestone('Backend module scaffolded', { detail: 'types, store, events, runtimeBridge created' });
  emitMilestone('API routes registered', { detail: '4 endpoints wired' });
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
  appendLog({ level: 'info', text: 'Demo task seeded for development' });

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
 * Future integration point.
 */
export function onGatewayEvent(event) {
  const task = getCurrentTask();
  if (!task || task.status !== 'running') { return; }
  if (event.type === 'final') {
    appendLog({ level: 'info', text: 'Gateway final reply received' });
  }
}
