// Higher-level event helpers for common collaboration patterns.

import { createTaskEvent } from './types.mjs';
import { addEvent, updateCurrentTask, getCurrentTask, advancePhase } from './store.mjs';

export function emitMilestone(message, meta = {}) {
  return addEvent(createTaskEvent('milestone', 'claude', message, meta));
}

export function emitValidation(message, meta = {}) {
  const event = addEvent(createTaskEvent('validation', 'system', message, meta));
  if (meta.tests) {
    updateCurrentTask({ tests: meta.tests });
  }
  if (meta.commit) {
    updateCurrentTask({ commit: meta.commit });
  }
  return event;
}

export function emitReview(acceptanceStatus, message, meta = {}) {
  updateCurrentTask({ acceptanceStatus });
  return addEvent(createTaskEvent('review', 'vio', message, { acceptanceStatus, ...meta }));
}

export function emitFollowUp(source, message, meta = {}) {
  return addEvent(createTaskEvent('follow-up', source, message, meta));
}

export function emitTaskFinished(message = 'Task execution complete') {
  updateCurrentTask({ status: 'completed' });
  advancePhase('done');
  return addEvent(createTaskEvent('task-finished', 'system', message));
}

export function emitError(message, meta = {}) {
  return addEvent(createTaskEvent('error', 'system', message, meta));
}

export function emitTouchedFiles(files) {
  const task = getCurrentTask();
  if (task) {
    updateCurrentTask({ touchedFiles: files });
  }
}
