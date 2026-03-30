import { getBodySidecarConfig } from './config.js';
import { mapRuntimeEventToSemanticState } from './runtime-event-mapping.js';
import { createBodySidecarClient } from './sidecar-client.js';

export function createBodySidecarBridge({ eventBus = null, sidecarClient = null, logger = console } = {}) {
  const client = sidecarClient || createBodySidecarClient(getBodySidecarConfig());

  const debugState = {
    bridgeConnected: false,
    lastSemanticState: null,
    lastRuntimeEvent: null,
    lastDispatchAt: null,
    lastDispatchOk: null,
    lastDispatchError: null,
    lastAppliedStateSummary: null,
    lastSessionKey: null,
    lastRunId: null,
  };

  let unsubscribe = null;

  function getDebugState() {
    return { ...debugState };
  }

  async function handleRuntimeEvent(event) {
    const mapped = mapRuntimeEventToSemanticState(event);
    if (!mapped) {return;}

    debugState.lastSemanticState = mapped.semanticState;
    debugState.lastRuntimeEvent = mapped.runtimeEvent;
    debugState.lastDispatchAt = new Date().toISOString();
    debugState.lastSessionKey = event?.sessionKey || null;
    debugState.lastRunId = event?.runId || null;
    debugState.lastDispatchError = null;

    const payload = {
      semanticState: mapped.semanticState,
      runtimeEvent: mapped.runtimeEvent,
      sessionKey: event?.sessionKey || null,
      runId: event?.runId || null,
      replyText: typeof event?.text === 'string' ? event.text : null,
      error: typeof event?.error === 'string' ? event.error : null,
      source: 'vio-runtime-kernel',
      ts: Number.isFinite(event?.ts) ? event.ts : Date.now(),
    };

    try {
      await client.sendBodyState(payload);
      debugState.lastDispatchOk = true;
      debugState.lastAppliedStateSummary = `${mapped.semanticState} -> sent`;
    } catch (error) {
      debugState.lastDispatchOk = false;
      debugState.lastDispatchError = error?.message || String(error);
      debugState.lastAppliedStateSummary = `${mapped.semanticState} -> failed`;
      logger?.warn?.('[body-sidecar-bridge] dispatch failed:', error?.message || error);
    }
  }

  function start() {
    if (!eventBus?.subscribe) {
      throw new Error('eventBus.subscribe is required');
    }
    if (unsubscribe) {return;}
    unsubscribe = eventBus.subscribe('kernel.run', event => {
      void handleRuntimeEvent(event);
    });
    debugState.bridgeConnected = true;
  }

  function stop() {
    unsubscribe?.();
    unsubscribe = null;
    debugState.bridgeConnected = false;
  }

  return {
    start,
    stop,
    getDebugState,
  };
}
