import { randomUUID } from 'node:crypto';
import { KERNEL_CHANNELS } from './kernelEventBus.mjs';

function extractChatText(payload = {}) {
  if (typeof payload?.delta === 'string') {return payload.delta;}
  if (typeof payload?.text === 'string') {return payload.text;}
  if (typeof payload?.message?.text === 'string') {return payload.message.text;}
  return '';
}

export function createChatRuntime({
  rpcClient,
  eventBus,
  sessionRegistry,
  diagnostics,
  defaultSessionKeyResolver,
}) {
  const runsById = new Map();
  const deltaBuffersByRunId = new Map();

  function createRunRecord({ runId, sessionKey, message }) {
    return {
      runId,
      sessionKey,
      status: 'started',
      userMessage: message,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      finalText: '',
      error: null,
      aborted: false,
    };
  }

  function updateRun(runId, patch) {
    const prev = runsById.get(runId);
    if (!prev) {return null;}
    const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
    runsById.set(runId, next);
    return next;
  }

  async function send({ sessionKey, message, deliver = false }) {
    const resolvedSessionKey = sessionKey || defaultSessionKeyResolver?.();
    if (!resolvedSessionKey) {throw new Error('sessionKey is required');}
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {throw new Error('message is required');}

    const runId = randomUUID();
    runsById.set(runId, createRunRecord({ runId, sessionKey: resolvedSessionKey, message: cleanMessage }));
    deltaBuffersByRunId.set(runId, '');
    sessionRegistry?.markRunActive(resolvedSessionKey, runId);

    eventBus?.emit(KERNEL_CHANNELS.RUN, {
      type: 'run.started',
      runId,
      sessionKey: resolvedSessionKey,
      message: cleanMessage,
      ts: Date.now(),
    });

    try {
      await rpcClient.call('chat.send', {
        sessionKey: resolvedSessionKey,
        message: cleanMessage,
        deliver,
        idempotencyKey: runId,
      });
      updateRun(runId, { status: 'acknowledged' });
      eventBus?.emit(KERNEL_CHANNELS.RUN, {
        type: 'run.acknowledged',
        runId,
        sessionKey: resolvedSessionKey,
        ts: Date.now(),
      });
      return { runId, sessionKey: resolvedSessionKey };
    } catch (error) {
      diagnostics?.recordError(error);
      updateRun(runId, { status: 'error', error: error?.message || String(error) });
      sessionRegistry?.markRunFinished(resolvedSessionKey, runId);
      eventBus?.emit(KERNEL_CHANNELS.RUN, {
        type: 'run.error',
        runId,
        sessionKey: resolvedSessionKey,
        error: error?.message || String(error),
        ts: Date.now(),
      });
      throw error;
    }
  }

  async function abort({ sessionKey, runId }) {
    if (!sessionKey && !runId) {throw new Error('sessionKey or runId is required');}
    await rpcClient.call('chat.abort', {
      ...(sessionKey ? { sessionKey } : {}),
      ...(runId ? { runId } : {}),
    });
    if (runId && runsById.has(runId)) {
      const run = runsById.get(runId);
      updateRun(runId, { status: 'aborted', aborted: true });
      sessionRegistry?.markRunFinished(run.sessionKey, runId);
      eventBus?.emit(KERNEL_CHANNELS.RUN, {
        type: 'run.aborted',
        runId,
        sessionKey: run.sessionKey,
        ts: Date.now(),
      });
    }
  }

  function ingestRawEvent(rawEvent) {
    if (rawEvent?.event !== 'chat') {return;}
    const payload = rawEvent?.payload || {};
    const runId = payload?.runId || rawEvent?.runId || null;
    const sessionKey = payload?.sessionKey || rawEvent?.sessionKey || payload?.session?.key || null;
    if (!runId || !sessionKey) {
      diagnostics?.recordMismatch({ kind: 'chat-event-missing-identity', rawEvent });
      return;
    }

    if (!runsById.has(runId)) {
      runsById.set(runId, createRunRecord({ runId, sessionKey, message: '' }));
      deltaBuffersByRunId.set(runId, '');
      sessionRegistry?.markRunActive(sessionKey, runId);
    }

    const state = String(payload?.state || payload?.status || '').toLowerCase();
    const text = extractChatText(payload);

    if (state === 'delta' && text) {
      const prev = deltaBuffersByRunId.get(runId) || '';
      const next = prev + text;
      deltaBuffersByRunId.set(runId, next);
      updateRun(runId, { status: 'streaming' });
      eventBus?.emit(KERNEL_CHANNELS.RUN, {
        type: 'run.delta',
        runId,
        sessionKey,
        textDelta: text,
        accumulatedText: next,
        ts: Date.now(),
      });
      return;
    }

    if (state === 'final' || state === 'completed') {
      const finalText = (typeof payload?.text === 'string' && payload.text) || deltaBuffersByRunId.get(runId) || text || '';
      updateRun(runId, { status: 'final', finalText });
      sessionRegistry?.markRunFinished(sessionKey, runId);
      eventBus?.emit(KERNEL_CHANNELS.RUN, {
        type: 'run.final',
        runId,
        sessionKey,
        text: finalText,
        ts: Date.now(),
      });
      return;
    }

    if (state === 'error') {
      const errorText = payload?.errorMessage || payload?.error?.message || 'chat error';
      updateRun(runId, { status: 'error', error: errorText });
      sessionRegistry?.markRunFinished(sessionKey, runId);
      eventBus?.emit(KERNEL_CHANNELS.RUN, {
        type: 'run.error',
        runId,
        sessionKey,
        error: errorText,
        ts: Date.now(),
      });
      return;
    }

    if (state === 'aborted') {
      updateRun(runId, { status: 'aborted', aborted: true });
      sessionRegistry?.markRunFinished(sessionKey, runId);
      eventBus?.emit(KERNEL_CHANNELS.RUN, {
        type: 'run.aborted',
        runId,
        sessionKey,
        ts: Date.now(),
      });
    }
  }

  return {
    send,
    abort,
    ingestRawEvent,
    getRun: runId => runsById.get(runId) || null,
    getRunsBySession: sessionKey => [...runsById.values()].filter(run => run.sessionKey === sessionKey),
  };
}
