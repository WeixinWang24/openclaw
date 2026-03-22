import { SCHEMA_VERSIONS } from './constants.mjs';
import { buildViostatePaths, latestSummaryRelativePath } from './paths.mjs';
import { writeJsonAtomic } from './fs.mjs';

function firstNonEmpty(...lists) {
  for (const list of lists) {
    if (Array.isArray(list) && list.length) {return list;}
  }
  return [];
}

function buildHeadline(session) {
  return session?.currentTask
    ? `${session.currentFocus} — ${session.currentTask}`
    : (session?.currentFocus || 'Active session');
}

function buildResumeHint(session, nextSteps) {
  if (nextSteps?.[0]) {return `Resume from ${session.currentFocus}, then ${nextSteps[0]}.`;}
  return `Resume from ${session.currentFocus}.`;
}

export function buildLatestSummary({ now, deviceId, workspaceKey, session, checkpoint, active, source }) {
  const keyDecisions = firstNonEmpty(checkpoint?.decisions, session?.recentDecisions);
  const nextSteps = firstNonEmpty(checkpoint?.nextSteps, session?.currentTask ? [session.currentTask] : []);
  const importantContext = [
    ...(session?.blockers?.length ? [`Blockers: ${session.blockers.join('; ')}`] : []),
    ...(session?.relatedFiles?.length ? [`Related files: ${session.relatedFiles.slice(0, 5).join(', ')}`] : []),
  ];

  return {
    schemaVersion: SCHEMA_VERSIONS.latestSummary,
    deviceId,
    workspaceKey,
    generatedAt: now,
    source,
    activeSessionId: session.sessionId,
    headline: buildHeadline(session),
    currentState: {
      focus: session.currentFocus,
      task: session.currentTask,
      status: session.status,
    },
    keyDecisions,
    importantContext,
    nextSteps,
    resumeHint: buildResumeHint(session, nextSteps),
    sourceInputs: [
      'active.json',
      `sessions/${session.sessionId}/session.json`,
      ...(active?.latestCheckpointPath ? [active.latestCheckpointPath] : []),
    ],
  };
}

export async function writeLatestSummary({ viostateRoot, deviceId, workspaceKey, sessionId, summary }) {
  const paths = buildViostatePaths({ viostateRoot, deviceId, workspaceKey, sessionId });
  await writeJsonAtomic(paths.latestSummaryFile, summary);
  return { summaryPath: latestSummaryRelativePath() };
}
