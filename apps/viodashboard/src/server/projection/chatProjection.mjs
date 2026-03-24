import { KERNEL_CHANNELS } from '../kernel/kernelEventBus.mjs';

export function createChatProjection({ eventBus }) {
  const viewsBySession = new Map();

  function collapseContinuePromptForDisplay(text = '', role = '') {
    const source = String(text || '').trim();
    if (role !== 'user') {return source;}
    if (source.startsWith('继续上一条 assistant 回复里最后明确提出的事情。')) {
      return '继续';
    }
    return source;
  }

  function ensureSessionView(sessionKey) {
    if (!viewsBySession.has(sessionKey)) {
      viewsBySession.set(sessionKey, {
        sessionKey,
        messages: [],
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
    view.messages = transcript.map(item => ({
      id: item.id,
      role: item.role,
      text: item.text,
      createdAt: item.createdAt,
      kind: 'message',
      status: 'final',
    }));
    return setUpdated(view);
  }

  function applyKernelRunEvent(event) {
    const sessionKey = event?.sessionKey;
    if (!sessionKey) {return null;}
    const view = ensureSessionView(sessionKey);
    const runId = event?.runId;

    if (event.type === 'run.started') {
      view.runs[runId] = { runId, status: 'started' };
      const attachmentSummary = Array.isArray(event.attachments) && event.attachments.length
        ? `${event.message ? '\n\n' : ''}Attachment${event.attachments.length > 1 ? 's' : ''} (${event.attachments.length})`
        : '';
      view.messages.push({
        id: `user:${runId}`,
        role: 'user',
        text: `${collapseContinuePromptForDisplay(event.message, 'user')}${attachmentSummary}`,
        kind: 'message',
        status: 'final',
        createdAt: new Date(event.ts || Date.now()).toISOString(),
      });
    }

    if (event.type === 'run.delta') {
      view.runs[runId] = { ...view.runs[runId], runId, status: 'streaming' };
      const existing = view.messages.find(item => item.id === `assistant:${runId}`);
      if (existing) {
        existing.text = event.accumulatedText || existing.text;
        existing.status = 'streaming';
      } else {
        view.messages.push({
          id: `assistant:${runId}`,
          role: 'assistant',
          text: event.accumulatedText || event.textDelta || '',
          kind: 'message',
          status: 'streaming',
          createdAt: new Date(event.ts || Date.now()).toISOString(),
        });
      }
    }

    if (event.type === 'run.final') {
      view.runs[runId] = { ...view.runs[runId], runId, status: 'final' };
      const existing = view.messages.find(item => item.id === `assistant:${runId}`);
      if (existing) {
        existing.text = event.text || existing.text;
        existing.status = 'final';
      } else {
        view.messages.push({
          id: `assistant:${runId}`,
          role: 'assistant',
          text: event.text || '',
          kind: 'message',
          status: 'final',
          createdAt: new Date(event.ts || Date.now()).toISOString(),
        });
      }
    }

    if (event.type === 'run.error') {
      view.runs[runId] = { ...view.runs[runId], runId, status: 'error', error: event.error };
    }

    if (event.type === 'run.aborted') {
      view.runs[runId] = { ...view.runs[runId], runId, status: 'aborted' };
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
