// In-memory store for the current agent task, events, and logs.
// MVP: single current-task model. No persistence yet.

import { createTaskSnapshot, createTaskEvent } from './types.mjs';

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
