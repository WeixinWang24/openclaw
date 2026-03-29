export function createPageShell(root) {
  if (!root) {return null;}
  root.innerHTML = `
    <div class="dashboard ide-layout vio-phase-shell">
      <header class="topbar card cyan">
        <div class="topbar-main">
          <div class="brand">
            <div class="brand-mark">V</div>
            <div class="brand-text">
              <h1>Vio</h1>
              <p>Phase 1 · gateway message runtime</p>
            </div>
          </div>
          <div class="topbar-right">
            <button type="button" class="chip mode-chip state-idle">mode: phase-1</button>
            <div id="session-status-chip" class="chip live">runtime: booting</div>
            <div class="chip">layout: migrated</div>
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
            <div class="vio-placeholder-body">Explorer layout migrated from old VioDashboard. Phase 1 does not wire file browsing yet.</div>
          </section>
        </section>
      </aside>

      <div class="resizer vertical" data-resize="sidebar" aria-hidden="true"></div>

      <main class="main panel-shell">
        <section class="card section workspace-panel">
          <div class="section-header interaction-header">
            <h2 class="section-title">Interaction</h2>
            <div class="interaction-header-right">
              <div id="sessions-list" class="sessions-list sessions-list-inline"></div>
              <button id="refresh-session-btn" type="button" class="chip state-idle">refresh</button>
            </div>
          </div>

          <div class="workspace-split" id="workspaceSplit">
            <section class="editor-stack" id="editorStack">
              <section class="file-editor-pane">
                <div class="pane-header workspace-view-header">
                  <div class="workspace-view-tabs" role="tablist" aria-label="Workspace views">
                    <button type="button" class="console-tab is-active" role="tab" aria-selected="true">Code</button>
                    <button type="button" class="console-tab" role="tab" aria-selected="false">Replies</button>
                  </div>
                  <div class="pane-actions">
                    <div class="event-sub"><span class="semantic-value">Phase 1 keeps these panes as layout placeholders.</span></div>
                    <div class="workspace-code-actions">
                      <button type="button" class="chip state-idle" disabled>undo</button>
                      <button type="button" class="chip state-idle" disabled>save</button>
                      <div class="chip state-idle">preview</div>
                    </div>
                  </div>
                </div>
                <div class="workspace-view-stack">
                  <div class="workspace-view-pane is-active">
                    <div class="vio-placeholder-pane vio-workspace-placeholder">
                      <div class="vio-placeholder-title">Workspace placeholder</div>
                      <div class="vio-placeholder-body">The old VioDashboard code/replies workspace layout is preserved here, but Phase 1 does not wire editor/replies functionality yet.</div>
                    </div>
                  </div>
                </div>
              </section>

              <div class="resizer horizontal" data-resize="editor-terminal" aria-hidden="true"></div>

              <section class="terminal-panel terminal-panel-embedded console-tabs-panel">
                <div class="console-tabs-header">
                  <div class="console-tabs">
                    <button type="button" class="console-tab is-active">Terminal</button>
                    <button type="button" class="console-tab">Claude</button>
                  </div>
                </div>
                <div class="console-pane-stack">
                  <div class="console-pane is-active vio-placeholder-pane">
                    <div class="vio-placeholder-title">Terminal / Claude placeholder</div>
                    <div class="vio-placeholder-body">Old dashboard console layout migrated. Runtime wiring is intentionally absent in Phase 1.</div>
                  </div>
                </div>
              </section>
            </section>

            <div class="resizer split-resizer" data-resize="workspace" aria-hidden="true"></div>

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
                <form class="composer-panel composer-inline" onsubmit="return false;">
                  <div class="section-header compact composer-header">
                    <h2 class="section-title">Input</h2>
                  </div>
                  <div class="composer-shell">
                    <div class="composer-input-stack">
                      <div class="composer-toolbar">
                        <button type="button" class="chip state-idle" disabled>Attach</button>
                        <button type="button" class="chip state-idle" disabled>🎙️ Voice</button>
                        <div class="composer-voice-status">Phase 1 message runtime only</div>
                      </div>
                      <textarea id="composer-placeholder-input" placeholder="Future composer surface placeholder" rows="4" disabled></textarea>
                    </div>
                    <button type="submit" class="send-btn" disabled>Send</button>
                  </div>
                </form>
              </div>
            </section>
          </div>

          <div id="session-status" class="vio-status-summary">No session selected.</div>
          <div class="vio-actions">
            <button id="send-test-btn" type="button">Send test ping</button>
            <button id="send-fail-btn" type="button">Send failing ping</button>
            <button id="simulate-stream-btn" type="button">Simulate stream</button>
          </div>
        </section>
      </main>

      <div class="resizer vertical" data-resize="right" aria-hidden="true"></div>

      <section class="right panel-shell compact-rail">
        <section class="card section compact-rail-card system-core-card">
          <div class="section-header compact compact-rail-header">
            <h2 class="section-title">System</h2>
            <div class="chip">phase-1</div>
          </div>
          <div class="status-list compact-event-list">
            <div class="agent-row"><div class="agent-left"><span class="dot status-runtime"></span><div class="agent-meta"><div class="agent-name semantic-label">Runtime</div><div id="runtime-session-summary" class="agent-sub semantic-value">No active session.</div></div></div></div>
            <div class="agent-row"><div class="agent-left"><span class="dot status-link"></span><div class="agent-meta"><div class="agent-name semantic-label">Active run</div><div id="runtime-run-summary" class="agent-sub semantic-value">No active run.</div></div></div></div>
            <div class="event-row"><div class="event-meta"><div class="event-name semantic-label">Gateway</div><div class="event-sub semantic-value">Live gateway adapter is wired in Phase 1.</div></div></div>
          </div>
        </section>

        <section class="card section compact-rail-card system-context-card">
          <div class="section-header compact compact-rail-header">
            <h2 class="section-title">Debug</h2>
          </div>
          <div class="event-list compact-event-list">
            <div class="event-row"><div class="event-meta"><div class="event-name semantic-label">Status</div><div class="event-sub semantic-value">Old dashboard right rail layout migrated; non-Phase-1 cards remain placeholders.</div></div></div>
            <div class="event-row"><div class="event-meta"><div class="event-name semantic-label">Next</div><div class="event-sub semantic-value">Wire more cards only when runtime boundaries are ready.</div></div></div>
          </div>
        </section>
      </section>
    </div>
  `;
  return {
    sessionsListEl: document.getElementById('sessions-list'),
    sessionStatusEl: document.getElementById('session-status'),
    sessionStatusChipEl: document.getElementById('session-status-chip'),
    sessionPreviewEl: document.getElementById('session-preview'),
    refreshSessionBtnEl: document.getElementById('refresh-session-btn'),
    sendTestBtnEl: document.getElementById('send-test-btn'),
    sendFailBtnEl: document.getElementById('send-fail-btn'),
    simulateStreamBtnEl: document.getElementById('simulate-stream-btn'),
    runtimeSessionSummaryEl: document.getElementById('runtime-session-summary'),
    runtimeRunSummaryEl: document.getElementById('runtime-run-summary'),
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
  root.innerHTML = `<div class="dashboard ide-layout vio-phase-shell"><header class="topbar card cyan"><div class="topbar-main"><div class="brand"><div class="brand-mark">V</div><div class="brand-text"><h1>Vio</h1><p>Bootstrap failed: ${String(error?.message || error)}</p></div></div></div></header></div>`;
}

export function renderSessionListView(flow, refs, { sessions = [], activeSessionKey = null, sessionMeta = null, sessionLoadingState = null } = {}) {
  if (!refs?.sessionsListEl) {return;}
  refs.sessionsListEl.innerHTML = '';
  for (const session of sessions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'session-item';
    button.dataset.selected = session.key === activeSessionKey ? 'true' : 'false';
    const meta = sessionMeta?.get?.(session.key) || null;
    const loading = !!sessionLoadingState?.has?.(session.key);
    const suffix = loading
      ? ' · loading'
      : meta?.pending
        ? ' · pending'
        : meta?.dirty
          ? ' · dirty'
          : '';
    button.textContent = `${session.label || session.displayName || session.key || 'session'}${suffix}`;
    button.addEventListener('click', () => {
      flow.selectSession(session.key).catch(error => {
        if (refs.sessionStatusEl) {
          refs.sessionStatusEl.textContent = `Session switch failed: ${error?.message || error}`;
        }
      });
    });
    refs.sessionsListEl.appendChild(button);
  }
}

export function renderSessionStatus(refs, flow, sessionKey, { loading = false, messages = null, reconciled = false, reason = null, meta = null, view = null, viewMeta = null } = {}) {
  if (!refs?.sessionStatusEl) {return;}
  if (loading) {
    refs.sessionStatusEl.textContent = `Loading session: ${sessionKey}`;
    if (refs.sessionStatusChipEl) {
      refs.sessionStatusChipEl.textContent = 'runtime: loading';
    }
    return;
  }
  const count = Array.isArray(messages) ? messages.length : flow?.getSessionMessages(sessionKey).length;
  const mode = reconciled ? 'reconciled' : 'ready';
  const pendingTag = meta?.pending ? ' · pending' : '';
  const reasonTag = reason ? ` · ${String(reason)}` : '';
  const activeRunId = viewMeta?.activeRunId || null;
  const activeRunStatus = viewMeta?.activeRunStatus || null;
  const runCount = Array.isArray(viewMeta?.runs) ? viewMeta.runs.length : (view?.runs && typeof view.runs === 'object' ? Object.keys(view.runs).length : 0);
  const runTag = activeRunId
    ? ` · run:${String(activeRunStatus || 'active')} · ${String(activeRunId).slice(0, 8)}`
    : runCount > 0
      ? ` · runs:${runCount}`
      : '';
  refs.sessionStatusEl.textContent = `Selected session: ${sessionKey} · ${count} messages · ${mode}${pendingTag}${reasonTag}${runTag}`;
  if (refs.sessionStatusChipEl) {
    refs.sessionStatusChipEl.textContent = activeRunId ? `runtime: ${String(activeRunStatus || 'active')}` : 'runtime: idle';
  }
  if (refs.runtimeSessionSummaryEl) {
    refs.runtimeSessionSummaryEl.textContent = `Session ${sessionKey} · ${count} visible messages · mode ${mode}${pendingTag}`;
  }
  if (refs.runtimeRunSummaryEl) {
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
    flow.refreshSession(sessionKey, 'manual-refresh').catch(error => {
      if (refs.sessionStatusEl) {
        refs.sessionStatusEl.textContent = `Refresh failed: ${error?.message || error}`;
      }
    });
  });

  refs?.sendTestBtnEl?.addEventListener('click', () => {
    const sessionKey = flow.getActiveSessionKey();
    if (!sessionKey) {return;}
    const localId = shell.send(sessionKey, 'Vio Phase 1 test ping');
    flow.sendMessage(sessionKey, 'Vio Phase 1 test ping', { localId }).then(() => {
      if (refs.sessionStatusEl) {
        refs.sessionStatusEl.textContent = `Sent test ping to ${String(sessionKey)}; refresh scheduled.`;
      }
    }).catch(error => {
      shell.markPendingFailed(sessionKey, localId);
      if (refs.sessionStatusEl) {
        refs.sessionStatusEl.textContent = `Send failed: ${error?.message || error}`;
      }
    });
  });

  refs?.simulateStreamBtnEl?.addEventListener('click', () => {
    const sessionKey = flow.getActiveSessionKey();
    if (!sessionKey) {return;}
    window.__VIO_STREAM_TRACE__ = ['click'];
    try {
      flow.simulateStream(sessionKey, {
        trace: window.__VIO_STREAM_TRACE__,
        reason: 'stream-simulated',
      });
      window.__VIO_STREAM_TRACE__.push(`debug-exists:${typeof shell.getDebugState}`);
      window.__VIO_STREAM_DEBUG__ = shell.getDebugState?.() || null;
      window.__VIO_STREAM_TRACE__.push('debug-set');
    } catch (error) {
      window.__VIO_STREAM_TRACE__.push(`simulate-error:${error?.message || error}`);
      window.__VIO_STREAM_DEBUG__ = { error: error?.message || String(error) };
    }
  });

  refs?.sendFailBtnEl?.addEventListener('click', () => {
    const sessionKey = flow.getActiveSessionKey();
    if (!sessionKey) {return;}
    const localId = shell.send(sessionKey, 'Vio Phase 1 failing ping');
    flow.sendMessage(sessionKey, 'Vio Phase 1 failing ping', { simulateFailure: true, localId }).then(() => {
      if (refs.sessionStatusEl) {
        refs.sessionStatusEl.textContent = `Unexpected success for failing ping in ${String(sessionKey)}.`;
      }
    }).catch(error => {
      shell.markPendingFailed(sessionKey, localId);
      if (refs.sessionStatusEl) {
        refs.sessionStatusEl.textContent = `Send failed: ${error?.message || error}`;
      }
    });
  });
}
