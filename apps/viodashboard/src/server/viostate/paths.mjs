import path from 'node:path';
import { DIRS, FILES } from './constants.mjs';

export function buildViostatePaths({ viostateRoot, deviceId, workspaceKey, sessionId }) {
  const deviceDir = path.join(viostateRoot, DIRS.devices, deviceId);
  const workspaceDir = path.join(deviceDir, DIRS.workspaces, workspaceKey);
  const summariesDir = path.join(workspaceDir, DIRS.summaries);
  const sessionsDir = path.join(workspaceDir, DIRS.sessions);
  const sessionDir = path.join(sessionsDir, sessionId);
  const checkpointsDir = path.join(sessionDir, DIRS.checkpoints);

  return {
    rootDir: viostateRoot,
    deviceDir,
    deviceFile: path.join(deviceDir, FILES.device),
    workspaceDir,
    workspaceFile: path.join(workspaceDir, FILES.workspace),
    summariesDir,
    latestSummaryFile: path.join(summariesDir, FILES.latestSummary),
    sessionsDir,
    sessionDir,
    sessionFile: path.join(sessionDir, FILES.session),
    checkpointsDir,
    activeFile: path.join(workspaceDir, FILES.active),
  };
}

export function checkpointRelativePath(sessionId, filename) {
  return `${DIRS.sessions}/${sessionId}/${DIRS.checkpoints}/${filename}`;
}

export function latestSummaryRelativePath() {
  return `${DIRS.summaries}/${FILES.latestSummary}`;
}
