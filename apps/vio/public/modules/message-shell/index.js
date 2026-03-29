function formatStamp() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function roleForRow(message = {}) {
  const role = String(message?.role || '').toLowerCase();
  if (role === 'user') {return 'user';}
  if (role === 'assistant') {return 'assistant';}
  return 'assistant';
}

function normalizeMessageRole(message = {}) {
  return String(message?.role || '').toLowerCase();
}

function createMessageRow(role, text, { status = null, localId = null, runId = null, streamRunId = null, messageRole = null, extraClass = '' } = {}) {
  const row = document.createElement('div');
  row.className = `msg-row ${role}`.trim();
  if (status) {row.dataset.status = String(status);}
  if (localId) {row.dataset.pendingId = String(localId);}
  if (runId) {row.dataset.runId = String(runId);}
  if (streamRunId) {row.dataset.streamRunId = String(streamRunId);}
  if (messageRole) {row.dataset.messageRole = String(messageRole);}

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`.trim();
  avatar.textContent = role === 'user' ? 'X' : role === 'assistant' ? 'V' : '•';

  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-wrap';

  const meta = document.createElement('div');
  meta.className = `msg-meta ${role}`.trim();
  meta.textContent = `${role === 'user' ? 'Xin' : 'Vio'} · ${formatStamp()}${status ? ` · ${String(status)}` : ''}`;

  const msg = document.createElement('div');
  msg.className = `msg ${role} ${extraClass}`.trim();
  msg.textContent = text || '';

  bubbleWrap.appendChild(meta);
  bubbleWrap.appendChild(msg);
  row.appendChild(avatar);
  row.appendChild(bubbleWrap);
  return row;
}

function shouldDisplayMessage(message = {}) {
  const role = normalizeMessageRole(message);
  return role === 'user' || role === 'assistant';
}

export function createMessageShell({ mountEl } = {}) {
  let mountedSessionKey = null;
  let pendingMessages = [];
  let lastCanonicalMessages = [];
  let activeAssistantStream = null;

  function ensureMount() {
    return mountEl || null;
  }

  function reset(sessionKey = null) {
    mountedSessionKey = sessionKey || null;
    pendingMessages = [];
    lastCanonicalMessages = [];
    activeAssistantStream = null;
    const target = ensureMount();
    if (target) {target.innerHTML = '';}
  }

  function findPendingRow(localId) {
    const target = ensureMount();
    if (!target || !localId) {return null;}
    return target.querySelector(`.msg-row.user[data-pending-id="${CSS.escape(String(localId))}"]`);
  }

  function addCanonicalRow(message = {}) {
    if (!shouldDisplayMessage(message)) {return;}
    const target = ensureMount();
    if (!target) {return;}
    const bubbleRole = roleForRow(message);
    const extraClass = message?.role === 'assistant' && message?.status === 'streaming' ? 'stream' : '';
    const row = createMessageRow(bubbleRole, message?.text || '', {
      status: message?.status || null,
      runId: message?.runId || message?.id || null,
      messageRole: normalizeMessageRole(message) || null,
      extraClass,
    });
    target.appendChild(row);
  }

  function appendPendingUserMessage(sessionKey, text = '', options = {}) {
    const target = ensureMount();
    if (!target || !sessionKey || mountedSessionKey !== sessionKey || !text) {return null;}
    const localId = options.localId || `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (!pendingMessages.some(item => item.localId === localId)) {
      pendingMessages.push({ localId, text, sessionKey, state: options.state || 'pending' });
    }
    const row = createMessageRow('user', text, {
      status: options.state || 'pending',
      localId,
      messageRole: 'user',
      extraClass: options.state === 'failed' ? 'failed' : 'pending',
    });
    target.appendChild(row);
    return localId;
  }

  function markPendingFailed(sessionKey, localId) {
    if (!sessionKey || !localId) {return;}
    pendingMessages = pendingMessages.map(item => item.localId === localId && item.sessionKey === sessionKey ? { ...item, state: 'failed' } : item);
    const row = findPendingRow(localId);
    if (!row) {
      if (mountedSessionKey === sessionKey) {
        renderCanonicalHistory(sessionKey, lastCanonicalMessages);
      }
      return;
    }
    row.dataset.status = 'failed';
    const meta = row.querySelector('.msg-meta.user');
    if (meta) {meta.textContent = `Xin · ${formatStamp()} · failed`;}
    const msg = row.querySelector('.msg.user');
    if (msg) {
      msg.classList.remove('pending');
      msg.classList.add('failed');
    }
  }

  function absorbPendingMessages(messages = []) {
    if (!mountedSessionKey || !Array.isArray(messages) || !pendingMessages.length) {return { absorbedIds: [], remaining: pendingMessages };}
    const canonicalUserTexts = new Set(
      messages
        .filter(item => normalizeMessageRole(item) === 'user')
        .map(item => String(item?.text || '')),
    );
    const remaining = [];
    const absorbedIds = [];
    for (const pending of pendingMessages) {
      if (pending.sessionKey !== mountedSessionKey) {
        remaining.push(pending);
        continue;
      }
      if (pending.text && canonicalUserTexts.has(String(pending.text))) {
        const row = findPendingRow(pending.localId);
        row?.remove();
        absorbedIds.push(pending.localId);
        continue;
      }
      remaining.push(pending);
    }
    pendingMessages = remaining;
    return { absorbedIds, remaining };
  }

  function clearActiveStreamRows() {
    const target = ensureMount();
    if (!target) {return;}
    for (const row of target.querySelectorAll('.msg-row.assistant[data-stream-run-id]')) {
      row.remove();
    }
    activeAssistantStream = null;
  }

  function getOrCreateActiveStreamRow(sessionKey, runId = null) {
    const target = ensureMount();
    if (!target || !sessionKey || mountedSessionKey !== sessionKey) {return null;}
    const effectiveRunId = runId || activeAssistantStream?.runId || 'active';
    let row = target.querySelector(`.msg-row.assistant[data-stream-run-id="${CSS.escape(String(effectiveRunId))}"]`);
    if (!row) {
      row = createMessageRow('assistant', '', {
        status: 'streaming',
        streamRunId: effectiveRunId,
        messageRole: 'stream',
        extraClass: 'stream',
      });
      target.appendChild(row);
    }
    const msg = row.querySelector('.msg.assistant');
    const meta = row.querySelector('.msg-meta.assistant');
    return { row, msg, meta, runId: effectiveRunId };
  }

  function renderCanonicalHistory(sessionKey, messages = []) {
    const target = ensureMount();
    if (!target) {return { absorbedIds: [], pendingMessages };}
    const sourceMessages = Array.isArray(messages) ? messages : [];
    mountedSessionKey = sessionKey || null;
    lastCanonicalMessages = sourceMessages;
    target.innerHTML = '';
    clearActiveStreamRows();
    for (const message of sourceMessages) {
      addCanonicalRow(message);
    }
    const absorbResult = absorbPendingMessages(sourceMessages);
    const remainingPending = pendingMessages.filter(item => item.sessionKey === sessionKey);
    for (const pending of remainingPending) {
      const row = createMessageRow('user', pending.text || '', {
        status: pending.state || 'pending',
        localId: pending.localId,
        messageRole: 'user',
        extraClass: pending.state === 'failed' ? 'failed' : 'pending',
      });
      target.appendChild(row);
      if (pending.state === 'failed') {
        markPendingFailed(sessionKey, pending.localId);
      }
    }
    return {
      absorbedIds: absorbResult?.absorbedIds || [],
      pendingMessages,
    };
  }

  function reconcileHistory(sessionKey, messages = []) {
    if (!sessionKey) {return { absorbedIds: [], pendingMessages };}
    if (mountedSessionKey !== sessionKey) {
      mountedSessionKey = sessionKey;
    }
    return renderCanonicalHistory(sessionKey, messages);
  }

  function mountSession(sessionKey, messages = []) {
    renderCanonicalHistory(sessionKey, messages);
  }

  function send(sessionKey, text = '') {
    if (!sessionKey || !text) {return null;}
    if (mountedSessionKey !== sessionKey) {
      mountSession(sessionKey, []);
    }
    return appendPendingUserMessage(sessionKey, text, { state: 'pending' });
  }

  function handleAck(sessionKey, runId = null) {
    if (!sessionKey || mountedSessionKey !== sessionKey) {return false;}
    activeAssistantStream = {
      runId: runId || activeAssistantStream?.runId || null,
      text: activeAssistantStream?.text || '',
      state: 'streaming',
    };
    return true;
  }

  function handleDelta(sessionKey, runIdOrText = null, maybeText = null) {
    if (!sessionKey || mountedSessionKey !== sessionKey) {return false;}
    const runId = typeof maybeText === 'string' ? runIdOrText : null;
    const text = typeof maybeText === 'string' ? maybeText : runIdOrText;
    const stream = getOrCreateActiveStreamRow(sessionKey, runId || null);
    if (!stream?.msg) {return false;}
    activeAssistantStream = {
      runId: stream.runId,
      text: String(text || ''),
      state: 'streaming',
    };
    stream.row.dataset.status = 'streaming';
    if (stream.meta) {stream.meta.textContent = `Vio · ${formatStamp()} · streaming`;}
    stream.msg.textContent = String(text || '');
    return true;
  }

  function handleFinal(sessionKey, runId = null) {
    if (!sessionKey || mountedSessionKey !== sessionKey) {return false;}
    if (activeAssistantStream && (!runId || activeAssistantStream.runId === runId)) {
      activeAssistantStream = {
        ...activeAssistantStream,
        state: 'finalizing',
      };
    }
    const stream = getOrCreateActiveStreamRow(sessionKey, runId || null);
    if (stream?.row) {stream.row.dataset.status = 'finalizing';}
    if (stream?.meta) {stream.meta.textContent = `Vio · ${formatStamp()} · finalizing`;}
    return true;
  }

  function snapshotActiveStream() {
    if (!activeAssistantStream) {return null;}
    return {
      runId: activeAssistantStream.runId || null,
      text: String(activeAssistantStream.text || ''),
      state: activeAssistantStream.state || null,
    };
  }

  function getMountedSessionKey() {
    return mountedSessionKey;
  }

  function getDebugState() {
    return {
      mountedSessionKey,
      pendingMessages,
      lastCanonicalMessages,
      activeAssistantStream,
    };
  }

  return {
    mountSession,
    renderCanonicalHistory,
    reconcileHistory,
    reset,
    send,
    markPendingFailed,
    handleAck,
    handleDelta,
    handleFinal,
    snapshotActiveStream,
    getMountedSessionKey,
    getDebugState,
    hasPendingMessage(sessionKey, localId) {
      return pendingMessages.some(item => item.sessionKey === sessionKey && item.localId === localId);
    },
  };
}
