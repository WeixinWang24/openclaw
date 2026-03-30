export function createMessageRuntimeRefs() {
  return {
    sessionsListEl: document.getElementById('sessions-list'),
    sessionStatusChipEl: document.getElementById('session-status-chip'),
    slashCommandBannerEl: document.getElementById('slash-command-banner'),
    sessionPreviewEl: document.getElementById('session-preview'),
    refreshSessionBtnEl: document.getElementById('refresh-session-btn'),
    historyWindowEl: document.getElementById('history-window-select'),
    runtimeSessionSummaryEl: document.getElementById('runtime-session-summary'),
    runtimeRunSummaryEl: document.getElementById('runtime-run-summary'),
    composerFormEl: document.getElementById('composer-form'),
    composerInputEl: document.getElementById('composer-input'),
    composerSendBtnEl: document.getElementById('composer-send-btn'),
    composerStatusEl: document.getElementById('composer-status'),
    continueBtnEl: document.querySelector('.chat-continue-fab'),
  };
}

import { createWorkspaceShellRefs, renderWorkspaceShell } from '../../phase2/workspace-shell/index.js';
import { renderRightRailSection, renderTopbarSection } from './sections.js';

export function createPageLayoutRefs() {
  return {
    message: createMessageRuntimeRefs(),
    workspace: createWorkspaceShellRefs(),
  };
}

export function createPageLayout(root) {
  if (!root) {return null;}
  root.innerHTML = `
    <div class="dashboard ide-layout">
${renderTopbarSection()}
${renderWorkspaceShell()}
${renderRightRailSection()}
    </div>
  `;

  return createPageLayoutRefs();
}

export function createShellHost(refs) {
  if (!refs?.sessionPreviewEl) {return null;}
  refs.sessionPreviewEl.innerHTML = '';
  const mountEl = document.createElement('div');
  mountEl.className = 'message-shell-mount';
  refs.sessionPreviewEl.replaceWith(mountEl);
  refs.sessionPreviewEl = mountEl;
  return mountEl;
}

export function renderPreviewPlaceholder(refs, { title = 'Flow preview', text = 'Select a session to load history.' } = {}) {
  const mountEl = refs?.sessionPreviewEl;
  if (!mountEl) {return;}
  mountEl.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'vio-preview-placeholder';
  const heading = document.createElement('div');
  heading.className = 'vio-preview-placeholder-title';
  heading.textContent = title;
  const body = document.createElement('div');
  body.className = 'vio-preview-placeholder-body';
  body.textContent = text;
  card.appendChild(heading);
  card.appendChild(body);
  mountEl.appendChild(card);
}

export function renderPageBootError(root, error) {
  if (!root) {return;}
  root.innerHTML = `<div class="dashboard ide-layout"><header class="topbar card cyan"><div class="topbar-main"><div class="brand"><div class="brand-mark">V</div><div class="brand-text"><h1>Vio</h1><p>Bootstrap failed: ${String(error?.message || error)}</p></div></div></div></header></div>`;
}

export function bindPageComposerActions({ refs, onSlashBanner = null }) {
  let slashBannerTimer = null;

  refs?.composerInputEl?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') {return;}
    if (event.shiftKey) {
      event.preventDefault();
      refs?.composerFormEl?.requestSubmit?.();
    }
  });

  function showSlashBanner(text, options = {}) {
    const bannerEl = refs?.slashCommandBannerEl;
    if (!bannerEl || !text) {return;}
    if (slashBannerTimer) {
      window.clearTimeout(slashBannerTimer);
      slashBannerTimer = null;
    }
    bannerEl.hidden = false;
    bannerEl.dataset.tone = options?.tone || 'info';
    bannerEl.textContent = text;
    const ttlMs = Number.isFinite(options?.ttlMs) ? options?.ttlMs : 6200;
    slashBannerTimer = window.setTimeout(() => {
      bannerEl.hidden = true;
      bannerEl.textContent = '';
      bannerEl.dataset.tone = 'info';
      slashBannerTimer = null;
    }, ttlMs);
  }

  if (typeof onSlashBanner === 'function') {
    return {
      showSlashBanner,
      emitSlashBanner: onSlashBanner,
    };
  }

  return {
    showSlashBanner,
    emitSlashBanner: showSlashBanner,
  };
}

// Temporary compatibility aliases for remaining old imports during transition.
export {
  createPageLayoutRefs as createPageShellRefs,
  createPageLayout as createPageShell,
  renderPageBootError as renderBootError,
  bindPageComposerActions as bindPageShellActions,
};
