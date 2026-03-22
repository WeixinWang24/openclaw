import os from 'node:os';
import path from 'node:path';
import { APP_DISPLAY_NAME, APP_SLUG, DASHBOARD_DATA_ROOT, DEFAULT_CLAUDE_CWD, OPENCLAW_REPO_ROOT, PROJECT_ROOT } from '../../config.mjs';
import { saveViostateSnapshot } from '../viostate/index.mjs';

const VIOSTATE_ROOT = path.join(DASHBOARD_DATA_ROOT, 'viostate');

function normalizePathLike(input) {
  if (!input || typeof input !== 'string') {return null;}
  return input.trim() || null;
}

function resolveWorkspaceRoot(task) {
  const runtimeCwd = normalizePathLike(task?.runtime?.cwd);
  const taskCwd = normalizePathLike(task?.cwd);
  const cwd = runtimeCwd || taskCwd || DEFAULT_CLAUDE_CWD || OPENCLAW_REPO_ROOT || PROJECT_ROOT;
  if (!cwd) {return PROJECT_ROOT;}
  return path.isAbsolute(cwd) ? cwd : path.join(PROJECT_ROOT, cwd);
}

function buildTitle(task) {
  return task?.title || task?.promptSummary || 'Untitled task';
}

function buildFocus(task) {
  const title = buildTitle(task);
  const phase = task?.phase ? ` (${task.phase})` : '';
  return `${title}${phase}`;
}

function buildTaskLine(task) {
  if (task?.latestMeaningfulUpdate) {return task.latestMeaningfulUpdate;}
  if (task?.promptSummary) {return task.promptSummary;}
  return task?.title || 'agent task lifecycle update';
}

function buildDecisions(task, reason, message) {
  const decisions = [];
  if (reason === 'accepted') {decisions.push(`Task accepted by Vio${message ? `: ${message}` : ''}`);}
  if (reason === 'needs-fix') {decisions.push(`Task marked needs-fix by Vio${message ? `: ${message}` : ''}`);}
  if (reason === 'review-started') {decisions.push('Vio started review of completed task');}
  if (reason === 'finished') {decisions.push(`Claude signaled completion${message ? `: ${message}` : ''}`);}
  return decisions;
}

function buildBlockers(task) {
  if (task?.needsInput && task?.needsInputSummary) {
    return [task.needsInputSummary];
  }
  return [];
}

function shouldForceCheckpoint(reason) {
  return ['task-started', 'finished', 'review-started', 'accepted', 'needs-fix'].includes(reason);
}

function mapCheckpointReason(reason) {
  switch (reason) {
    case 'task-started':
      return 'manual-save';
    case 'finished':
      return 'milestone';
    case 'review-started':
      return 'milestone';
    case 'accepted':
      return 'milestone';
    case 'needs-fix':
      return 'milestone';
    default:
      return 'auto-save';
  }
}

function buildCheckpointSummary(task, reason, message) {
  const title = buildTitle(task);
  switch (reason) {
    case 'task-started':
      return `Started task: ${title}`;
    case 'finished':
      return message || `Task finished: ${title}`;
    case 'review-started':
      return `Review started for: ${title}`;
    case 'accepted':
      return message || `Task accepted: ${title}`;
    case 'needs-fix':
      return message || `Task needs fix: ${title}`;
    default:
      return `Task state updated: ${title}`;
  }
}

export async function persistTaskLifecycleSnapshot(task, { reason = 'task-update', message = '' } = {}) {
  if (!task) {return null;}

  const workspaceRoot = resolveWorkspaceRoot(task);
  const displayName = path.basename(workspaceRoot) || APP_DISPLAY_NAME;
  const recentDecisions = buildDecisions(task, reason, message);

  return saveViostateSnapshot({
    viostateRoot: VIOSTATE_ROOT,
    input: {
      now: new Date().toISOString(),
      source: 'viodashboard',
      device: {
        hostname: os.hostname(),
        platform: process.platform,
        deviceType: 'desktop',
        label: os.hostname(),
      },
      workspace: {
        rootPath: workspaceRoot,
        repoRoot: OPENCLAW_REPO_ROOT,
        displayName,
        kind: OPENCLAW_REPO_ROOT && workspaceRoot.startsWith(OPENCLAW_REPO_ROOT) ? 'subproject' : 'unknown',
        tags: ['viodashboard', 'agent-task', APP_SLUG],
        metadata: {
          taskId: task.id,
          executor: task.executor,
          phase: task.phase,
          status: task.status,
        },
      },
      sessionId: task.id,
      title: buildTitle(task),
      status: task?.status === 'accepted' ? 'completed' : (task?.status === 'needs_fix' ? 'paused' : 'active'),
      currentFocus: buildFocus(task),
      currentTask: buildTaskLine(task),
      relatedFiles: task?.touchedFiles || [],
      recentDecisions,
      blockers: buildBlockers(task),
      labels: [task?.phase, task?.status, task?.executor].filter(Boolean),
      checkpoint: {
        force: shouldForceCheckpoint(reason),
        reason: mapCheckpointReason(reason),
        summary: buildCheckpointSummary(task, reason, message),
      },
    },
  });
}

export function persistTaskLifecycleSnapshotBestEffort(task, options = {}) {
  void persistTaskLifecycleSnapshot(task, options).catch(error => {
    console.warn('[agentTasks] failed to persist viostate snapshot:', error?.message || String(error));
  });
}
