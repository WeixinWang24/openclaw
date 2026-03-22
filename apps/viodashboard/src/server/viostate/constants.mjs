export const SCHEMA_VERSIONS = {
  device: 'viostate/device@0.1',
  workspace: 'viostate/workspace@0.1',
  session: 'viostate/session@0.1',
  checkpoint: 'viostate/checkpoint@0.1',
  active: 'viostate/active@0.1',
  latestSummary: 'viostate/summary/latest@0.1',
};

export const DIRS = {
  devices: 'devices',
  workspaces: 'workspaces',
  sessions: 'sessions',
  checkpoints: 'checkpoints',
  summaries: 'summaries',
};

export const FILES = {
  device: 'device.json',
  workspace: 'workspace.json',
  session: 'session.json',
  active: 'active.json',
  latestSummary: 'latest.json',
};

export const DEFAULTS = {
  workspaceKind: 'unknown',
  workspaceStatus: 'active',
  deviceStatus: 'active',
  sessionStatus: 'active',
  stalenessLevel: 'fresh',
  checkpointAutoSaveMinutes: 20,
};
