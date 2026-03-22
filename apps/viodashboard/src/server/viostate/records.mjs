import fs from 'node:fs/promises';
import path from 'node:path';
import { SCHEMA_VERSIONS, DEFAULTS } from './constants.mjs';
import { buildViostatePaths } from './paths.mjs';
import { readJsonIfExists, writeJsonAtomic, ensureDir } from './fs.mjs';

export async function ensureDeviceRecord({ viostateRoot, now, deviceId, device, fingerprint }) {
  const paths = buildViostatePaths({
    viostateRoot,
    deviceId,
    workspaceKey: '__placeholder__',
    sessionId: '__placeholder__',
  });

  const existing = await readJsonIfExists(paths.deviceFile);
  const record = existing || {
    schemaVersion: SCHEMA_VERSIONS.device,
    deviceId,
    deviceLabel: device?.label,
    deviceType: device?.deviceType,
    platform: device?.platform,
    hostname: device?.hostname,
    fingerprint,
    status: DEFAULTS.deviceStatus,
    firstSeenAt: now,
    lastSeenAt: now,
    capabilities: {
      dashboard: true,
      heartbeat: true,
    },
    notes: '',
  };

  record.lastSeenAt = now;
  record.deviceLabel ||= device?.label;
  record.deviceType ||= device?.deviceType;
  record.platform ||= device?.platform;
  record.hostname ||= device?.hostname;
  record.fingerprint ||= fingerprint;

  await ensureDir(paths.deviceDir);
  await writeJsonAtomic(paths.deviceFile, record);
  return record;
}

export async function ensureWorkspaceRecord({ viostateRoot, now, deviceId, workspaceKey, workspace }) {
  const paths = buildViostatePaths({
    viostateRoot,
    deviceId,
    workspaceKey,
    sessionId: '__placeholder__',
  });

  const existing = await readJsonIfExists(paths.workspaceFile);
  const record = existing || {
    schemaVersion: SCHEMA_VERSIONS.workspace,
    deviceId,
    workspaceKey,
    displayName: workspace?.displayName,
    rootPath: workspace?.rootPath,
    repoRoot: workspace?.repoRoot,
    kind: workspace?.kind || DEFAULTS.workspaceKind,
    status: DEFAULTS.workspaceStatus,
    firstSeenAt: now,
    lastSeenAt: now,
    tags: workspace?.tags || [],
    metadata: workspace?.metadata || {},
  };

  record.lastSeenAt = now;
  record.displayName ||= workspace?.displayName;
  record.repoRoot ||= workspace?.repoRoot;
  record.tags = Array.from(new Set([...(record.tags || []), ...(workspace?.tags || [])]));
  record.metadata = { ...record.metadata, ...workspace?.metadata };

  await ensureDir(paths.workspaceDir);
  await writeJsonAtomic(paths.workspaceFile, record);
  return record;
}

export async function readDeviceRecord({ viostateRoot, deviceId }) {
  const paths = buildViostatePaths({
    viostateRoot,
    deviceId,
    workspaceKey: '__placeholder__',
    sessionId: '__placeholder__',
  });
  return readJsonIfExists(paths.deviceFile);
}

export async function readWorkspaceRecord({ viostateRoot, deviceId, workspaceKey }) {
  const paths = buildViostatePaths({
    viostateRoot,
    deviceId,
    workspaceKey,
    sessionId: '__placeholder__',
  });
  return readJsonIfExists(paths.workspaceFile);
}

export async function readActiveRecord({ viostateRoot, deviceId, workspaceKey, sessionId = '__placeholder__' }) {
  const paths = buildViostatePaths({ viostateRoot, deviceId, workspaceKey, sessionId });
  return readJsonIfExists(paths.activeFile);
}

export async function readLatestSummaryRecord({ viostateRoot, deviceId, workspaceKey, sessionId = '__placeholder__' }) {
  const paths = buildViostatePaths({ viostateRoot, deviceId, workspaceKey, sessionId });
  return readJsonIfExists(paths.latestSummaryFile);
}

export async function readSessionRecord({ viostateRoot, deviceId, workspaceKey, sessionId }) {
  const paths = buildViostatePaths({ viostateRoot, deviceId, workspaceKey, sessionId });
  return readJsonIfExists(paths.sessionFile);
}

export async function writeSessionRecord({ viostateRoot, deviceId, workspaceKey, sessionId, session }) {
  const paths = buildViostatePaths({ viostateRoot, deviceId, workspaceKey, sessionId });
  await ensureDir(paths.sessionDir);
  await writeJsonAtomic(paths.sessionFile, session);
}

export async function readCheckpointRecord({ viostateRoot, deviceId, workspaceKey, checkpointPath = null }) {
  if (!checkpointPath) {return null;}
  const filePath = path.join(viostateRoot, 'devices', deviceId, 'workspaces', workspaceKey, checkpointPath);
  return readJsonIfExists(filePath);
}

export async function readLatestCheckpoint({ viostateRoot, deviceId, workspaceKey, sessionId }) {
  const paths = buildViostatePaths({ viostateRoot, deviceId, workspaceKey, sessionId });
  try {
    const entries = await fs.readdir(paths.checkpointsDir, { withFileTypes: true });
    const candidates = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => entry.name)
      .toSorted();

    if (!candidates.length) {return null;}

    const latestName = candidates[candidates.length - 1];
    const latestPath = path.join(paths.checkpointsDir, latestName);
    const checkpoint = await readJsonIfExists(latestPath);
    if (!checkpoint) {return null;}

    return {
      checkpoint,
      checkpointPath: `sessions/${sessionId}/checkpoints/${latestName}`,
      fileName: latestName,
    };
  } catch {
    return null;
  }
}
