function defaultNormalizeMessages(messages = []) {
  return Array.isArray(messages) ? messages : [];
}

export function createMessageFlow({ api, shell, renderChrome, renderSessionList, onSessionSelected, normalizeMessages = defaultNormalizeMessages, timers = globalThis } = {}) {
  const state = {
    activeSessionKey: null,
    historyRequestSeq: 0,
    selectionSeq: 0,
    sessions: [],
    sessionMessages: new Map(),
    sessionMeta: new Map(),
    sessionLoadingState: new Set(),
    sessionRefreshTimers: new Map(),
    pendingRefreshPlans: new Map(),
    sessionViews: new Map(),
    sessionViewMeta: new Map(),
  };

  function getSessionMeta(sessionKey) {
    if (!sessionKey) {
      return { dirty: false, pending: false, lastUpdatedAt: 0, lastReason: null };
    }
    if (!state.sessionMeta.has(sessionKey)) {
      state.sessionMeta.set(sessionKey, {
        dirty: false,
        pending: false,
        lastUpdatedAt: 0,
        lastReason: null,
      });
    }
    return state.sessionMeta.get(sessionKey);
  }

  function setSessionLoading(sessionKey, loading) {
    if (!sessionKey) {return;}
    if (loading) {state.sessionLoadingState.add(sessionKey);}
    else {state.sessionLoadingState.delete(sessionKey);}
  }

  function updateSessionListView() {
    renderSessionList?.({
      sessions: state.sessions,
      activeSessionKey: state.activeSessionKey,
      sessionMeta: state.sessionMeta,
      sessionLoadingState: state.sessionLoadingState,
    });
  }

  async function fetchSessionList() {
    if (!api?.fetchSessionList) {
      return { items: [], currentSessionKey: null };
    }
    const data = await api.fetchSessionList();
    state.sessions = Array.isArray(data?.items) ? data.items : [];
    if (!state.activeSessionKey) {
      state.activeSessionKey = data?.currentSessionKey || state.sessions[0]?.key || null;
    }
    if (state.activeSessionKey && !state.sessions.some(item => item.key === state.activeSessionKey)) {
      state.activeSessionKey = data?.currentSessionKey || state.sessions[0]?.key || null;
    }
    updateSessionListView();
    return data;
  }

  async function fetchSessionHistory(sessionKey, options = {}) {
    if (!sessionKey || !api?.fetchSessionHistory) {return [];} 
    const requestSeq = ++state.historyRequestSeq;
    const data = await api.fetchSessionHistory(sessionKey, options);
    if (requestSeq !== state.historyRequestSeq) {
      return state.sessionMessages.get(sessionKey) || [];
    }
    const messages = normalizeMessages(Array.isArray(data?.messages) ? data.messages : data);
    state.sessionMessages.set(sessionKey, messages);
    state.sessionViews.set(sessionKey, data?.view || null);
    state.sessionViewMeta.set(sessionKey, data?.viewMeta || null);
    const meta = getSessionMeta(sessionKey);
    meta.dirty = false;
    meta.pending = false;
    meta.lastUpdatedAt = Date.now();
    meta.lastReason = options?.reason || null;
    return state.sessionMessages.get(sessionKey) || [];
  }

  async function selectSession(sessionKey, options = {}) {
    if (!sessionKey) {return [];} 
    const selectionSeq = ++state.selectionSeq;
    state.activeSessionKey = sessionKey;
    onSessionSelected?.(sessionKey);
    updateSessionListView();
    setSessionLoading(sessionKey, true);
    renderChrome?.(sessionKey, {
      loading: true,
      activeSessionKey: state.activeSessionKey,
      meta: getSessionMeta(sessionKey),
      isActive: state.activeSessionKey === sessionKey,
    });
    const messages = await fetchSessionHistory(sessionKey, options);
    if (selectionSeq !== state.selectionSeq || state.activeSessionKey !== sessionKey) {
      return state.sessionMessages.get(sessionKey) || [];
    }
    setSessionLoading(sessionKey, false);
    shell?.mountSession?.(sessionKey, messages);
    renderChrome?.(sessionKey, {
      loading: false,
      messages,
      activeSessionKey: state.activeSessionKey,
      meta: getSessionMeta(sessionKey),
      isActive: state.activeSessionKey === sessionKey,
      selectionSeq,
      view: state.sessionViews.get(sessionKey) || null,
      viewMeta: state.sessionViewMeta.get(sessionKey) || null,
    });
    return messages;
  }

  async function refreshSession(sessionKey, reason = 'manual', options = {}) {
    if (!sessionKey) {return [];} 
    const refreshSeq = state.selectionSeq;
    const cacheOnly = options?.cacheOnly === true;
    const messages = await fetchSessionHistory(sessionKey, { ...options, force: true, reason });
    const meta = getSessionMeta(sessionKey);
    meta.dirty = false;
    meta.lastUpdatedAt = Date.now();
    meta.lastReason = reason;

    let reconcileResult = { absorbedIds: [] };
    if (state.activeSessionKey === sessionKey) {
      reconcileResult = shell?.reconcileHistory?.(sessionKey, messages) || { absorbedIds: [] };
    }

    const pendingPlan = state.pendingRefreshPlans.get(sessionKey) || null;
    if (pendingPlan?.localId) {
      const absorbed = Array.isArray(reconcileResult?.absorbedIds) && reconcileResult.absorbedIds.includes(pendingPlan.localId);
      const stillPending = shell?.hasPendingMessage?.(sessionKey, pendingPlan.localId) === true;
      meta.pending = stillPending && !absorbed;
      if (absorbed || !stillPending) {
        state.pendingRefreshPlans.delete(sessionKey);
      }
    } else {
      meta.pending = false;
    }

    const viewMeta = state.sessionViewMeta.get(sessionKey) || null;
    const activeRunId = viewMeta?.activeRunId || null;
    const activeRunStatus = viewMeta?.activeRunStatus || null;
    const shouldSuppressStreamingRerender =
      state.activeSessionKey === sessionKey &&
      activeRunStatus === 'streaming' &&
      shell?.hasStreamingRowMounted?.(sessionKey, activeRunId || null) === true;

    if (cacheOnly && shouldSuppressStreamingRerender) {
      return messages;
    }

    if (cacheOnly) {
      if (state.activeSessionKey === sessionKey) {
        renderChrome?.(sessionKey, {
          loading: false,
          messages,
          reconciled: true,
          reason,
          refreshSeq,
          activeSessionKey: state.activeSessionKey,
          meta,
          isActive: state.activeSessionKey === sessionKey,
          view: state.sessionViews.get(sessionKey) || null,
          viewMeta: state.sessionViewMeta.get(sessionKey) || null,
        });
      }
      return messages;
    }

    if (state.activeSessionKey === sessionKey && !shouldSuppressStreamingRerender) {
      renderChrome?.(sessionKey, {
        loading: false,
        messages,
        reason,
        refreshSeq,
        activeSessionKey: state.activeSessionKey,
        meta,
        isActive: state.activeSessionKey === sessionKey,
        view: state.sessionViews.get(sessionKey) || null,
        viewMeta: state.sessionViewMeta.get(sessionKey) || null,
      });
    }
    return messages;
  }

  function scheduleSessionRefresh(sessionKey, reason = 'session-update', delay = 120, options = {}) {
    if (!sessionKey) {return;}
    const meta = getSessionMeta(sessionKey);
    meta.dirty = true;
    meta.lastReason = reason;
    meta.lastUpdatedAt = Date.now();
    if (state.activeSessionKey === sessionKey) {
      meta.pending = true;
    }
    const existing = state.sessionRefreshTimers.get(sessionKey);
    if (existing) {timers.clearTimeout(existing);}
    const timer = timers.setTimeout(async () => {
      state.sessionRefreshTimers.delete(sessionKey);
      try {
        const messages = await refreshSession(sessionKey, reason, options);
        if (typeof options?.afterRefresh === 'function') {
          options.afterRefresh(messages);
        }
      } catch {
        if (typeof options?.afterError === 'function') {
          options.afterError();
        }
      }
    }, delay);
    state.sessionRefreshTimers.set(sessionKey, timer);
  }

  async function sendMessage(sessionKey, text, options = {}) {
    if (!sessionKey || !api?.sendMessage) {return null;}
    const meta = getSessionMeta(sessionKey);
    meta.pending = true;
    meta.lastReason = 'send';
    meta.lastUpdatedAt = Date.now();
    const localId = options?.localId || null;
    if (localId) {
      state.pendingRefreshPlans.set(sessionKey, {
        localId,
        delays: [250, 900, 2200, 4500],
        startedAt: Date.now(),
      });
    }
    const payload = await api.sendMessage(sessionKey, text, options);
    const plan = state.pendingRefreshPlans.get(sessionKey);
    const refreshDelays = Array.isArray(plan?.delays) ? plan.delays : [250, 900, 2200];
    for (const delay of refreshDelays) {
      scheduleSessionRefresh(sessionKey, `send-observe-${delay}`, delay, { force: true, cacheOnly: true });
    }
    return payload;
  }

  function simulateStream(sessionKey, options = {}) {
    if (!sessionKey) {return false;}
    const trace = Array.isArray(options.trace) ? options.trace : null;
    const delta1 = options.delta1 || 'Vio is thinking';
    const delta2 = options.delta2 || '… and composing a reply';
    const ackDelay = Number.isFinite(options.ackDelayMs) ? options.ackDelayMs : 0;
    const delta1Delay = Number.isFinite(options.delta1DelayMs) ? options.delta1DelayMs : 80;
    const delta2Delay = Number.isFinite(options.delta2DelayMs) ? options.delta2DelayMs : 180;
    const finalDelay = Number.isFinite(options.finalDelayMs) ? options.finalDelayMs : 280;
    const refreshDelay = Number.isFinite(options.refreshDelayMs) ? options.refreshDelayMs : 420;

    shell?.handleAck?.(sessionKey);
    trace?.push('ack');

    timers.setTimeout(() => {
      shell?.handleDelta?.(sessionKey, delta1);
      trace?.push('delta-1');
    }, ackDelay + delta1Delay);

    timers.setTimeout(() => {
      shell?.handleDelta?.(sessionKey, `${delta1}${delta2}`);
      trace?.push('delta-2');
    }, ackDelay + delta2Delay);

    timers.setTimeout(() => {
      try {
        shell?.handleFinal?.(sessionKey);
        trace?.push('final');
        const streamSnapshot = shell?.snapshotActiveStream?.() || null;
        trace?.push(`stream-snapshot:${streamSnapshot ? 'yes' : 'no'}`);
        trace?.push(`append-exists:${typeof api?.appendAssistantMessage}`);
        api?.appendAssistantMessage?.(sessionKey, streamSnapshot?.text || `${delta1}${delta2}`);
        trace?.push('append-history');
      } catch (error) {
        trace?.push(`final-error:${error?.message || error}`);
      }
    }, ackDelay + finalDelay);

    timers.setTimeout(() => {
      trace?.push('refresh-start');
      refreshSession(sessionKey, options.reason || 'stream-simulated')
        .then(() => trace?.push('refresh-done'))
        .catch(() => trace?.push('refresh-failed'));
    }, ackDelay + refreshDelay);

    return true;
  }

  function getActiveSessionKey() {
    return state.activeSessionKey;
  }

  function getSessions() {
    return state.sessions;
  }

  function isSessionLoading(sessionKey) {
    return state.sessionLoadingState.has(sessionKey);
  }

  function getSessionMessages(sessionKey = null) {
    return state.sessionMessages.get(sessionKey || state.activeSessionKey) || [];
  }

  return {
    fetchSessionList,
    fetchSessionHistory,
    selectSession,
    refreshSession,
    scheduleSessionRefresh,
    sendMessage,
    simulateStream,
    getActiveSessionKey,
    getSessions,
    getSessionMeta,
    getSessionMessages,
    isSessionLoading,
    getSessionView(sessionKey = null) {
      return state.sessionViews.get(sessionKey || state.activeSessionKey) || null;
    },
    getSessionViewMeta(sessionKey = null) {
      return state.sessionViewMeta.get(sessionKey || state.activeSessionKey) || null;
    },
  };
}
