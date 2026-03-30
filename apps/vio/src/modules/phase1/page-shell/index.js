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

export function createWorkspaceShellRefs() {
  return {
    openDirBtnEl: document.getElementById('openDirBtn'),
    fileBackBtnEl: document.getElementById('fileBackBtn'),
    fileForwardBtnEl: document.getElementById('fileForwardBtn'),
    fileRefreshBtnEl: document.getElementById('fileRefreshBtn'),
    fileBrowserRootEl: document.getElementById('fileBrowserRoot'),
    fileTreeEl: document.getElementById('fileTree'),
    activeFilePathEl: document.getElementById('activeFilePath'),
    fileUndoBtnEl: document.getElementById('fileUndoBtn'),
    fileSaveBtnEl: document.getElementById('fileSaveBtn'),
    fileModeBadgeEl: document.getElementById('fileModeBadge'),
    fileEditorEl: document.getElementById('fileEditor'),
    workspaceCodeActionsEl: document.getElementById('workspaceCodeActions'),
  };
}

function createPageShellRefs() {
  return {
    ...createMessageRuntimeRefs(),
    ...createWorkspaceShellRefs(),
  };
}

export function createPageShell(root) {
  if (!root) {return null;}
  root.innerHTML = `
    <div class="dashboard ide-layout">
      <header class="topbar card cyan">
        <div class="topbar-main">
          <div class="brand">
            <div class="brand-mark">V</div>
            <div class="brand-text">
              <h1>Vio Dashboard</h1>
              <p>Gateway chat · reset shell on old VioDashboard layout</p>
            </div>
          </div>
          <div class="topbar-right">
            <button id="runModeChip" type="button" class="chip mode-chip state-idle">mode: source</button>
            <div id="session-status-chip" class="chip live">runtime: booting</div>
            <div id="routing" class="chip">routing: live</div>
          </div>
        </div>
      </header>

      <aside class="sidebar panel-shell">
        <section class="card section explorer-shell">
          <div class="section-header">
            <h2 class="section-title">Explorer</h2>
            <button id="openDirBtn" type="button" class="chip state-idle">files</button>
          </div>
          <section class="file-browser-panel explorer-pane">
            <div class="explorer-toolbar">
              <button id="fileBackBtn" type="button" class="chip state-idle">↑</button>
              <button id="fileForwardBtn" type="button" class="chip state-idle">↩</button>
              <button id="fileRefreshBtn" type="button" class="chip state-idle">⟳</button>
              <div class="event-sub"><span class="semantic-label">dir</span> <span id="fileBrowserRoot" class="semantic-value">.</span></div>
            </div>
            <div id="fileTree" class="file-tree"></div>
          </section>
        </section>
      </aside>

      <div class="resizer vertical" data-resize="sidebar" title="拖动调整左侧宽度"></div>

      <main class="main panel-shell">
        <section class="card section workspace-panel">
          <div class="section-header interaction-header">
            <div class="interaction-header-top">
              <h2 class="section-title">INTERACTION</h2>
              <label class="chip state-idle history-window-chip" for="history-window-select">
                <span>history</span>
                <select id="history-window-select" class="history-window-select">
                  <option value="3">3</option>
                  <option value="7" selected>7</option>
                  <option value="15">15</option>
                </select>
              </label>
            </div>
            <div class="interaction-header-right">
              <div class="workspace-view-tabs workspace-view-tabs-inline" role="tablist" aria-label="Unified workspace views">
                <button type="button" class="console-tab is-active" role="tab" aria-selected="true">Cloud</button>
                <button type="button" class="console-tab" role="tab" aria-selected="false">Replies</button>
                <button type="button" class="console-tab" role="tab" aria-selected="false">Terminal</button>
                <button type="button" class="console-tab" role="tab" aria-selected="false">Code</button>
              </div>
              <div id="sessions-list" class="sessions-list sessions-list-inline"></div>
              <button id="refresh-session-btn" type="button" class="chip state-idle">refresh</button>
            </div>
          </div>

          <div class="workspace-split" id="workspaceSplit">
            <section class="editor-stack" id="editorStack">
              <section class="file-editor-pane vio-unified-workspace-page">
                <div class="pane-header workspace-view-header">
                  <div class="pane-actions">
                    <div id="activeFilePath" class="event-sub"><span class="semantic-value">Select a file from Explorer</span></div>
                    <div class="workspace-code-actions" id="workspaceCodeActions">
                      <button id="fileUndoBtn" type="button" class="chip state-idle">undo</button>
                      <button id="fileSaveBtn" type="button" class="chip state-idle">save</button>
                      <div id="fileModeBadge" class="chip state-idle">plain</div>
                    </div>
                  </div>
                </div>
                <div class="workspace-view-stack">
                  <div class="workspace-view-pane is-active">
                    <div class="editor-shell">
                      <textarea id="fileEditor" class="file-editor" spellcheck="false" placeholder="Project file preview / edit area"></textarea>
                    </div>
                  </div>
                </div>
              </section>
            </section>

            <div class="resizer split-resizer" data-resize="workspace" title="拖动调整编辑器/聊天比例"></div>

            <section class="chat-pane">
              <div class="chat-stack">
                <div class="chat-shell">
                  <div id="session-preview" class="chat"></div>
                  <div id="slash-command-banner" class="slash-command-banner" hidden></div>
                </div>
                <div class="chat-continue-slot">
                  <button type="button" class="chat-stop-btn" hidden>Stop</button>
                  <div class="chip state-idle stop-status-badge" hidden>Stopped</div>
                  <button type="button" class="chat-continue-fab" disabled>继续</button>
                </div>
                <form id="composer-form" class="composer-panel composer-inline">
                  <div class="section-header compact composer-header">
                    <h2 class="section-title">Input</h2>
                  </div>
                  <div class="composer-shell">
                    <div class="composer-input-stack">
                      <div class="composer-toolbar">
                        <div id="composer-status" class="composer-voice-status">Enter newline · Shift+Enter send</div>
                      </div>
                      <textarea id="composer-input" placeholder="输入消息…" rows="4"></textarea>
                    </div>
                    <button id="composer-send-btn" type="submit" class="send-btn">Send</button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </section>
      </main>

      <div class="resizer vertical" data-resize="right" title="拖动调整右侧宽度"></div>

      <section class="right panel-shell compact-rail">
        <section class="card section compact-rail-card system-core-card">
          <div class="section-header compact compact-rail-header">
            <h2 class="section-title">System</h2>
            <div class="chip">rewire</div>
          </div>
          <div class="status-list compact-event-list">
            <div class="agent-row"><div class="agent-left"><span class="dot status-runtime"></span><div class="agent-meta"><div class="agent-name semantic-label">Runtime</div><div id="runtime-session-summary" class="agent-sub semantic-value">No active session.</div></div></div></div>
            <div class="agent-row"><div class="agent-left"><span class="dot status-link"></span><div class="agent-meta"><div class="agent-name semantic-label">Active run</div><div id="runtime-run-summary" class="agent-sub semantic-value">No active run.</div></div></div></div>
          </div>
        </section>

        <section class="card section compact-rail-card system-context-card">
          <div class="section-header compact compact-rail-header">
            <h2 class="section-title">Debug</h2>
          </div>
          <div class="event-list compact-event-list">
            <div class="event-row"><div class="event-meta"><div class="event-name semantic-label">Status</div><div class="event-sub semantic-value">Old VioDashboard shell is now the active front-end baseline for apps/vio.</div></div></div>
            <div class="event-row"><div class="event-meta"><div class="event-name semantic-label">Next</div><div class="event-sub semantic-value">Reconnect sessions, chat send, delta stream, then restore tools progressively.</div></div></div>
          </div>
        </section>
      </section>
    </div>
  `;

  return createPageShellRefs();
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

export function renderBootError(root, error) {
  if (!root) {return;}
  root.innerHTML = `<div class="dashboard ide-layout"><header class="topbar card cyan"><div class="topbar-main"><div class="brand"><div class="brand-mark">V</div><div class="brand-text"><h1>Vio</h1><p>Bootstrap failed: ${String(error?.message || error)}</p></div></div></div></header></div>`;
}

export function bindPageShellActions({ refs, onSlashBanner = null }) {
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
