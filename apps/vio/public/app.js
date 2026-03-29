import { createMessageFlow } from '../src/modules/message-flow/index.js';

const rootEl = document.getElementById('app');

function createPageShell(root) {
  if (!root) {return null;}
  root.innerHTML = `
    <main class="vio-shell">
      <section class="vio-card">
        <header class="vio-header">
          <h1>Vio</h1>
          <p>Phase 1 bootstrap shell: Message Flow first.</p>
        </header>
        <section class="vio-grid">
          <aside>
            <h2>Sessions</h2>
            <div id="sessions-list"></div>
          </aside>
          <section>
            <h2>Message Flow</h2>
            <div id="session-status">No session selected.</div>
            <div class="vio-actions">
              <button id="refresh-session-btn" type="button">Refresh session</button>
            </div>
            <pre id="session-preview">[]</pre>
          </section>
        </section>
      </section>
    </main>
  `;
  return {
    sessionsListEl: document.getElementById('sessions-list'),
    sessionStatusEl: document.getElementById('session-status'),
    sessionPreviewEl: document.getElementById('session-preview'),
    refreshSessionBtnEl: document.getElementById('refresh-session-btn'),
  };
}

function createShellStub(refs) {
  return {
    mountSession(sessionKey, messages = []) {
      if (refs?.sessionStatusEl) {
        refs.sessionStatusEl.textContent = `Selected session: ${sessionKey}`;
      }
      if (refs?.sessionPreviewEl) {
        refs.sessionPreviewEl.textContent = JSON.stringify(messages, null, 2);
      }
    },
    reconcileHistory(sessionKey, messages = []) {
      this.mountSession(sessionKey, messages);
    },
  };
}

function createApiClient() {
  return {
    async fetchSessionList() {
      const res = await fetch('/api/sessions', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {throw new Error(data?.error || 'sessions fetch failed');}
      return data;
    },
    async fetchSessionHistory(sessionKey, { force = false } = {}) {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionKey)}/history?limit=40${force ? '&refresh=true' : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {throw new Error(data?.error || 'session history fetch failed');}
      return {
        ...data,
        messages: Array.isArray(data?.messages)
          ? data.messages.map(message => ({
              ...message,
              role: message?.role || 'unknown',
              text: typeof message?.text === 'string' ? message.text : '',
            }))
          : [],
      };
    },
    async sendMessage(sessionKey, text, options = {}) {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionKey)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, ...options }),
      });
      const data = await res.json();
      if (!res.ok) {throw new Error(data?.error || 'send failed');}
      return data;
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
  const shell = createShellStub(refs);
  const api = createApiClient();
  let flow;
  flow = createMessageFlow({
    api,
    shell,
    renderChrome(sessionKey, { loading = false } = {}) {
      if (!refs?.sessionStatusEl) {return;}
      refs.sessionStatusEl.textContent = loading
        ? `Loading session: ${sessionKey}`
        : `Selected session: ${sessionKey}`;
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
    rootEl.innerHTML = `<main class="vio-shell"><section class="vio-card"><h1>Vio</h1><p>Bootstrap failed: ${error?.message || error}</p></section></main>`;
  }
});
