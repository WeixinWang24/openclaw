import { createApiClient } from '../../modules/runtime-support/api-client.js';
import { createMessageDebugClient } from '../../modules/runtime-support/message-debug-client.js';
import { createMessageFlow } from '../../modules/phase1/message-flow/index.js';
import { normalizeFlowMessages } from '../../modules/phase1/message-flow/normalize.js';
import { createMessageShell } from '../../modules/phase1/message-shell/index.js';
import { bindPageShellActions, createMessageRuntimeRefs, createShellHost, renderSessionListView, renderSessionStatus } from '../../modules/phase1/page-shell/index.js';

export function bootstrapMessageRuntime(_refs) {
  const runtimeRefs = createMessageRuntimeRefs();
  const shellMountEl = createShellHost(runtimeRefs);
  const debug = createMessageDebugClient({ enabled: true, profile: 'manual' });
  const shell = createMessageShell({ mountEl: shellMountEl, debug });
  const api = createApiClient();
  let flow;
  flow = createMessageFlow({
    api,
    shell,
    renderChrome(sessionKey, payload = {}) {
      renderSessionStatus(runtimeRefs, flow, sessionKey, payload);
    },
    renderSessionList(payload) {
      renderSessionListView(flow, runtimeRefs, payload);
    },
    onSessionSelected() {
      renderSessionListView(flow, runtimeRefs, {
        sessions: flow.getSessions(),
        activeSessionKey: flow.getActiveSessionKey(),
      });
    },
    normalizeMessages: normalizeFlowMessages,
    debug,
  });

  bindPageShellActions({ refs: runtimeRefs, flow, shell, debug });

  if (typeof window !== 'undefined') {
    window.__VIO_DEBUG__ = {
      api,
      flow,
      shell,
      debug,
    };
  }

  return {
    api,
    flow,
    shell,
  };
}

export async function bootstrapInitialSessionSelection(refs, flow) {
  void refs;
  const runtimeRefs = createMessageRuntimeRefs();
  const sessionsData = await flow.fetchSessionList();
  renderSessionListView(flow, runtimeRefs, {
    sessions: flow.getSessions(),
    activeSessionKey: flow.getActiveSessionKey(),
  });
  const initialSessionKey = flow.getActiveSessionKey() || sessionsData?.currentSessionKey || null;
  if (initialSessionKey) {
    await flow.selectSession(initialSessionKey);
    renderSessionListView(flow, runtimeRefs, {
      sessions: flow.getSessions(),
      activeSessionKey: flow.getActiveSessionKey(),
    });
  }
}
