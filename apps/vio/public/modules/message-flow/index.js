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
    meta.pending = false;
    meta.lastUpdatedAt = Date.now();
    meta.lastReason = reason;

    if (cacheOnly) {
      if (state.activeSessionKey === sessionKey) {
        shell?.reconcileHistory?.(sessionKey, messages);
        renderChrome?.(sessionKey, {
          loading: false,
          messages,
          reconciled: true,
          reason,
          refreshSeq,
          activeSessionKey: state.activeSessionKey,
          meta,
          isActive: state.activeSessionKey === sessionKey,
        });
      }
      return messages;
    }

    if (state.activeSessionKey === sessionKey) {
      shell?.reconcileHistory?.(sessionKey, messages);
      renderChrome?.(sessionKey, {
        loading: false,
        messages,
        reason,
        refreshSeq,
        activeSessionKey: state.activeSessionKey,
        meta,
        isActive: state.activeSessionKey === sessionKey,
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
    const timer = timers.setTimeout(() => {
      state.sessionRefreshTimers.delete(sessionKey);
      refreshSession(sessionKey, reason, options).catch(() => {});
    }, delay);
    state.sessionRefreshTimers.set(sessionKey, timer);
  }

  async function sendMessage(sessionKey, text, options = {}) {
    if (!sessionKey || !api?.sendMessage) {return null;}
    const meta = getSessionMeta(sessionKey);
    meta.pending = true;
    meta.lastReason = 'send';
    meta.lastUpdatedAt = Date.now();
    const payload = await api.sendMessage(sessionKey, text, options);
    scheduleSessionRefresh(sessionKey, 'send', 160, { force: true, cacheOnly: true });
    return payload;
  }

  function simulateStream(sessionKey, options = {}) {
    if (!sessionKey) {return false;}
    const trace = Array.isArray(options.trace) ? options.trace : null;
    const delta1 = options.delta1 || 'Vio Phase 1 streaming response...';
    const delta2 = options.delta2 || 'Vio Phase 1 streaming response... still arriving';
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
      shell?.handleDelta?.(sessionKey, delta2);
      trace?.push('delta-2');
    }, ackDelay + delta2Delay);

    timers.setTimeout(() => {
      try {
        shell?.handleFinal?.(sessionKey);
        trace?.push('final');
        const streamSnapshot = shell?.snapshotActiveStream?.() || null;
        trace?.push(`stream-snapshot:${streamSnapshot ? 'yes' : 'no'}`);
        trace?.push(`append-exists:${typeof api?.appendAssistantMessage}`);
        api?.appendAssistantMessage?.(sessionKey, streamSnapshot?.text || delta2);
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
  };
}
