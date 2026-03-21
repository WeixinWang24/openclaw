// Runtime bridge: connects the agent task store to real runtime signals.
// Registers real Claude background runs as agentTasks, syncs runtime identity,
// and drives the completion handoff state machine on process exit.

import { setCurrentTask, getCurrentTask, updateCurrentTask, advancePhase, appendLog, markFinishedByClaude } from './store.mjs';
import { emitMilestone, emitTouchedFiles, emitValidation, emitCompletionHandoff, emitError } from './events.mjs';

/**
 * Register a real Claude background run as the current agent task.
 * Called from claudeTerminal when a new session is started.
 * @param {object} sessionInfo - Claude session metadata
 * @param {string} sessionInfo.sessionId
 * @param {number|null} sessionInfo.bridgePid
 * @param {string} sessionInfo.cwd
 * @param {string} sessionInfo.cwdAbs
 * @param {string} sessionInfo.claudeCommand
 * @param {string} sessionInfo.startedAt
 * @param {string} [sessionInfo.promptText] - optional prompt/instruction text
 */
export function registerRealTask(sessionInfo) {
  // If there's already a running real task for the same session, just update runtime
  const existing = getCurrentTask();
  if (existing && existing.status === 'running' && existing.runtime?.sessionId === sessionInfo.sessionId) {
    updateCurrentTask({
      runtime: buildRuntimeMeta(sessionInfo),
    });
    appendLog({ level: 'info', text: `Runtime refreshed for session ${sessionInfo.sessionId}` });
    return existing;
  }

  const now = new Date().toISOString();
  const task = setCurrentTask({
    title: sessionInfo.promptText
      ? sessionInfo.promptText.slice(0, 120)
      : `Claude task (${sessionInfo.sessionId})`,
    owner: 'vio',
    executor: 'claude',
    status: 'running',
    phase: 'coding',
    cwd: sessionInfo.cwd || null,
    promptSummary: sessionInfo.promptText || null,
    startedAt: sessionInfo.startedAt || now,
    runtime: buildRuntimeMeta(sessionInfo),
  });

  advancePhase('coding', 'Claude session started');
  appendLog({ level: 'info', text: `Real task registered: session=${sessionInfo.sessionId} pid=${sessionInfo.bridgePid}` });

  return task;
}

/**
 * Sync real task state from the live Claude session.
 * Called periodically from the server polling loop.
 * Detects exit/completion and drives the handoff state machine.
 * @param {object} claudeState - from getClaudeState()
 */
export function syncRealTaskFromClaudeState(claudeState) {
  const task = getCurrentTask();
  if (!task || !task.runtime?.sessionId) { return; }
  // Only sync if the task belongs to this Claude session
  if (task.runtime.sessionId !== claudeState.sessionId) { return; }

  // Update runtime liveness
  updateCurrentTask({
    runtime: {
      ...task.runtime,
      bridgeAlive: claudeState.running,
      lastSyncAt: new Date().toISOString(),
    },
  });

  // If task is still running but Claude has exited, trigger completion handoff
  if (task.status === 'running' && !claudeState.running && claudeState.exited) {
    const exitCode = claudeState.exitCode;
    if (exitCode === 0 || exitCode === null) {
      appendLog({ level: 'info', text: `Claude process exited (code=${exitCode}), triggering completion handoff` });
      markFinishedByClaude(`Claude finished (exit code ${exitCode ?? 'unknown'})`);
    } else {
      appendLog({ level: 'warn', text: `Claude process exited with error code ${exitCode}` });
      updateCurrentTask({ status: 'failed' });
      advancePhase('done', `Claude exited with error (code=${exitCode})`);
      emitError(`Claude process failed (exit code ${exitCode})`, { exitCode });
    }
  }
}

function buildRuntimeMeta(sessionInfo) {
  return {
    sessionId: sessionInfo.sessionId,
    bridgePid: sessionInfo.bridgePid ?? null,
    claudeCommand: sessionInfo.claudeCommand || null,
    cwd: sessionInfo.cwdAbs || sessionInfo.cwd || null,
    startedAt: sessionInfo.startedAt || new Date().toISOString(),
    bridgeAlive: true,
    source: 'claude-terminal',
  };
}

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

  advancePhase('testing', 'Running validation');
  emitValidation('Tests pass', { tests: { status: 'pass', summary: '4/4 passed' } });
  emitValidation('Commit created', { commit: { sha: 'abc1234', message: 'feat: completion handoff state machine' } });

  emitCompletionHandoff('Claude finished: completion handoff state machine implemented');

  appendLog({ level: 'info', text: 'Demo task seeded (finished_by_claude, awaiting review)' });

  return task;
}

/**
 * Called when Claude CLI PTY emits output.
 * Streams log lines into the task event/log layer.
 */
export function onClaudeOutput(text) {
  const task = getCurrentTask();
  if (!task || task.status !== 'running') { return; }
  appendLog({ level: 'debug', text: text.slice(0, 500) });

  // Long-lived Claude TUI sessions often finish a task without exiting.
  // Detect a returned prompt / explicit done marker and trigger handoff.
  if (task.completionEventSeen) { return; }
  const ansiPattern = new RegExp('\\\\u001b\\[[0-9;?]*[ -/]*[@-~]', 'g');
  const normalized = String(text || '').replace(ansiPattern, '');
  const looksDone =
    normalized.includes('⏺ Done.') ||
    normalized.includes('The file already exists with the correct content') ||
    normalized.includes('Nothing to do.') ||
    normalized.includes('Task completed') ||
    normalized.includes('completed successfully');
  const promptReturned = normalized.includes('❯') && !normalized.includes('esc to interrupt');

  if (looksDone || promptReturned) {
    markFinishedByClaude(looksDone ? 'Claude completed via terminal output' : 'Claude returned to prompt');
  }
}

/**
 * Called when gateway events indicate task progress.
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
