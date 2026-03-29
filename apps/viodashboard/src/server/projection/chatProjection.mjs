import { KERNEL_CHANNELS } from '../kernel/kernelEventBus.mjs';

export function createChatProjection({ eventBus }) {
  const viewsBySession = new Map();

  function ensureSessionView(sessionKey) {
    if (!viewsBySession.has(sessionKey)) {
      viewsBySession.set(sessionKey, {
        sessionKey,
        transcriptMeta: {
          count: 0,
          lastMessageId: null,
          lastMessageAt: null,
        },
        runs: {},
        updatedAt: new Date().toISOString(),
      });
    }
    return viewsBySession.get(sessionKey);
  }

  function setUpdated(view) {
    view.updatedAt = new Date().toISOString();
    return view;
  }

  function buildFromTranscript(sessionKey, transcript = []) {
    const view = ensureSessionView(sessionKey);
    const lastMessage = Array.isArray(transcript) && transcript.length ? transcript[transcript.length - 1] : null;
    view.transcriptMeta = {
      count: Array.isArray(transcript) ? transcript.length : 0,
      lastMessageId: lastMessage?.id || null,
      lastMessageAt: lastMessage?.createdAt || null,
    };
    return setUpdated(view);
  }

  function applyKernelRunEvent(event) {
    const sessionKey = event?.sessionKey;
    if (!sessionKey) {return null;}
    const view = ensureSessionView(sessionKey);
    const runId = event?.runId;
    if (!runId) {return setUpdated(view);}

    if (event.type === 'run.started') {
      view.runs[runId] = {
        runId,
        status: 'started',
        userMessage: event.message || '',
        createdAt: new Date(event.ts || Date.now()).toISOString(),
        updatedAt: new Date(event.ts || Date.now()).toISOString(),
        text: '',
        error: null,
      };
    }

    if (event.type === 'run.acknowledged') {
      view.runs[runId] = {
        ...view.runs[runId],
        runId,
        status: 'acknowledged',
        updatedAt: new Date(event.ts || Date.now()).toISOString(),
      };
    }

    if (event.type === 'run.delta') {
      view.runs[runId] = {
        ...view.runs[runId],
        runId,
        status: 'streaming',
        text: event.accumulatedText || event.textDelta || view.runs[runId]?.text || '',
        updatedAt: new Date(event.ts || Date.now()).toISOString(),
      };
    }

    if (event.type === 'run.final') {
      view.runs[runId] = {
        ...view.runs[runId],
        runId,
        status: 'final',
        text: event.text || view.runs[runId]?.text || '',
        updatedAt: new Date(event.ts || Date.now()).toISOString(),
      };
    }

    if (event.type === 'run.error') {
      view.runs[runId] = {
        ...view.runs[runId],
        runId,
        status: 'error',
        error: event.error || null,
        updatedAt: new Date(event.ts || Date.now()).toISOString(),
      };
    }

    if (event.type === 'run.aborted') {
      view.runs[runId] = {
        ...view.runs[runId],
        runId,
        status: 'aborted',
        updatedAt: new Date(event.ts || Date.now()).toISOString(),
      };
    }

    return setUpdated(view);
  }

  const unsubRun = eventBus.subscribe(KERNEL_CHANNELS.RUN, applyKernelRunEvent);
  const unsubTranscript = eventBus.subscribe(KERNEL_CHANNELS.TRANSCRIPT, event => {
    if (event?.type === 'transcript.refreshed') {
      buildFromTranscript(event.sessionKey, event.messages);
    }
  });

  return {
    buildFromTranscript,
    applyKernelRunEvent,
    getSessionView: sessionKey => ensureSessionView(sessionKey),
    dispose() {
      unsubRun?.();
      unsubTranscript?.();
    },
  };
}
