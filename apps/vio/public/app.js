import { createApiClient } from './modules/api-client.js';
import { createMessageFlow } from './modules/message-flow/index.js';
import { normalizeFlowMessages } from './modules/message-flow/normalize.js';
import { createMessageShell } from './modules/message-shell/index.js';
import { bindPageShellActions, createPageShell, createShellHost, renderSessionListView, renderSessionStatus } from './modules/page-shell/index.js';

const rootEl = document.getElementById('app');


async function bootstrap() {
  const refs = createPageShell(rootEl);
  const shellMountEl = createShellHost(refs);
  const shell = createMessageShell({ mountEl: shellMountEl });
  const api = createApiClient();
  let flow;
  flow = createMessageFlow({
    api,
    shell,
    renderChrome(sessionKey, payload = {}) {
      renderSessionStatus(refs, flow, sessionKey, payload);
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
    normalizeMessages: normalizeFlowMessages,
  });

  bindPageShellActions({ refs, flow, shell });

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
