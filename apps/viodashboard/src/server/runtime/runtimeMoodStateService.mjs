export function createRuntimeMoodStateService({ activeRunSeq }) {
  if (!activeRunSeq) {throw new Error('activeRunSeq is required');}

  let runtimeState = {
    mood: 'idle',
    phase: 'idle',
    activeRunId: null,
    activeRunCount: 0,
    latestRunSeq: 0,
    bodyState: null,
    lightOutput: 'idle',
    source: 'bootstrap',
    updatedAt: new Date().toISOString(),
  };

  function normalizeMood(mode) {
    if (mode === 'thinking' || mode === 'streaming' || mode === 'waiting' || mode === 'error') {return mode;}
    return 'idle';
  }

  function computeVisualState({ mood, phase, activeRunCount }) {
    if (phase === 'error' || mood === 'error') {return 'error';}
    if (activeRunCount > 0 || phase === 'queued' || phase === 'streaming' || mood === 'thinking' || mood === 'streaming') {return 'thinking';}
    if (mood === 'waiting') {return 'waiting';}
    return normalizeMood(mood || 'idle');
  }

  function syncRuntimeState(patch = {}) {
    runtimeState = {
      ...runtimeState,
      ...patch,
      bodyState: patch.bodyState === undefined ? runtimeState.bodyState : patch.bodyState,
    };
    runtimeState.activeRunCount = activeRunSeq.size;

    if (runtimeState.activeRunCount === 0) {
      runtimeState.activeRunId = null;
    }

    runtimeState.lightOutput = computeVisualState(runtimeState);
    runtimeState.updatedAt = new Date().toISOString();
    return runtimeState;
  }

  function buildMoodPacket(mode, extra = {}) {
    const mergedState = syncRuntimeState({
      mood: normalizeMood(mode),
      phase: extra.phase ?? runtimeState.phase,
      activeRunId: extra.runId ?? runtimeState.activeRunId,
      bodyState: extra.state === undefined ? runtimeState.bodyState : extra.state,
      source: extra.source ?? runtimeState.source,
    });
    return {
      type: 'mood',
      mode: mergedState.lightOutput,
      state: mergedState.bodyState ?? null,
      runtime: mergedState,
      detail: {
        mode: mergedState.lightOutput,
        detail: extra.detail ?? 'n/a',
        preview: extra.preview ?? '',
        phase: mergedState.phase ?? null,
        runId: extra.runId ?? null,
        source: mergedState.source,
      },
    };
  }

  return {
    getRuntimeState: () => runtimeState,
    syncRuntimeState,
    buildMoodPacket,
  };
}
