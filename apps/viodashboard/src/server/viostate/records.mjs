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

export async function readSessionRecord({ viostateRoot, deviceId, workspaceKey, sessionId }) {
  const paths = buildViostatePaths({ viostateRoot, deviceId, workspaceKey, sessionId });
  return readJsonIfExists(paths.sessionFile);
}

export async function writeSessionRecord({ viostateRoot, deviceId, workspaceKey, sessionId, session }) {
  const paths = buildViostatePaths({ viostateRoot, deviceId, workspaceKey, sessionId });
  await ensureDir(paths.sessionDir);
  await writeJsonAtomic(paths.sessionFile, session);
}

export async function readLatestCheckpoint(_params) {
  // TODO: scan checkpoints directory and return newest record.
  return null;
}
