export const CHECKPOINT_REASONS = [
  'manual-save',
  'auto-save',
  'milestone',
  'focus-shift',
  'pre-close',
  'pre-switch',
];

export const DEVICE_STATUSES = ['active', 'inactive', 'archived'];
export const WORKSPACE_STATUSES = ['active', 'idle', 'archived'];
export const SESSION_STATUSES = ['active', 'paused', 'completed', 'abandoned', 'archived'];
export const STALENESS_LEVELS = ['fresh', 'aging', 'stale', 'unknown'];

export function noopTypeAnchor() {
  return null;
}
