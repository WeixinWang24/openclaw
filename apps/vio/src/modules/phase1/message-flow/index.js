function defaultNormalizeMessages(messages = []) {
  return Array.isArray(messages) ? messages : [];
}

function normalizeRunStatus(status = '') {
  const value = String(status || '').toLowerCase();
  if (['idle', 'started', 'acknowledged', 'streaming', 'final', 'error', 'aborted'].includes(value)) {
    return value;
  }
  return 'idle';
}

function isTerminalRunStatus(status = '') {
  return ['final', 'error', 'aborted'].includes(normalizeRunStatus(status));
}

export function createMessageFlow({ api, shell, renderChrome, renderSessionList, onSessionSelected, normalizeMessages = defaultNormalizeMessages, timers = globalThis, debug = null } = {}) {
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
    sessionRunState: new Map(),
    sessionPendingSettleTimers: new Map(),
    historyWindow: 7,
  };

  function emitDebug(event, payload = {}) {
    void debug?.emit?.({
      area: 'message-flow',
      event,
      activeSessionKey: state.activeSessionKey,
      payload,
    });
  }

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

  function getDefaultRunState() {
    return { runId: null, status: 'idle', updatedAt: 0, source: null };
  }

  function getSessionRunState(sessionKey = null) {
    const key = sessionKey || state.activeSessionKey;
    if (!key) {return getDefaultRunState();}
    return state.sessionRunState.get(key) || getDefaultRunState();
  }

  function setSessionRunState(sessionKey, next = {}) {
    if (!sessionKey) {return getDefaultRunState();}
    const prev = state.sessionRunState.get(sessionKey) || getDefaultRunState();
    const normalized = {
      runId: next.runId ?? prev.runId ?? null,
      status: normalizeRunStatus(next.status ?? prev.status ?? 'idle'),
      updatedAt: Number.isFinite(next.updatedAt) ? next.updatedAt : Date.now(),
      source: next.source ?? prev.source ?? null,
    };
    if (normalized.status === 'idle') {
      normalized.runId = null;
    }
    state.sessionRunState.set(sessionKey, normalized);
    updateSessionListView();
    return normalized;
  }

  function updateSessionListView() {
    renderSessionList?.({
      sessions: state.sessions,
      activeSessionKey: state.activeSessionKey,
      sessionMeta: state.sessionMeta,
      sessionLoadingState: state.sessionLoadingState,
      sessionRunState: state.sessionRunState,
    });
  }

  function syncSessionRunStateFromView(sessionKey, view = null, viewMeta = null) {
    void view;
    if (!sessionKey) {return getDefaultRunState();}
    const activeRunId = viewMeta?.activeRunId || null;
    const activeRunStatus = normalizeRunStatus(viewMeta?.activeRunStatus || 'idle');
    if (!activeRunId || activeRunStatus === 'idle') {
      return setSessionRunState(sessionKey, {
        runId: null,
        status: 'idle',
        updatedAt: Date.now(),
        source: 'history-view',
      });
    }
    return setSessionRunState(sessionKey, {
      runId: activeRunId,
      status: activeRunStatus,
      updatedAt: Date.now(),
      source: 'history-view',
    });
  }

  function clearScheduledSettlement(sessionKey) {
    const timer = state.sessionPendingSettleTimers.get(sessionKey);
    if (timer) {
      timers.clearTimeout(timer);
      state.sessionPendingSettleTimers.delete(sessionKey);
    }
  }

  function settlePendingAfterTerminalRefresh(sessionKey, reason = 'run-terminal') {
    if (!sessionKey) {return;}
    const meta = getSessionMeta(sessionKey);
    meta.pending = false;
    state.pendingRefreshPlans.delete(sessionKey);
    shell?.clearPendingMessages?.(sessionKey);
    emitDebug('pending.settled', { sessionKey, reason });
    updateSessionListView();
    if (state.activeSessionKey === sessionKey) {
      renderChrome?.(sessionKey, {
        loading: false,
        messages: state.sessionMessages.get(sessionKey) || [],
        reason,
        activeSessionKey: state.activeSessionKey,
        meta,
        isActive: true,
        view: state.sessionViews.get(sessionKey) || null,
        viewMeta: state.sessionViewMeta.get(sessionKey) || null,
      });
    }
  }

  function scheduleSessionPendingSettlement(sessionKey, reason = 'run-terminal', delay = 180) {
    if (!sessionKey) {return;}
    clearScheduledSettlement(sessionKey);
    const timer = timers.setTimeout(async () => {
      state.sessionPendingSettleTimers.delete(sessionKey);
      try {
        await refreshSession(sessionKey, reason, { force: true, cacheOnly: true, settlePendingOnTerminal: true });
      } catch {
        settlePendingAfterTerminalRefresh(sessionKey, `${reason}:fallback`);
      }
    }, delay);
    state.sessionPendingSettleTimers.set(sessionKey, timer);
    emitDebug('pending.settlement.scheduled', { sessionKey, reason, delay });
  }

  function applyRunEvent(event = {}) {
    const sessionKey = event?.sessionKey || null;
    const runId = event?.runId || null;
    if (!sessionKey) {return getDefaultRunState();}
    const type = String(event?.type || '').toLowerCase();
    let nextStatus = null;
    if (type === 'run.started') {nextStatus = 'started';}
    else if (type === 'run.acknowledged') {nextStatus = 'acknowledged';}
    else if (type === 'run.delta') {nextStatus = 'streaming';}
    else if (type === 'run.final') {nextStatus = 'final';}
    else if (type === 'run.error') {nextStatus = 'error';}
    else if (type === 'run.aborted') {nextStatus = 'aborted';}
    if (!nextStatus) {return getSessionRunState(sessionKey);}
    const runState = setSessionRunState(sessionKey, {
      runId,
      status: nextStatus,
      updatedAt: Number(event?.ts) || Date.now(),
      source: 'event',
    });
    emitDebug('run-state.updated', { sessionKey, runId, status: runState.status, source: 'event' });
    if (isTerminalRunStatus(runState.status)) {
      scheduleSessionPendingSettlement(sessionKey, type);
    }
    if (state.activeSessionKey === sessionKey) {
      renderChrome?.(sessionKey, {
        loading: false,
        messages: state.sessionMessages.get(sessionKey) || [],
        reason: type,
        activeSessionKey: state.activeSessionKey,
        meta: getSessionMeta(sessionKey),
        isActive: true,
        view: state.sessionViews.get(sessionKey) || null,
        viewMeta: state.sessionViewMeta.get(sessionKey) || null,
      });
    }
    return runState;
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
    emitDebug('history.fetch.start', {
      sessionKey,
      requestSeq,
      reason: options?.reason || null,
      force: options?.force === true,
      cacheOnly: options?.cacheOnly === true,
    });
    const data = await api.fetchSessionHistory(sessionKey, options);
    if (requestSeq !== state.historyRequestSeq) {
      emitDebug('history.fetch.discarded', {
        sessionKey,
        requestSeq,
        currentHistoryRequestSeq: state.historyRequestSeq,
      });
      return state.sessionMessages.get(sessionKey) || [];
    }
    const messages = normalizeMessages(Array.isArray(data?.messages) ? data.messages : data);
    state.sessionMessages.set(sessionKey, messages);
    state.sessionViews.set(sessionKey, data?.view || null);
    state.sessionViewMeta.set(sessionKey, data?.viewMeta || null);
    syncSessionRunStateFromView(sessionKey, data?.view || null, data?.viewMeta || null);
    const meta = getSessionMeta(sessionKey);
    meta.dirty = false;
    meta.pending = false;
    meta.lastUpdatedAt = Date.now();
    meta.lastReason = options?.reason || null;
    emitDebug('history.fetch.resolved', {
      sessionKey,
      requestSeq,
      messageCount: messages.length,
      reason: options?.reason || null,
    });
    return state.sessionMessages.get(sessionKey) || [];
  }

  async function selectSession(sessionKey, options = {}) {
    if (!sessionKey) {return [];} 
    const selectionSeq = ++state.selectionSeq;
    state.activeSessionKey = sessionKey;
    emitDebug('session.select.start', {
      sessionKey,
      selectionSeq,
      reason: options?.reason || null,
    });
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
      emitDebug('session.select.stale', {
        sessionKey,
        selectionSeq,
        currentSelectionSeq: state.selectionSeq,
        activeSessionKey: state.activeSessionKey,
      });
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
    emitDebug('session.select.done', {
      sessionKey,
      selectionSeq,
      messageCount: messages.length,
    });
    return messages;
  }

  async function refreshSession(sessionKey, reason = 'manual', options = {}) {
    if (!sessionKey) {return [];} 
    const refreshSeq = state.selectionSeq;
    const cacheOnly = options?.cacheOnly === true;
    emitDebug('refresh.start', {
      sessionKey,
      refreshSeq,
      reason,
      cacheOnly,
    });
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

    const runState = getSessionRunState(sessionKey);
    if (isTerminalRunStatus(runState.status) && options?.settlePendingOnTerminal === true) {
      settlePendingAfterTerminalRefresh(sessionKey, reason);
    }

    const viewMeta = state.sessionViewMeta.get(sessionKey) || null;
    const activeRunId = viewMeta?.activeRunId || null;
    const activeRunStatus = viewMeta?.activeRunStatus || null;
    const shouldSuppressStreamingRerender =
      state.activeSessionKey === sessionKey &&
      activeRunStatus === 'streaming' &&
      shell?.hasStreamingRowMounted?.(sessionKey, activeRunId || null) === true;

    if (cacheOnly && shouldSuppressStreamingRerender) {
      emitDebug('refresh.skip-render', {
        sessionKey,
        refreshSeq,
        reason,
        cacheOnly,
        why: 'streaming-row-owned',
      });
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
      emitDebug('refresh.done', {
        sessionKey,
        refreshSeq,
        reason,
        cacheOnly: true,
        messageCount: messages.length,
        pending: meta.pending === true,
      });
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
    emitDebug('refresh.done', {
      sessionKey,
      refreshSeq,
      reason,
      cacheOnly: false,
      messageCount: messages.length,
      pending: meta.pending === true,
    });
    return messages;
  }

  function scheduleSessionRefresh(sessionKey, reason = 'session-update', delay = 120, options = {}) {
    if (!sessionKey) {return;}
    emitDebug('refresh.scheduled', {
      sessionKey,
      reason,
      delay,
      cacheOnly: options?.cacheOnly === true,
    });
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
    emitDebug('send.start', {
      sessionKey,
      textLength: String(text || '').length,
      hasLocalId: !!options?.localId,
    });
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
      emitDebug('pending.plan.created', {
        sessionKey,
        localId,
        delays: [250, 900, 2200, 4500],
      });
    }
    const payload = await api.sendMessage(sessionKey, text, options);
    emitDebug('send.accepted', {
      sessionKey,
      localId,
    });
    const plan = state.pendingRefreshPlans.get(sessionKey);
    const refreshDelays = Array.isArray(plan?.delays) ? plan.delays : [250, 900, 2200];
    for (const delay of refreshDelays) {
      scheduleSessionRefresh(sessionKey, `send-observe-${delay}`, delay, { force: true, cacheOnly: true });
    }
    emitDebug('send.observe-armed', {
      sessionKey,
      localId,
      delays: refreshDelays,
    });
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

    applyRunEvent({ type: 'run.acknowledged', sessionKey, runId: null, ts: Date.now() });
    shell?.handleAck?.(sessionKey);
    trace?.push('ack');

    timers.setTimeout(() => {
      applyRunEvent({ type: 'run.delta', sessionKey, runId: null, accumulatedText: delta1, ts: Date.now() });
      shell?.handleDelta?.(sessionKey, delta1);
      trace?.push('delta-1');
    }, ackDelay + delta1Delay);

    timers.setTimeout(() => {
      applyRunEvent({ type: 'run.delta', sessionKey, runId: null, accumulatedText: `${delta1}${delta2}`, ts: Date.now() });
      shell?.handleDelta?.(sessionKey, `${delta1}${delta2}`);
      trace?.push('delta-2');
    }, ackDelay + delta2Delay);

    timers.setTimeout(() => {
      try {
        applyRunEvent({ type: 'run.final', sessionKey, runId: null, ts: Date.now() });
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

  function setHistoryWindow(nextWindow) {
    const parsed = Number(nextWindow);
    if (!Number.isFinite(parsed) || parsed < 1) {return state.historyWindow;}
    state.historyWindow = parsed;
    return state.historyWindow;
  }

  function getHistoryWindow() {
    return state.historyWindow;
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
    setHistoryWindow,
    getHistoryWindow,
    getActiveSessionKey,
    getSessions,
    getSessionMeta,
    getSessionMessages,
    getSessionRunState,
    applyRunEvent,
    syncSessionRunStateFromView,
    isSessionLoading,
    getSessionView(sessionKey = null) {
      return state.sessionViews.get(sessionKey || state.activeSessionKey) || null;
    },
    getSessionViewMeta(sessionKey = null) {
      return state.sessionViewMeta.get(sessionKey || state.activeSessionKey) || null;
    },
  };
}

export { bindComposerFlowActions } from './composer-actions.js';
