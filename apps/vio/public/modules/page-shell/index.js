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
            <button type="button" class="chip state-idle" disabled>files</button>
          </div>
          <section class="file-browser-panel explorer-pane vio-placeholder-pane">
            <div class="vio-placeholder-title">Placeholder</div>
            <div class="vio-placeholder-body">Old VioDashboard explorer shell restored first. Backend wiring comes next.</div>
          </section>
        </section>
      </aside>

      <div class="resizer vertical" data-resize="sidebar" title="拖动调整左侧宽度"></div>

      <main class="main panel-shell">
        <section class="card section workspace-panel">
          <div class="section-header interaction-header">
            <h2 class="section-title">INTERACTION</h2>
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
                  <div class="pane-actions"></div>
                </div>
                <div class="workspace-view-stack">
                  <div class="workspace-view-pane is-active">
                    <section class="vio-unified-workspace-card">
                      <div class="vio-placeholder-title">Cloud</div>
                      <div class="vio-placeholder-body">Cloud panel is the default active section in the unified workspace page.</div>
                    </section>
                  </div>
                </div>
              </section>
            </section>

            <div class="resizer split-resizer" data-resize="workspace" title="拖动调整编辑器/聊天比例"></div>

            <section class="chat-pane">
              <div class="chat-stack">
                <div class="chat-shell">
                  <div id="session-preview" class="chat"></div>
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

  return {
    sessionsListEl: document.getElementById('sessions-list'),
    sessionStatusChipEl: document.getElementById('session-status-chip'),
    sessionPreviewEl: document.getElementById('session-preview'),
    refreshSessionBtnEl: document.getElementById('refresh-session-btn'),
    runtimeSessionSummaryEl: document.getElementById('runtime-session-summary'),
    runtimeRunSummaryEl: document.getElementById('runtime-run-summary'),
    composerFormEl: document.getElementById('composer-form'),
    composerInputEl: document.getElementById('composer-input'),
    composerSendBtnEl: document.getElementById('composer-send-btn'),
    composerStatusEl: document.getElementById('composer-status'),
  };
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

