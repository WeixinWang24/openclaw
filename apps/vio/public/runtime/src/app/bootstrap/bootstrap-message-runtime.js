import { createApiClient } from '../../modules/runtime-support/api-client.js';
import { createMessageDebugClient } from '../../modules/runtime-support/message-debug-client.js';
import { bindComposerFlowActions, createMessageFlow } from '../../modules/phase1/message-flow/index.js';
import { normalizeFlowMessages } from '../../modules/phase1/message-flow/normalize.js';
import { createMessageShell, renderSessionListView, renderSessionStatus } from '../../modules/phase1/message-shell/index.js';
import { bindPageShellActions, createMessageRuntimeRefs, createShellHost } from '../../modules/phase1/page-shell/index.js';

export function syncContinueButtonState(refs, flow) {
  if (refs?.continueBtnEl) {
    refs.continueBtnEl.disabled = !flow?.getActiveSessionKey?.();
  }
}

export function syncHistoryWindowState(refs, flow, shell) {
  const value = String(flow?.getHistoryWindow?.() || shell?.getHistoryWindow?.() || 7);
  if (refs?.historyWindowEl && refs.historyWindowEl.value !== value) {
    refs.historyWindowEl.value = value;
  }
}

export function bootstrapMessageRuntime(_refs) {
  const runtimeRefs = createMessageRuntimeRefs();
  const shellMountEl = createShellHost(runtimeRefs);
  const debug = createMessageDebugClient({ enabled: true, profile: 'manual' });
  const shell = createMessageShell({ mountEl: shellMountEl, debug, historyWindow: 7 });
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
      syncContinueButtonState(runtimeRefs, flow);
      syncHistoryWindowState(runtimeRefs, flow, shell);
    },
    onSessionSelected() {
      renderSessionListView(flow, runtimeRefs, {
        sessions: flow.getSessions(),
        activeSessionKey: flow.getActiveSessionKey(),
      });
      syncContinueButtonState(runtimeRefs, flow);
      syncHistoryWindowState(runtimeRefs, flow, shell);
    },
    normalizeMessages: normalizeFlowMessages,
    debug,
  });

  const shellActions = bindPageShellActions({ refs: runtimeRefs });
  bindComposerFlowActions({
    refs: runtimeRefs,
    flow,
    shell,
    debug,
    onSlashBanner: shellActions.emitSlashBanner,
  });
  runtimeRefs?.historyWindowEl?.addEventListener('change', event => {
    const nextWindow = Number(event?.target?.value || 7);
    flow.setHistoryWindow(nextWindow);
    shell.setHistoryWindow(nextWindow);
    syncHistoryWindowState(runtimeRefs, flow, shell);
  });
  syncContinueButtonState(runtimeRefs, flow);
  syncHistoryWindowState(runtimeRefs, flow, shell);

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
  syncContinueButtonState(runtimeRefs, flow);
  syncHistoryWindowState(runtimeRefs, flow, {
    getHistoryWindow: flow.getHistoryWindow,
  });
  const initialSessionKey = flow.getActiveSessionKey() || sessionsData?.currentSessionKey || null;
  if (initialSessionKey) {
    await flow.selectSession(initialSessionKey);
    renderSessionListView(flow, runtimeRefs, {
      sessions: flow.getSessions(),
      activeSessionKey: flow.getActiveSessionKey(),
    });
    syncContinueButtonState(runtimeRefs, flow);
    syncHistoryWindowState(runtimeRefs, flow, {
      getHistoryWindow: flow.getHistoryWindow,
    });
  }
}
