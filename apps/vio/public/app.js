import { createApiClient } from './modules/api-client.js';
import { createCodeReaderController } from './modules/code-reader.js';
import { createExplorerController } from './modules/explorer.js';
import { enableLayoutResize } from './modules/layout-resize.js';
import { createMessageFlow } from './modules/message-flow/index.js';
import { normalizeFlowMessages } from './modules/message-flow/normalize.js';
import { createMessageShell } from './modules/message-shell/index.js';
import { bindPageShellActions, createPageShell, createShellHost, renderBootError, renderPreviewPlaceholder, renderSessionListView, renderSessionStatus } from './modules/page-shell/index.js';

const rootEl = document.getElementById('app');

function attachRunEventStream(flow, shell) {
  const es = new EventSource('/api/events');
  es.addEventListener('message', event => {
    try {
      const payload = JSON.parse(String(event.data || '{}'));
      const kernelEvent = payload?.event || null;
      if (!kernelEvent) {return;}
      const sessionKey = kernelEvent?.sessionKey || null;
      const runId = kernelEvent?.runId || null;
      const isSelected = flow?.getActiveSessionKey?.() === sessionKey;
      if (!sessionKey) {return;}

      if (kernelEvent.type === 'run.delta') {
        if (isSelected) {
          shell?.handleDelta?.(sessionKey, runId, String(kernelEvent.accumulatedText || kernelEvent.textDelta || ''));
        }
        return;
      }

      if (kernelEvent.type === 'run.final') {
        if (isSelected) {
          shell?.handleFinal?.(sessionKey, runId || null);
        }
        window.setTimeout(() => {
          flow?.refreshSession?.(sessionKey, 'run-final', { force: true, cacheOnly: true }).catch(() => {});
        }, 120);
        return;
      }

      if (kernelEvent.type === 'run.aborted' || kernelEvent.type === 'run.error') {
        flow?.refreshSession?.(sessionKey, kernelEvent.type, { force: true, cacheOnly: true }).catch(() => {});
      }
    } catch {}
  });
  return es;
}

async function bootstrap() {
  const refs = createPageShell(rootEl);
  enableLayoutResize({ root: document.documentElement });
  renderPreviewPlaceholder(refs, {
    title: 'Flow preview',
    text: 'Loading session shell…',
  });
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
  attachRunEventStream(flow, shell);

  function setExplorerStatus(text, extra = {}) {
    if (!refs?.activeFilePathEl) {return;}
    if (extra?.semanticLabel) {
      refs.activeFilePathEl.innerHTML = `<span class="semantic-label">${String(extra.semanticLabel)}</span> <span class="semantic-value">${String(text || '')}</span>`;
      return;
    }
    refs.activeFilePathEl.innerHTML = `<span class="semantic-value">${String(text || '')}</span>`;
  }

  const codeReader = createCodeReaderController(refs, {
    onStatus: setExplorerStatus,
  });
  codeReader.bind();

  const explorer = createExplorerController(refs, {
    onStatus: setExplorerStatus,
    canNavigateAway: () => codeReader.confirmDiscardIfDirty(),
    onFileSelected: async relPath => await codeReader.loadFile(relPath),
  });
  explorer.bind();
  await explorer.loadFileTree('.');

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
  renderBootError(rootEl, error);
});
