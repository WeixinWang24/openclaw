// Agent task data model types and factory functions.

/** @typedef {'created'|'running'|'finished_by_claude'|'review_started_by_vio'|'accepted'|'needs_fix'|'paused'|'failed'|'cancelled'} TaskStatus */
/** @typedef {'dispatch'|'coding'|'testing'|'handoff'|'review'|'done'} TaskPhase */
/** @typedef {'pending'|'reviewing'|'accepted'|'needs-fix'|'rejected'} AcceptanceStatus */
/** @typedef {'instruction'|'phase-change'|'milestone'|'validation'|'review'|'follow-up'|'task-finished'|'completion-handoff'|'review-started'|'error'} EventType */

/**
 * Create a new task snapshot with defaults.
 * @param {Partial<import('./types.mjs').TaskSnapshot>} [overrides]
 */
export function createTaskSnapshot(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title || 'Untitled task',
    owner: overrides.owner || 'vio',
    executor: overrides.executor || 'claude',
    status: overrides.status || 'created',
    phase: overrides.phase || 'dispatch',
    acceptanceStatus: overrides.acceptanceStatus || 'pending',
    cwd: overrides.cwd || null,
    promptSummary: overrides.promptSummary || null,
    createdAt: overrides.createdAt || now,
    startedAt: overrides.startedAt || null,
    updatedAt: overrides.updatedAt || now,
    elapsedMs: overrides.elapsedMs || 0,
    latestMeaningfulUpdate: overrides.latestMeaningfulUpdate || null,
    finalSummary: overrides.finalSummary || null,
    needsInput: overrides.needsInput || false,
    needsInputKind: overrides.needsInputKind || null,
    needsInputSummary: overrides.needsInputSummary || null,
    protocolState: overrides.protocolState || null,
    protocolSource: overrides.protocolSource || null,
    touchedFiles: overrides.touchedFiles || [],
    tests: overrides.tests || null,
    commit: overrides.commit || null,
    runtime: overrides.runtime || null,
    // Completion handoff tracking
    completionEventSeen: overrides.completionEventSeen || false,
    completionSeenAt: overrides.completionSeenAt || null,
    completionAcknowledged: overrides.completionAcknowledged || false,
    completionAcknowledgedAt: overrides.completionAcknowledgedAt || null,
  };
}

/**
 * Create a task event.
 * @param {EventType} type
 * @param {string} source - 'vio' | 'claude' | 'human' | 'system'
 * @param {string} message
 * @param {object} [meta]
 */
export function createTaskEvent(type, source, message, meta = {}) {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    source,
    message,
    timestamp: new Date().toISOString(),
    meta,
  };
}
