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
    prewarm: {
      gatewayHelper: {
        status: 'idle',
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        error: null,
      },
      readPaths: {
        status: 'idle',
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        error: null,
      },
    },
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

  function recordPrewarm(kind, patch = {}) {
    if (!kind || !state.prewarm[kind]) {return;}
    state.prewarm[kind] = {
      ...state.prewarm[kind],
      ...patch,
      updatedAt: new Date().toISOString(),
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
    recordPrewarm,
    getSnapshot,
  };
}