export function renderSessionListView(flow, refs, { sessions = [], activeSessionKey = null, sessionMeta = null, sessionLoadingState = null } = {}) {
  if (!refs?.sessionsListEl) {return;}
  refs.sessionsListEl.innerHTML = '';

  const primarySessions = [];
  const acpSessions = [];
  for (const session of sessions) {
    const rawKey = String(session?.key || '');
    if (rawKey.includes(':acp:')) {acpSessions.push(session);}
    else {primarySessions.push(session);}
  }

  for (const session of primarySessions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'session-item';
    button.dataset.selected = session.key === activeSessionKey ? 'true' : 'false';
    const meta = sessionMeta?.get?.(session.key) || null;
    const loading = !!sessionLoadingState?.has?.(session.key);
    const rawKey = String(session.key || '');
    const label = session.label || session.displayName || session.key || 'session';
    let badge = '';
    if (rawKey === 'agent:main:main' || rawKey.endsWith(':main')) {badge = 'main';}
    else if (rawKey.includes(':subagent:')) {badge = 'sub';}
    const state = loading ? 'loading' : meta?.pending ? 'pending' : meta?.dirty ? 'dirty' : '';
    button.innerHTML = `${badge ? `<span class="session-item-badge">${badge}</span>` : ''}<span class="session-item-title">${label}</span>${state ? `<span class="session-item-state">${state}</span>` : ''}`;
    button.title = rawKey || label;
    button.addEventListener('click', () => {
      flow.selectSession(session.key).catch(() => {});
    });
    refs.sessionsListEl.appendChild(button);
  }

  if (acpSessions.length > 0) {
    const wrap = document.createElement('div');
    wrap.className = 'session-acp-menu';

    const activeAcpSession = acpSessions.find(session => session.key === activeSessionKey) || null;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'session-item session-acp-trigger';
    trigger.dataset.selected = activeAcpSession ? 'true' : 'false';
    trigger.innerHTML = `<span class="session-item-badge">acp</span><span class="session-item-title">▾</span>`;
    wrap.appendChild(trigger);
    refs.sessionsListEl.appendChild(wrap);

    let menu = null;

    function closeMenu() {
      if (menu) {
        menu.remove();
        menu = null;
      }
      trigger.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
      closeMenu();
      menu = document.createElement('div');
      menu.className = 'session-acp-dropdown';
      const rect = trigger.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 8}px`;
      menu.style.left = `${Math.max(12, rect.right - 240)}px`;

      for (const session of acpSessions) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'session-acp-option';
        item.dataset.selected = session.key === activeSessionKey ? 'true' : 'false';
        const rawLabel = session.label || session.displayName || session.key || 'acp session';
        item.textContent = rawLabel.length > 40 ? `${rawLabel.slice(0, 37)}…` : rawLabel;
        item.title = rawLabel;
        item.addEventListener('click', () => {
          closeMenu();
          flow.selectSession(session.key).catch(() => {});
        });
        menu.appendChild(item);
      }

      document.body.appendChild(menu);
      trigger.setAttribute('aria-expanded', 'true');
    }

    trigger.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (menu) {closeMenu();}
      else {openMenu();}
    });

    document.addEventListener('click', event => {
      if (!wrap.contains(event.target) && !menu?.contains(event.target)) {
        closeMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (menu) {
        closeMenu();
      }
    });
  }
}

export function renderSessionStatus(refs, flow, sessionKey, { loading = false, messages = null, reconciled = false, meta = null, view = null, viewMeta = null } = {}) {
  if (loading) {
    if (refs?.sessionStatusChipEl) {refs.sessionStatusChipEl.textContent = 'runtime: loading';}
    return;
  }
  const count = Array.isArray(messages) ? messages.length : flow?.getSessionMessages(sessionKey).length;
  const activeRunId = viewMeta?.activeRunId || null;
  const activeRunStatus = viewMeta?.activeRunStatus || null;
  const runCount = Array.isArray(viewMeta?.runs) ? viewMeta.runs.length : (view?.runs && typeof view.runs === 'object' ? Object.keys(view.runs).length : 0);
  if (refs?.sessionStatusChipEl) {
    refs.sessionStatusChipEl.textContent = activeRunId ? `runtime: ${String(activeRunStatus || 'active')}` : 'runtime: idle';
  }
  if (refs?.runtimeSessionSummaryEl) {
    const mode = reconciled ? 'reconciled' : 'ready';
    const pendingTag = meta?.pending ? ' · pending' : '';
    refs.runtimeSessionSummaryEl.textContent = `Session ${sessionKey} · ${count} visible messages · mode ${mode}${pendingTag}`;
  }
  if (refs?.runtimeRunSummaryEl) {
    refs.runtimeRunSummaryEl.textContent = activeRunId
      ? `Active run ${String(activeRunId)} · status ${String(activeRunStatus || 'active')}`
      : runCount > 0
        ? `Known runs in projection: ${runCount}`
        : 'No active run.';
  }
}

export function bindPageShellActions({ refs, flow, shell }) {
  refs?.refreshSessionBtnEl?.addEventListener('click', () => {
    const sessionKey = flow.getActiveSessionKey();
    if (!sessionKey) {return;}
    flow.refreshSession(sessionKey, 'manual-refresh').catch(() => {});
  });

  refs?.composerFormEl?.addEventListener('submit', async event => {
    event.preventDefault();
    const sessionKey = flow?.getActiveSessionKey?.();
    const inputEl = refs?.composerInputEl;
    const sendBtnEl = refs?.composerSendBtnEl;
    const statusEl = refs?.composerStatusEl;
    const text = String(inputEl?.value || '').trim();
    if (!sessionKey || !text) {return;}

    const localId = shell?.send?.(sessionKey, text) || null;
    if (inputEl) {inputEl.value = '';}
    if (sendBtnEl) {sendBtnEl.disabled = true;}
    if (statusEl) {statusEl.textContent = 'Sending…';}

    try {
      await flow?.sendMessage?.(sessionKey, text, { localId });
      if (statusEl) {statusEl.textContent = 'Streaming…';}
      window.setTimeout(() => {
        if (statusEl) {statusEl.textContent = 'Enter newline · Shift+Enter send';}
      }, 900);
    } catch (error) {
      shell?.markPendingFailed?.(sessionKey, localId);
      if (statusEl) {statusEl.textContent = `Send failed: ${String(error?.message || error)}`;}
    } finally {
      if (sendBtnEl) {sendBtnEl.disabled = false;}
    }
  });

  refs?.composerInputEl?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') {return;}
    if (event.shiftKey) {
      event.preventDefault();
      refs?.composerFormEl?.requestSubmit?.();
    }
  });
}
