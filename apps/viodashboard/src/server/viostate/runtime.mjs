import { SCHEMA_VERSIONS, DEFAULTS } from './constants.mjs';
import { buildViostatePaths, checkpointRelativePath } from './paths.mjs';
import { writeJsonAtomic, ensureDir } from './fs.mjs';
import { toTimestampFilename, generateSessionId } from './ids.mjs';
import { writeSessionRecord } from './records.mjs';

function uniq(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildResumeHint(session) {
  const task = session?.currentTask ? `, then continue ${session.currentTask}` : '';
  return `Resume from ${session?.currentFocus || 'current focus'}${task}.`;
}

export async function upsertSessionState({ viostateRoot, now, deviceId, workspaceKey, sessionId, input, previousSession = null }) {
  const session = {
    schemaVersion: SCHEMA_VERSIONS.session,
    deviceId,
    workspaceKey,
    sessionId: sessionId || generateSessionId(now),
    status: input?.status || previousSession?.status || DEFAULTS.sessionStatus,
    title: input?.title || previousSession?.title,
    startedAt: previousSession?.startedAt || now,
    updatedAt: now,
    endedAt: previousSession?.endedAt || null,
    source: input?.source || previousSession?.source,
    currentFocus: input?.currentFocus,
    currentTask: input?.currentTask || previousSession?.currentTask,
    relatedFiles: uniq([...(previousSession?.relatedFiles || []), ...(input?.relatedFiles || [])]),
    recentDecisions: uniq([...(previousSession?.recentDecisions || []), ...(input?.recentDecisions || [])]),
    blockers: uniq([...(previousSession?.blockers || []), ...(input?.blockers || [])]),
    lastCheckpointPath: previousSession?.lastCheckpointPath,
    priority: input?.priority || previousSession?.priority,
    labels: uniq([...(previousSession?.labels || []), ...(input?.labels || [])]),
  };

  await writeSessionRecord({
    viostateRoot,
    deviceId,
    workspaceKey,
    sessionId: session.sessionId,
    session,
  });

  return session;
}

export function shouldWriteCheckpoint({ input, previousSession, currentSession }) {
  if (input?.checkpoint?.force) {
    return {
      shouldWrite: true,
      reason: input.checkpoint.reason || 'manual-save',
      rationale: 'forced checkpoint',
    };
  }

  if (!previousSession) {
    return {
      shouldWrite: true,
      reason: 'auto-save',
      rationale: 'first session snapshot',
    };
  }

  if (previousSession.currentFocus !== currentSession.currentFocus) {
    return {
      shouldWrite: true,
      reason: 'focus-shift',
      rationale: 'focus changed',
    };
  }

  if ((input?.recentDecisions || []).length > 0) {
    return {
      shouldWrite: true,
      reason: 'milestone',
      rationale: 'decisions present',
    };
  }

  return {
    shouldWrite: false,
    reason: 'auto-save',
    rationale: 'no meaningful change',
  };
}

export async function writeCheckpoint({ viostateRoot, now, deviceId, workspaceKey, session, input, reason }) {
  const filename = toTimestampFilename(now);
  const paths = buildViostatePaths({
    viostateRoot,
    deviceId,
    workspaceKey,
    sessionId: session.sessionId,
  });

  const checkpointPath = checkpointRelativePath(session.sessionId, filename);
  const checkpoint = {
    schemaVersion: SCHEMA_VERSIONS.checkpoint,
    deviceId,
    workspaceKey,
    sessionId: session.sessionId,
    checkpointId: now,
    createdAt: now,
    reason,
    summary: input?.checkpoint?.summary || `Checkpoint for ${session.currentFocus}`,
    state: {
      currentFocus: session.currentFocus,
      currentTask: session.currentTask,
      status: session.status,
    },
    artifacts: {
      relatedFiles: session.relatedFiles,
      summaryPaths: ['summaries/latest.json'],
    },
    decisions: session.recentDecisions,
    nextSteps: session.currentTask ? [session.currentTask] : [],
    blockers: session.blockers,
    source: input?.source,
  };

  await ensureDir(paths.checkpointsDir);
  await writeJsonAtomic(`${paths.checkpointsDir}/${filename}`, checkpoint);
  return { checkpoint, checkpointPath };
}

export function buildActiveState({ now, deviceId, workspaceKey, workspace, session, latestCheckpointPath, latestSummaryPath, source }) {
  return {
    schemaVersion: SCHEMA_VERSIONS.active,
    deviceId,
    workspaceKey,
    status: workspace.status,
    updatedAt: now,
    activeSessionId: session.sessionId,
    currentFocus: session.currentFocus,
    currentTask: session.currentTask,
    latestCheckpointPath,
    latestSummaryPath,
    resumeHint: buildResumeHint(session),
    staleness: {
      level: DEFAULTS.stalenessLevel,
      checkedAt: now,
    },
    source,
  };
}

export async function writeActiveState({ viostateRoot, deviceId, workspaceKey, sessionId, active }) {
  const paths = buildViostatePaths({ viostateRoot, deviceId, workspaceKey, sessionId });
  await writeJsonAtomic(paths.activeFile, active);
}
