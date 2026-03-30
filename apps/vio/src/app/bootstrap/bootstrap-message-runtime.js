import { createApiClient } from '../../modules/runtime-support/api-client.js';
import { createMessageFlow } from '../../modules/phase1/message-flow/index.js';
import { normalizeFlowMessages } from '../../modules/phase1/message-flow/normalize.js';
import { createMessageShell } from '../../modules/phase1/message-shell/index.js';
import { bindPageShellActions, createShellHost, renderSessionListView, renderSessionStatus } from '../../modules/phase1/page-shell/index.js';

export function bootstrapMessageRuntime(refs) {
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

  return {
    api,
    flow,
    shell,
  };
}

export async function bootstrapInitialSessionSelection(refs, flow) {
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
}
