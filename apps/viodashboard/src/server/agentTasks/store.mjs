// In-memory store for the current agent task, events, and logs.
// MVP: single current-task model. No persistence yet.

import { createTaskSnapshot, createTaskEvent } from './types.mjs';
import { persistTaskLifecycleSnapshotBestEffort } from './viostateBridge.mjs';

let currentTask = null;
let events = [];
let logs = [];

const MAX_EVENTS = 500;
const MAX_LOGS = 1000;

export function getCurrentTask() {
  return currentTask;
}

export function setCurrentTask(taskOrOverrides) {
  if (!taskOrOverrides) {
    currentTask = null;
    events = [];
    logs = [];
    return null;
  }
  currentTask = createTaskSnapshot(taskOrOverrides);
  events = [];
  logs = [];
  // Seed with the initial instruction event
  addEvent(createTaskEvent(
    'instruction',
    currentTask.owner,
    currentTask.promptSummary || currentTask.title,
    { phase: currentTask.phase },
  ));
  persistTaskLifecycleSnapshotBestEffort(currentTask, { reason: 'task-started' });
  return currentTask;
}

export function updateCurrentTask(patch) {
  if (!currentTask) { return null; }
  Object.assign(currentTask, patch, { updatedAt: new Date().toISOString() });
  return currentTask;
}

export function getEvents(taskId) {
  if (!currentTask || currentTask.id !== taskId) { return []; }
  return events;
}

export function addEvent(event) {
  events.push(event);
  if (events.length > MAX_EVENTS) { events = events.slice(-MAX_EVENTS); }
  if (currentTask) {
    currentTask.latestMeaningfulUpdate = event.message;
    currentTask.updatedAt = event.timestamp || new Date().toISOString();
  }
  return event;
}

export function getLogs(taskId, limit = 100) {
  if (!currentTask || currentTask.id !== taskId) { return []; }
  return logs.slice(-limit);
}

export function appendLog(entry) {
  logs.push({
    timestamp: new Date().toISOString(),
    level: entry.level || 'info',
    text: entry.text || String(entry),
  });
  if (logs.length > MAX_LOGS) { logs = logs.slice(-MAX_LOGS); }
}

// Convenience: advance phase and emit a phase-change event.
export function advancePhase(nextPhase, detail = '') {
  if (!currentTask) { return null; }
  const prevPhase = currentTask.phase;
  updateCurrentTask({ phase: nextPhase });
  addEvent(createTaskEvent(
    'phase-change',
    'system',
    detail || `Phase: ${prevPhase} -> ${nextPhase}`,
    { from: prevPhase, to: nextPhase },
  ));
  return currentTask;
}

// Mark task as finished by Claude (completion handoff).
// Durable: sets completionEventSeen even if no review has started.
export function markFinishedByClaude(message = 'Claude finished execution') {
  if (!currentTask) { return null; }
  const now = new Date().toISOString();
  updateCurrentTask({
    status: 'finished_by_claude',
    completionEventSeen: true,
    completionSeenAt: now,
  });
  advancePhase('handoff', 'Claude signaled completion');
  addEvent(createTaskEvent(
    'completion-handoff',
    'claude',
    message,
    { completionSeenAt: now },
  ));
  persistTaskLifecycleSnapshotBestEffort(currentTask, { reason: 'finished', message });
  return currentTask;
}

// Vio starts reviewing the finished task.
export function startReview() {
  if (!currentTask) { return null; }
  if (!currentTask.completionEventSeen) { return null; }
  const now = new Date().toISOString();
  updateCurrentTask({
    status: 'review_started_by_vio',
    acceptanceStatus: 'reviewing',
    completionAcknowledged: true,
    completionAcknowledgedAt: now,
  });
  advancePhase('review', 'Vio started review');
  addEvent(createTaskEvent(
    'review-started',
    'vio',
    'Vio started reviewing the completed work',
    { completionAcknowledgedAt: now },
  ));
  persistTaskLifecycleSnapshotBestEffort(currentTask, { reason: 'review-started' });
  return currentTask;
}

// Vio accepts the task.
export function acceptTask(message = 'Work accepted') {
  if (!currentTask) { return null; }
  updateCurrentTask({
    status: 'accepted',
    acceptanceStatus: 'accepted',
  });
  advancePhase('done', 'Task accepted');
  addEvent(createTaskEvent(
    'review',
    'vio',
    message,
    { acceptanceStatus: 'accepted' },
  ));
  persistTaskLifecycleSnapshotBestEffort(currentTask, { reason: 'accepted', message });
  return currentTask;
}

// Vio marks the task as needing fixes.
export function markNeedsFix(message = 'Changes needed') {
  if (!currentTask) { return null; }
  updateCurrentTask({
    status: 'needs_fix',
    acceptanceStatus: 'needs-fix',
  });
  addEvent(createTaskEvent(
    'review',
    'vio',
    message,
    { acceptanceStatus: 'needs-fix' },
  ));
  persistTaskLifecycleSnapshotBestEffort(currentTask, { reason: 'needs-fix', message });
  return currentTask;
}
