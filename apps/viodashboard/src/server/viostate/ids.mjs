import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DIRS, FILES } from './constants.mjs';

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function shortHash(input) {
  return crypto.createHash('sha1').update(String(input || '')).digest('hex').slice(0, 6);
}

function normalizeAbs(input) {
  if (!input || typeof input !== 'string') {return null;}
  try {
    return path.resolve(input);
  } catch {
    return null;
  }
}

function isSamePath(a, b) {
  const left = normalizeAbs(a);
  const right = normalizeAbs(b);
  return Boolean(left && right && left === right);
}

function relativeSubpath(rootPath, repoRoot) {
  const root = normalizeAbs(rootPath);
  const repo = normalizeAbs(repoRoot);
  if (!root || !repo) {return null;}
  const rel = path.relative(repo, root);
  if (!rel || rel === '') {return '';}
  if (rel.startsWith('..') || path.isAbsolute(rel)) {return null;}
  return rel;
}

export function toTimestampFilename(isoUtc) {
  return `${String(isoUtc || '').replace(/:/g, '-')}.json`;
}

export function generateSessionId(now) {
  const compact = String(now || '').replace(/[-:TZ.]/g, '').slice(0, 14);
  const tail = shortHash(`${now}-${Math.random()}`).slice(0, 4);
  return `sess-${compact}-${tail}`;
}

export function deriveDeviceCandidateId(device = {}) {
  if (device.configuredDeviceId) {return slugify(device.configuredDeviceId);}
  const host = slugify(device.hostname || 'device');
  const type = slugify(device.deviceType || '') || (device.platform === 'darwin' ? 'mac' : 'node');
  return `${host}-${type}`.replace(/-+/g, '-');
}

export async function resolveDeviceId(device = {}, viostateRoot) {
  const fingerprint = {
    strategy: device.configuredDeviceId ? 'manual+derived' : 'derived',
    hostname: device.hostname,
    platform: device.platform,
    deviceType: device.deviceType,
  };

  if (device.configuredDeviceId) {
    return {
      deviceId: slugify(device.configuredDeviceId),
      matchedExisting: false,
      fingerprint,
    };
  }

  const devicesDir = path.join(viostateRoot, DIRS.devices);
  try {
    const entries = await fs.readdir(devicesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {continue;}
      const file = path.join(devicesDir, entry.name, FILES.device);
      try {
        const raw = JSON.parse(await fs.readFile(file, 'utf8'));
        if (
          raw?.hostname
          && raw?.platform
          && raw.hostname === device.hostname
          && raw.platform === device.platform
        ) {
          return {
            deviceId: raw.deviceId || entry.name,
            matchedExisting: true,
            fingerprint,
          };
        }
      } catch {
        // ignore malformed record for now
      }
    }
  } catch {
    // first run or empty root
  }

  return {
    deviceId: deriveDeviceCandidateId(device),
    matchedExisting: false,
    fingerprint,
  };
}

export function deriveWorkspaceCandidateKey(workspace = {}) {
  if (workspace.explicitWorkspaceKey) {return slugify(workspace.explicitWorkspaceKey);}

  const repoName = workspace.repoRoot ? path.basename(workspace.repoRoot) : '';
  const rel = relativeSubpath(workspace.rootPath, workspace.repoRoot);

  if (repoName && rel === '') {
    return slugify(repoName) || 'workspace';
  }

  if (repoName && rel) {
    return slugify(`${repoName}_${rel.split(path.sep).join('_')}`) || 'workspace';
  }

  if (workspace.displayName) {
    return slugify(workspace.displayName) || 'workspace';
  }

  const root = String(workspace.rootPath || '').split(/[\\/]/).filter(Boolean).slice(-3).join('_');
  return slugify(root) || 'workspace';
}

async function findExistingWorkspaceMatch(viostateRoot, deviceId, workspace = {}) {
  const workspacesDir = path.join(viostateRoot, DIRS.devices, deviceId, DIRS.workspaces);
  try {
    const entries = await fs.readdir(workspacesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {continue;}
      const file = path.join(workspacesDir, entry.name, FILES.workspace);
      try {
        const raw = JSON.parse(await fs.readFile(file, 'utf8'));
        if (isSamePath(raw?.rootPath, workspace.rootPath)) {
          return raw.workspaceKey || entry.name;
        }
        if (
          raw?.repoRoot
          && workspace.repoRoot
          && isSamePath(raw.repoRoot, workspace.repoRoot)
        ) {
          const rawRel = relativeSubpath(raw.rootPath, raw.repoRoot);
          const targetRel = relativeSubpath(workspace.rootPath, workspace.repoRoot);
          if (rawRel !== null && targetRel !== null && rawRel === targetRel) {
            return raw.workspaceKey || entry.name;
          }
        }
      } catch {
        // ignore malformed record for now
      }
    }
  } catch {
    // first run or no workspaces yet
  }
  return null;
}

export async function resolveWorkspaceKey(workspace = {}, deviceId, viostateRoot) {
  if (workspace.explicitWorkspaceKey) {
    return {
      workspaceKey: slugify(workspace.explicitWorkspaceKey),
      matchedExisting: false,
    };
  }

  const existing = await findExistingWorkspaceMatch(viostateRoot, deviceId, workspace);
  if (existing) {
    return {
      workspaceKey: existing,
      matchedExisting: true,
    };
  }

  return {
    workspaceKey: deriveWorkspaceCandidateKey(workspace),
    matchedExisting: false,
  };
}
