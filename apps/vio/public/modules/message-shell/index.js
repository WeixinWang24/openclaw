function formatStamp() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function roleForRow(message = {}) {
  return message?.role === 'user' ? 'user' : 'assistant';
}

function createMessageRow(role, text, { status = null, localId = null } = {}) {
  const row = document.createElement('div');
  row.className = `msg-row ${role}`.trim();
  if (status) {row.dataset.status = String(status);}
  if (localId) {row.dataset.pendingId = String(localId);}

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`.trim();
  avatar.textContent = role === 'user' ? 'X' : role === 'assistant' ? 'V' : '•';

  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-wrap';

  const meta = document.createElement('div');
  meta.className = `msg-meta ${role}`.trim();
  meta.textContent = `${role === 'user' ? 'Xin' : 'Vio'} · ${formatStamp()}${status ? ` · ${String(status)}` : ''}`;

  const msg = document.createElement('div');
  msg.className = `msg ${role}`.trim();
  msg.textContent = text || '';

  bubbleWrap.appendChild(meta);
  bubbleWrap.appendChild(msg);
  row.appendChild(avatar);
  row.appendChild(bubbleWrap);
  return row;
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

  function appendPendingUserMessage(sessionKey, text = '', options = {}) {
    const target = ensureMount();
    if (!target || !sessionKey || mountedSessionKey !== sessionKey || !text) {return null;}
    const localId = options.localId || `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (!pendingMessages.some(item => item.localId === localId)) {
      pendingMessages.push({ localId, text, sessionKey, state: 'pending' });
    }
    const row = createMessageRow('user', text, { status: options.state || 'pending', localId });
    target.appendChild(row);
    return localId;
  }

  function markPendingFailed(sessionKey, localId) {
    pendingMessages = pendingMessages.map(item => item.localId === localId && item.sessionKey === sessionKey ? { ...item, state: 'failed' } : item);
    if (mountedSessionKey === sessionKey) {
      renderCanonicalHistory(sessionKey, lastCanonicalMessages);
    }
  }

  function absorbPendingMessages(messages = []) {
    if (!mountedSessionKey || !Array.isArray(messages) || !pendingMessages.length) {return;}
    const canonicalUserTexts = new Set(messages.filter(item => item?.role === 'user').map(item => String(item?.text || '')));
    const remaining = [];
    for (const pending of pendingMessages) {
      if (pending.sessionKey !== mountedSessionKey) {
        remaining.push(pending);
        continue;
      }
      if (pending.text && canonicalUserTexts.has(String(pending.text))) {
        const row = findPendingRow(pending.localId);
        row?.remove();
        continue;
      }
      remaining.push(pending);
    }
    pendingMessages = remaining;
  }

  function clearActiveStreamRows() {
    const target = ensureMount();
    if (!target) {return;}
    for (const row of target.querySelectorAll('.msg-row.assistant[data-stream="true"]')) {
      row.remove();
    }
    activeAssistantStream = null;
  }

  function renderCanonicalHistory(sessionKey, messages = []) {
    const target = ensureMount();
    if (!target) {return;}
    const sourceMessages = Array.isArray(messages) ? messages : [];
    const preservedPending = pendingMessages.filter(item => item.sessionKey === sessionKey);
    mountedSessionKey = sessionKey || null;
    lastCanonicalMessages = sourceMessages;
    target.innerHTML = '';
    pendingMessages = preservedPending;
    clearActiveStreamRows();
    for (const message of sourceMessages) {
      target.appendChild(createMessageRow(roleForRow(message), message?.text || '', { status: message?.status || null }));
    }
    absorbPendingMessages(sourceMessages);
    for (const pending of pendingMessages) {
      if (pending.sessionKey === sessionKey) {
        appendPendingUserMessage(sessionKey, pending.text || '', { localId: pending.localId, state: pending.state || 'pending' });
        if (pending.state === 'failed') {
          const row = findPendingRow(pending.localId);
          if (row) {row.dataset.status = 'failed';}
        }
      }
    }
  }

  function reconcileHistory(sessionKey, messages = []) {
    if (!sessionKey) {return;}
    if (mountedSessionKey !== sessionKey) {
      mountedSessionKey = sessionKey;
    }
    absorbPendingMessages(messages);
    renderCanonicalHistory(sessionKey, messages);
  }

  function mountSession(sessionKey, messages = []) {
    renderCanonicalHistory(sessionKey, messages);
  }

  function getOrCreateActiveStreamRow() {
    const target = ensureMount();
    if (!target) {return null;}
    if (activeAssistantStream?.row?.isConnected) {
      return activeAssistantStream;
    }
    const row = createMessageRow('assistant', '', { status: 'streaming' });
    row.dataset.stream = 'true';
    target.appendChild(row);
    const msg = row.querySelector('.msg.assistant');
    const meta = row.querySelector('.msg-meta.assistant');
    activeAssistantStream = { row, msg, meta, text: '' };
    return activeAssistantStream;
  }

  function send(sessionKey, text = '') {
    if (!sessionKey || !text) {return null;}
    if (mountedSessionKey !== sessionKey) {
      mountedSessionKey = sessionKey;
    }
    return appendPendingUserMessage(sessionKey, text, { state: 'pending' });
  }

  function handleAck(sessionKey) {
    if (mountedSessionKey !== sessionKey) {return false;}
    const stream = getOrCreateActiveStreamRow();
    if (stream?.meta) {stream.meta.textContent = `Vio · ${formatStamp()} · streaming`;}
    return !!stream;
  }

  function handleDelta(sessionKey, text = '') {
    if (mountedSessionKey !== sessionKey) {return false;}
    const stream = getOrCreateActiveStreamRow();
    if (!stream?.msg) {return false;}
    stream.text = String(text || '');
    stream.msg.textContent = stream.text;
    if (stream.meta) {stream.meta.textContent = `Vio · ${formatStamp()} · streaming`;}
    return true;
  }

  function handleFinal(sessionKey) {
    if (mountedSessionKey !== sessionKey || !activeAssistantStream?.row?.isConnected) {return false;}
    if (activeAssistantStream.meta) {activeAssistantStream.meta.textContent = `Vio · ${formatStamp()} · final`;}
    activeAssistantStream.row.dataset.status = 'final';
    const finalText = String(activeAssistantStream.text || '').trim();
    if (finalText) {
      lastCanonicalMessages = [
        ...lastCanonicalMessages,
        { id: `stream-final-${Date.now()}`, role: 'assistant', text: finalText, status: 'final' },
      ];
      activeAssistantStream = null;
      renderCanonicalHistory(sessionKey, lastCanonicalMessages);
      return true;
    }
    return true;
  }

  function getMountedSessionKey() {
    return mountedSessionKey;
  }

  function getDebugState() {
    return {
      mountedSessionKey,
      pendingMessages,
      lastCanonicalMessages,
      activeAssistantStream: activeAssistantStream ? {
        text: activeAssistantStream.text,
        rowConnected: !!activeAssistantStream.row?.isConnected,
      } : null,
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
    getMountedSessionKey,
    getDebugState,
  };
}
