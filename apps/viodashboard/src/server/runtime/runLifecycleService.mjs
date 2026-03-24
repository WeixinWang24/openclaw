export function createRunLifecycleService({
  state,
  routing,
  getRuntimeState,
  syncRuntimeState,
  buildMoodPacket,
  broadcast,
  sideEffects,
}) {
  if (!state) {throw new Error('state is required');}
  if (!routing) {throw new Error('routing is required');}
  if (typeof getRuntimeState !== 'function') {throw new Error('getRuntimeState is required');}
  if (typeof syncRuntimeState !== 'function') {throw new Error('syncRuntimeState is required');}
  if (typeof buildMoodPacket !== 'function') {throw new Error('buildMoodPacket is required');}
  if (typeof broadcast !== 'function') {throw new Error('broadcast is required');}

  function handleQueued(runId, _sidecarResult = null) {
    if (runId) {
      state.runSequenceRef.increment();
      state.activeRunSeq.set(runId, state.runSequenceRef.get());
    }
    syncRuntimeState({
      mood: 'thinking',
      phase: 'queued',
      activeRunId: runId || getRuntimeState().activeRunId,
      latestRunSeq: state.runSequenceRef.get(),
      source: 'queued',
    });
    broadcast(buildMoodPacket('thinking', {
      detail: 'chat queued',
      phase: 'queued',
      runId,
      source: 'queued',
    }));
  }

  function handleDelta(event) {
    syncRuntimeState({
      mood: 'thinking',
      phase: 'streaming',
      activeRunId: event.runId || getRuntimeState().activeRunId,
      source: 'chat-delta',
    });
    broadcast(buildMoodPacket('thinking', {
      detail: 'assistant streaming',
      preview: (event.text || '').slice(0, 120),
      phase: 'streaming',
      runId: event.runId,
      source: 'chat-delta',
    }));
  }

  async function handleError(event) {
    if (event.runId) {state.activeRunSeq.delete(event.runId);}
    try {
      await sideEffects.onAssistantError();
    } catch (error) {
      console.log('[wrapper] sidecar error routing failed', error?.message || String(error));
    }
    syncRuntimeState({ mood: 'error', phase: 'error', source: 'chat-error' });
    routing.setLastRouting({ mode: 'error', detail: event.payload?.errorMessage || 'chat error', phase: 'error', runId: event.runId });
    broadcast(buildMoodPacket('error', {
      detail: routing.getLastRouting().detail,
      phase: 'error',
      runId: event.runId,
      source: 'chat-error',
    }));
  }

  function handleAborted(event) {
    if (event.runId) {state.activeRunSeq.delete(event.runId);}
    const mode = state.activeRunSeq.size ? 'thinking' : 'idle';
    routing.setLastRouting({ mode, detail: 'chat aborted', phase: 'aborted', runId: event.runId });
    syncRuntimeState({ mood: mode, phase: state.activeRunSeq.size ? 'streaming' : 'aborted', source: 'chat-aborted' });
    broadcast(buildMoodPacket(mode, {
      detail: 'chat aborted',
      phase: state.activeRunSeq.size ? 'streaming' : 'aborted',
      runId: event.runId,
      source: 'chat-aborted',
    }));
  }

  function handleFinalStart(event) {
    const finishedSeq = event.runId ? state.activeRunSeq.get(event.runId) || 0 : 0;
    if (event.runId) {state.activeRunSeq.delete(event.runId);}
    syncRuntimeState({
      activeRunId: state.activeRunSeq.size ? getRuntimeState().activeRunId : null,
      source: 'chat-final',
    });
    return { finishedSeq };
  }

  function handleFinalFailure(event, error) {
    routing.setLastRouting({ mode: 'error', detail: error?.message || String(error), phase: 'final-handler', runId: event.runId });
    console.log('[wrapper] final handler failed before completion broadcast', error?.message || String(error));
    broadcast(buildMoodPacket('error', {
      detail: routing.getLastRouting().detail,
      phase: 'final-handler',
      runId: event.runId,
      source: 'chat-final-error',
    }));
  }

  return {
    handleQueued,
    handleDelta,
    handleError,
    handleAborted,
    handleFinalStart,
    handleFinalFailure,
  };
}
