export function createRuntimeSessionState() {
  const seenFinalRunIds = new Set();
  const activeRunSeq = new Map();
  let lastRouting = { mode: 'n/a', detail: 'no final reply routed yet' };
  let lastAssistantFinalNotifiedRunId = null;
  const tokenStats = {
    last: null,
    totalInput: 0,
    totalOutput: 0,
    totalCacheRead: 0,
    totalCacheWrite: 0,
    total: 0,
    baselineReady: false,
    modelName: null,
    modelProvider: null,
    modelLimit: null,
    modelUsagePercent: null,
    contextSnapshot: null,
    diagnosticContext: null,
  };

  return {
    tokenStats,
    seenFinalRunIds,
    activeRunSeq,
    getLastRouting: () => lastRouting,
    setLastRouting: value => {
      lastRouting = value;
      return lastRouting;
    },
    getLastAssistantFinalNotifiedRunId: () => lastAssistantFinalNotifiedRunId,
    setLastAssistantFinalNotifiedRunId: value => {
      lastAssistantFinalNotifiedRunId = value;
      return lastAssistantFinalNotifiedRunId;
    },
  };
}
