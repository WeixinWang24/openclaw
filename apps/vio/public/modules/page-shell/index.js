export function createPageShell(root) {
  if (!root) {return null;}
  root.innerHTML = `
    <div class="vio-dashboard-shell">
      <header class="vio-topbar card cyan">
        <div class="vio-topbar-main">
          <div class="vio-brand">
            <div class="vio-brand-mark">V</div>
            <div class="vio-brand-text">
              <h1>Vio</h1>
              <p>Phase 1 · Gateway message runtime</p>
            </div>
          </div>
          <div class="vio-topbar-right">
            <div class="chip">mode: phase-1</div>
            <div id="session-status-chip" class="chip">runtime: booting</div>
          </div>
        </div>
      </header>

      <aside class="vio-sidebar">
        <section class="vio-panel card">
          <div class="vio-panel-header">
            <h3>Sessions</h3>
            <div class="vio-panel-sub">Runtime-backed selection</div>
          </div>
          <div id="sessions-list" class="vio-session-list"></div>
        </section>
      </aside>

      <main class="vio-main">
        <section class="vio-panel card vio-workspace-panel">
          <div class="vio-workspace-header">
            <div class="vio-workspace-header-left">
              <h2>Interaction</h2>
              <p>Phase 1 keeps only message flow, shell, and runtime status.</p>
            </div>
            <div class="vio-workspace-header-right">
              <button id="refresh-session-btn" type="button" class="chip">Refresh session</button>
              <button id="send-test-btn" type="button" class="chip">Send test ping</button>
              <button id="send-fail-btn" type="button" class="chip">Send failing ping</button>
              <button id="simulate-stream-btn" type="button" class="chip">Simulate stream</button>
            </div>
          </div>

          <div id="session-status" class="vio-status-summary">No session selected.</div>

          <div class="vio-chat-frame">
            <div id="session-preview"></div>
          </div>
        </section>
      </main>

      <aside class="vio-status-rail">
        <section class="vio-panel card vio-runtime-card">
          <div class="vio-panel-header">
            <h3>Runtime</h3>
            <div class="vio-panel-sub">Projection-fed session state</div>
          </div>
          <div class="vio-runtime-list">
            <div class="vio-runtime-item">
              <div class="vio-runtime-item-label">Session status</div>
              <div id="runtime-session-summary" class="vio-runtime-item-value">No active session.</div>
            </div>
            <div class="vio-runtime-item">
              <div class="vio-runtime-item-label">Active run</div>
              <div id="runtime-run-summary" class="vio-runtime-item-value">No active run.</div>
            </div>
          </div>
        </section>

        <section class="vio-panel card vio-notes-card">
          <div class="vio-panel-header">
            <h3>Notes</h3>
            <div class="vio-panel-sub">Old VioDashboard layout, narrowed to Phase 1 scope.</div>
          </div>
          <div class="vio-runtime-item-value">Explorer / terminal / replies / system rail are intentionally not migrated into the live Phase 1 surface yet.</div>
        </section>
      </aside>
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
  root.innerHTML = `<div class="vio-dashboard-shell"><section class="vio-main"><header class="vio-topbar card cyan"><div class="vio-topbar-main"><div class="vio-brand"><div class="vio-brand-mark">V</div><div class="vio-brand-text"><h1>Vio</h1><p>Bootstrap failed: ${String(error?.message || error)}</p></div></div></div></header></section></div>`;
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
