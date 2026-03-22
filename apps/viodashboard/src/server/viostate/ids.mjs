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
  const repo = workspace.repoRoot ? path.basename(workspace.repoRoot) : '';
  const root = String(workspace.rootPath || '').split('/').filter(Boolean).slice(-2).join('_');
  return slugify([repo, root].filter(Boolean).join('_')) || 'workspace';
}

export async function resolveWorkspaceKey(workspace = {}, _deviceId, _viostateRoot) {
  return {
    workspaceKey: deriveWorkspaceCandidateKey(workspace),
    matchedExisting: false,
  };
}
