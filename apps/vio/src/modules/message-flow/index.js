function defaultNormalizeMessages(messages = []) {
  return Array.isArray(messages) ? messages : [];
}

export function createMessageFlow({ api, shell, renderChrome, renderSessionList, onSessionSelected, normalizeMessages = defaultNormalizeMessages } = {}) {
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
    renderChrome?.(sessionKey, { loading: true });
    const messages = await fetchSessionHistory(sessionKey, options);
    if (selectionSeq !== state.selectionSeq || state.activeSessionKey !== sessionKey) {
      return state.sessionMessages.get(sessionKey) || [];
    }
    setSessionLoading(sessionKey, false);
    shell?.mountSession?.(sessionKey, messages);
    renderChrome?.(sessionKey, { loading: false });
    return messages;
  }

  async function refreshSession(sessionKey, reason = 'manual', options = {}) {
    if (!sessionKey) {return [];} 
    const messages = await fetchSessionHistory(sessionKey, { ...options, force: true, reason });
    if (state.activeSessionKey === sessionKey) {
      shell?.reconcileHistory?.(sessionKey, messages);
      renderChrome?.(sessionKey, { loading: false });
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
    if (existing) {clearTimeout(existing);}
    const timer = setTimeout(() => {
      state.sessionRefreshTimers.delete(sessionKey);
      refreshSession(sessionKey, reason, options).catch(() => {});
    }, delay);
    state.sessionRefreshTimers.set(sessionKey, timer);
  }

  async function sendMessage(sessionKey, text, options = {}) {
    if (!sessionKey || !api?.sendMessage) {return null;}
    return api.sendMessage(sessionKey, text, options);
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

  return {
    fetchSessionList,
    fetchSessionHistory,
    selectSession,
    refreshSession,
    scheduleSessionRefresh,
    sendMessage,
    getActiveSessionKey,
    getSessions,
    getSessionMeta,
    isSessionLoading,
  };
}
