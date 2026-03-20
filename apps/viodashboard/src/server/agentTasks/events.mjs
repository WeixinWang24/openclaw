// Higher-level event helpers for common collaboration patterns.

import { createTaskEvent } from './types.mjs';
import {
  addEvent, updateCurrentTask, getCurrentTask,
  markFinishedByClaude, startReview, acceptTask, markNeedsFix,
} from './store.mjs';

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

// Legacy: kept for backward compat but now delegates to handoff flow.
export function emitTaskFinished(message = 'Task execution complete') {
  return markFinishedByClaude(message);
}

// Completion handoff: Claude signals it is done.
export function emitCompletionHandoff(message = 'Claude finished execution') {
  return markFinishedByClaude(message);
}

// Vio starts reviewing the completed work.
export function emitReviewStarted() {
  return startReview();
}

// Vio accepts the task result.
export function emitAccepted(message = 'Work accepted') {
  return acceptTask(message);
}

// Vio marks the task as needing fixes.
export function emitNeedsFix(message = 'Changes needed') {
  return markNeedsFix(message);
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
