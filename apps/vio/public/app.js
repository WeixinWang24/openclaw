import { createMessageFlow } from './modules/message-flow/index.js';
import { createMessageShell } from './modules/message-shell/index.js';

const rootEl = document.getElementById('app');

function createPageShell(root) {
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
  };
}

function createShellHost(refs) {
  if (!refs?.sessionPreviewEl) {return null;}
  refs.sessionPreviewEl.innerHTML = '';
  const mountEl = document.createElement('div');
  mountEl.className = 'message-shell-mount';
  refs.sessionPreviewEl.replaceWith(mountEl);
  refs.sessionPreviewEl = mountEl;
  return mountEl;
}

async function readJsonOrThrow(url, init = undefined, fallbackError = 'request failed') {
  const res = await fetch(url, init);
  const contentType = String(res.headers.get('content-type') || '');
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`${fallbackError}: expected json, got ${contentType || 'unknown'} :: ${text.slice(0, 80)}`);
  }
  const data = await res.json();
  if (!res.ok) {throw new Error(data?.error || fallbackError);}
  return data;
}

function createMockApiClient() {
  const mockHistory = new Map([
    ['vio:mock:main', [
      { id: 'm1', role: 'assistant', text: 'Vio Phase 1 mock session ready.' },
      { id: 'm2', role: 'assistant', text: 'This mock provider keeps Message Flow runnable before the real Vio API surface exists.' },
    ]],
    ['vio:mock:alt', [
      { id: 'm3', role: 'assistant', text: 'Alternate mock session.' },
    ]],
  ]);
  return {
    async fetchSessionList() {
      return {
        currentSessionKey: 'vio:mock:main',
        items: [
          { key: 'vio:mock:main', label: 'mock main', kind: 'session' },
          { key: 'vio:mock:alt', label: 'mock alt', kind: 'session' },
        ],
      };
    },
    async fetchSessionHistory(sessionKey) {
      return { messages: mockHistory.get(sessionKey) || [] };
    },
    async sendMessage(sessionKey, text) {
      const history = mockHistory.get(sessionKey) || [];
      history.push({ id: `u-${Date.now()}`, role: 'user', text: String(text || '') });
      history.push({ id: `a-${Date.now()}`, role: 'assistant', text: 'Mock send accepted. Real API not attached yet.' });
      mockHistory.set(sessionKey, history);
      return { ok: true, mock: true };
    },
  };
}

function createApiClient() {
  const mockApi = createMockApiClient();
  let usingMock = false;

  async function withFallback(runReal, runMock) {
    if (usingMock) {return runMock();}
    try {
      return await runReal();
    } catch (error) {
      console.warn('Vio Phase 1 API fallback -> mock provider', error);
      usingMock = true;
      return runMock();
    }
  }

  return {
    async fetchSessionList() {
      return withFallback(
        () => readJsonOrThrow('/api/sessions', { cache: 'no-store' }, 'sessions fetch failed'),
        () => mockApi.fetchSessionList(),
      );
    },
    async fetchSessionHistory(sessionKey, { force = false } = {}) {
      return withFallback(
        () => readJsonOrThrow(`/api/sessions/${encodeURIComponent(sessionKey)}/history?limit=40${force ? '&refresh=true' : ''}`, { cache: 'no-store' }, 'session history fetch failed').then(data => ({
          ...data,
          messages: Array.isArray(data?.messages)
            ? data.messages.map(message => ({
                ...message,
                role: message?.role || 'unknown',
                text: typeof message?.text === 'string' ? message.text : '',
              }))
            : [],
        })),
        () => mockApi.fetchSessionHistory(sessionKey),
      );
    },
    async sendMessage(sessionKey, text, options = {}) {
      return withFallback(
        () => readJsonOrThrow(`/api/sessions/${encodeURIComponent(sessionKey)}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, ...options }),
        }, 'send failed'),
        () => {
          if (options?.simulateFailure === true) {
            throw new Error('Mock send failure');
          }
          return mockApi.sendMessage(sessionKey, text, options);
        },
      );
    },
  };
}

function renderSessionListView(flow, refs, { sessions = [], activeSessionKey = null } = {}) {
  if (!refs?.sessionsListEl) {return;}
  refs.sessionsListEl.innerHTML = '';
  for (const session of sessions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'session-item';
    button.dataset.selected = session.key === activeSessionKey ? 'true' : 'false';
    button.textContent = session.label || session.key || 'session';
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

async function bootstrap() {
  const refs = createPageShell(rootEl);
  const shellMountEl = createShellHost(refs);
  const shell = createMessageShell({ mountEl: shellMountEl });
  const api = createApiClient();
  let flow;
  flow = createMessageFlow({
    api,
    shell,
    renderChrome(sessionKey, { loading = false, messages = null } = {}) {
      if (!refs?.sessionStatusEl) {return;}
      if (loading) {
        refs.sessionStatusEl.textContent = `Loading session: ${sessionKey}`;
        return;
      }
      const count = Array.isArray(messages) ? messages.length : flow?.getSessionMessages(sessionKey).length;
      refs.sessionStatusEl.textContent = `Selected session: ${sessionKey} · ${count} messages`;
    },
    renderSessionList(payload) {
      renderSessionListView(flow, refs, payload);
    },
    onSessionSelected() {
      renderSessionListView(flow, refs, {
        sessions: flow.getSessions(),
        activeSessionKey: flow.getActiveSessionKey(),
      });
    },
    normalizeMessages(messages = []) {
      return Array.isArray(messages)
        ? messages.map(message => ({
            id: message?.id || null,
            role: message?.role || 'unknown',
            text: typeof message?.text === 'string' ? message.text : '',
          }))
        : [];
    },
  });

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

  const sessionsData = await flow.fetchSessionList();
  renderSessionListView(flow, refs, {
    sessions: flow.getSessions(),
    activeSessionKey: flow.getActiveSessionKey(),
  });
  const initialSessionKey = flow.getActiveSessionKey() || sessionsData?.currentSessionKey || null;
  if (initialSessionKey) {
    await flow.selectSession(initialSessionKey);
    renderSessionListView(flow, refs, {
      sessions: flow.getSessions(),
      activeSessionKey: flow.getActiveSessionKey(),
    });
  }
  window.__VIO_LOADED__ = true;
}

bootstrap().catch(error => {
  if (rootEl) {
    rootEl.innerHTML = `<div class="vio-dashboard-shell"><section class="vio-main"><header class="vio-topbar"><h2>Vio</h2><p>Bootstrap failed: ${error?.message || error}</p></header></section></div>`;
  }
});
