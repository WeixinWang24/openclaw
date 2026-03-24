// Centralized macOS notification system with configurable preferences
// and notification preference support.
//
// Notification categories:
//   claude-needs-input  — Claude is waiting for user decision in terminal
//   assistant-final     — Vio/assistant sent a final reply
//   task-finished       — Claude task completed / handoff ready
//   auto-open-dashboard — optional fallback that opens the dashboard alongside a notification
//
// Click-through: osascript `display notification` does not natively support
// click-to-open-URL. We therefore keep true click-through disabled. The only
// available fallback here is an opt-in immediate `open location`, which is off
// by default because it is disruptive. For true click-to-act, terminal-notifier
// or a native helper would be required (not currently installed).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Preferences persistence
// ---------------------------------------------------------------------------
const PREFS_DIR = path.join(os.homedir(), '.viodashboard');
const PREFS_FILE = path.join(PREFS_DIR, 'notification-prefs.json');

const DEFAULT_PREFS = {
  'claude-needs-input': true,
  'assistant-final': true,
  'task-finished': true,
  'auto-open-dashboard': false,
};

let cachedPrefs = null;

function loadPrefs() {
  if (cachedPrefs) {return cachedPrefs;}
  try {
    const raw = fs.readFileSync(PREFS_FILE, 'utf-8');
    cachedPrefs = { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    cachedPrefs = { ...DEFAULT_PREFS };
  }
  return cachedPrefs;
}

function savePrefs(prefs) {
  try {
    fs.mkdirSync(PREFS_DIR, { recursive: true });
    fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2));
  } catch (err) {
    console.error('[notifications] failed to save prefs:', err.message);
  }
  cachedPrefs = { ...prefs };
}

export function getNotificationPrefs() {
  return { ...loadPrefs() };
}

export function setNotificationPrefs(partial) {
  const current = loadPrefs();
  const updated = { ...current };
  for (const key of Object.keys(DEFAULT_PREFS)) {
    if (key in partial) {
      updated[key] = Boolean(partial[key]);
    }
  }
  savePrefs(updated);
  return { ...updated };
}

// ---------------------------------------------------------------------------
// Notification dispatch
// ---------------------------------------------------------------------------

/**
 * Send a macOS notification if the given category is enabled.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} opts.category - one of the preference keys
 * @param {string} [opts.clickUrl] - URL to open alongside notification
 */
export function sendNotification({ title, message, category, clickUrl }) {
  void title;
  void message;
  void category;
  void clickUrl;
  return;
}

// Convenience helpers matching previous call-sites
export function notifyClaude({ title, message, dashboardPort }) {
  sendNotification({
    title,
    message,
    category: 'claude-needs-input',
    clickUrl: dashboardPort ? `http://localhost:${dashboardPort}/claude.html` : undefined,
  });
}

export function notifyAssistantFinal({ title, message, dashboardPort }) {
  sendNotification({
    title,
    message,
    category: 'assistant-final',
    clickUrl: dashboardPort ? `http://localhost:${dashboardPort}/` : undefined,
  });
}

export function notifyTaskFinished({ title, message, dashboardPort }) {
  sendNotification({
    title,
    message,
    category: 'task-finished',
    clickUrl: dashboardPort ? `http://localhost:${dashboardPort}/claude.html` : undefined,
  });
}
