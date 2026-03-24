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

  function handleQueued(runId, sidecarResult = null) {
    if (runId) {
      state.runSequenceRef.increment();
      state.activeRunSeq.set(runId, state.runSequenceRef.get());
    }
    syncRuntimeState({
      mood: 'thinking',
      phase: 'queued',
      activeRunId: runId || getRuntimeState().activeRunId,
      latestRunSeq: state.runSequenceRef.get(),
      bodyState: sidecarResult?.state ?? getRuntimeState().bodyState,
      source: 'queued',
    });
    broadcast(buildMoodPacket('thinking', {
      detail: 'task-start sent to sidecar',
      phase: 'queued',
      runId,
      state: sidecarResult?.state ?? getRuntimeState().bodyState ?? { current_status: 'thinking', last_stable_status: 'thinking', light_output: 'thinking' },
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
    syncRuntimeState({ source: 'chat-error' });
    try {
      const result = await sideEffects.onAssistantError();
      routing.setLastRouting({ mode: 'error', detail: event.payload?.errorMessage || 'chat error', phase: 'error', runId: event.runId });
      broadcast(buildMoodPacket('error', {
        state: result?.state ?? getRuntimeState().bodyState,
        detail: routing.getLastRouting().detail,
        phase: 'error',
        runId: event.runId,
        source: 'chat-error',
      }));
    } catch (error) {
      console.log('[wrapper] sidecar error routing failed', error?.message || String(error));
    }
  }

  function handleAborted(event) {
    if (event.runId) {state.activeRunSeq.delete(event.runId);}
    routing.setLastRouting({ mode: state.activeRunSeq.size ? 'thinking' : 'idle', detail: 'chat aborted', phase: 'aborted', runId: event.runId });
    broadcast(buildMoodPacket(state.activeRunSeq.size ? 'thinking' : 'idle', {
      state: getRuntimeState().bodyState,
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
    routing.setLastRouting({ mode: 'error', detail: error?.message || String(error), phase: 'final', runId: event.runId });
    console.log('[wrapper] sidecar final routing failed', error?.message || String(error));
    broadcast(buildMoodPacket('error', {
      detail: routing.getLastRouting().detail,
      phase: 'final',
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
