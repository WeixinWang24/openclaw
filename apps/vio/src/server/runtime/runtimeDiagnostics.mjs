export function createRuntimeDiagnostics() {
  const state = {
    connection: {
      status: 'idle',
      updatedAt: null,
      detail: null,
    },
    lastError: null,
    lastRawEventMeta: null,
    lastHistoryFetch: null,
    mismatches: [],
  };

  function recordConnection(status, detail = null) {
    state.connection = {
      status,
      detail,
      updatedAt: new Date().toISOString(),
    };
  }

  function recordError(errorLike) {
    state.lastError = {
      message: errorLike?.message || String(errorLike),
      at: new Date().toISOString(),
    };
  }

  function recordRawEventMeta(meta) {
    state.lastRawEventMeta = {
      ...meta,
      at: new Date().toISOString(),
    };
  }

  function recordMismatch(mismatch) {
    state.mismatches.push({
      ...mismatch,
      at: new Date().toISOString(),
    });
    if (state.mismatches.length > 50) {
      state.mismatches.splice(0, state.mismatches.length - 50);
    }
  }

  function recordHistoryFetch(meta) {
    state.lastHistoryFetch = {
      ...meta,
      at: new Date().toISOString(),
    };
  }

  function getSnapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  return {
    recordConnection,
    recordError,
    recordRawEventMeta,
    recordMismatch,
    recordHistoryFetch,
    getSnapshot,
  };
}
