export function createPageShell(root) {
  if (!root) {return null;}
  root.innerHTML = `
    <div class="vio-dashboard-shell">
      <aside class="vio-sidebar">
        <div class="vio-brand">
          <h1>Vio</h1>
          <p>Phase 1 · Message Flow first</p>
        </div>
        <section class="vio-panel">
          <h3>Sessions</h3>
          <div id="sessions-list"></div>
        </section>
      </aside>
      <section class="vio-main">
        <header class="vio-topbar">
          <h2>Vio Message Flow</h2>
          <p>Current Phase 1 seed: session selection, hydration, refresh, and send initiation.</p>
        </header>
        <section class="vio-content">
          <section class="vio-panel">
            <h3>Flow status</h3>
            <div id="session-status">No session selected.</div>
            <div class="vio-actions">
              <button id="refresh-session-btn" type="button">Refresh session</button>
              <button id="send-test-btn" type="button">Send test ping</button>
              <button id="send-fail-btn" type="button">Send failing ping</button>
              <button id="simulate-stream-btn" type="button">Simulate stream</button>
            </div>
          </section>
          <section class="vio-panel">
            <h3>Flow preview</h3>
            <div id="session-preview"></div>
          </section>
        </section>
      </section>
    </div>
  `;
  return {
    sessionsListEl: document.getElementById('sessions-list'),
    sessionStatusEl: document.getElementById('session-status'),
    sessionPreviewEl: document.getElementById('session-preview'),
    refreshSessionBtnEl: document.getElementById('refresh-session-btn'),
    sendTestBtnEl: document.getElementById('send-test-btn'),
    sendFailBtnEl: document.getElementById('send-fail-btn'),
    simulateStreamBtnEl: document.getElementById('simulate-stream-btn'),
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
  root.innerHTML = `<div class="vio-dashboard-shell"><section class="vio-main"><header class="vio-topbar"><h2>Vio</h2><p>Bootstrap failed: ${String(error?.message || error)}</p></header></section></div>`;
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
    button.textContent = `${session.label || session.key || 'session'}${suffix}`;
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

export function renderSessionStatus(refs, flow, sessionKey, { loading = false, messages = null, reconciled = false, reason = null, meta = null } = {}) {
  if (!refs?.sessionStatusEl) {return;}
  if (loading) {
    refs.sessionStatusEl.textContent = `Loading session: ${sessionKey}`;
    return;
  }
  const count = Array.isArray(messages) ? messages.length : flow?.getSessionMessages(sessionKey).length;
  const mode = reconciled ? 'reconciled' : 'ready';
  const pendingTag = meta?.pending ? ' · pending' : '';
  const reasonTag = reason ? ` · ${String(reason)}` : '';
  refs.sessionStatusEl.textContent = `Selected session: ${sessionKey} · ${count} messages · ${mode}${pendingTag}${reasonTag}`;
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
    flow.sendMessage(sessionKey, 'Vio Phase 1 test ping').then(() => {
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
    flow.sendMessage(sessionKey, 'Vio Phase 1 failing ping', { simulateFailure: true }).then(() => {
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
