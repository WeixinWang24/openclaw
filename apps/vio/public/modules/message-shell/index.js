function formatStamp() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function createMessageRow(role, text, { status = null } = {}) {
  const row = document.createElement('div');
  row.className = `msg-row ${role}`.trim();
  if (status) {row.dataset.status = String(status);}

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

  function ensureMount() {
    return mountEl || null;
  }

  function reset(sessionKey = null) {
    mountedSessionKey = sessionKey || null;
    pendingMessages = [];
    lastCanonicalMessages = [];
    const target = ensureMount();
    if (target) {target.innerHTML = '';}
  }

  function absorbPendingMessages(sessionKey, messages = []) {
    const canonicalUserTexts = new Set(
      (Array.isArray(messages) ? messages : [])
        .filter(message => message?.role === 'user')
        .map(message => String(message?.text || '')),
    );
    pendingMessages = pendingMessages.filter(item => {
      if (item.sessionKey !== sessionKey) {return true;}
      return !canonicalUserTexts.has(String(item.text || ''));
    });
  }

  function renderCanonicalHistory(sessionKey, messages = []) {
    const target = ensureMount();
    if (!target) {return;}
    mountedSessionKey = sessionKey || null;
    target.innerHTML = '';
    const sourceMessages = Array.isArray(messages) ? messages : [];
    lastCanonicalMessages = sourceMessages;
    absorbPendingMessages(sessionKey, sourceMessages);
    for (const message of sourceMessages) {
      const role = message?.role === 'user' ? 'user' : 'assistant';
      target.appendChild(createMessageRow(role, message?.text || '', { status: message?.status || null }));
    }
    for (const pending of pendingMessages) {
      if (pending.sessionKey === sessionKey) {
        target.appendChild(createMessageRow('user', pending.text || '', { status: pending.state || 'pending' }));
      }
    }
  }

  function mountSession(sessionKey, messages = []) {
    renderCanonicalHistory(sessionKey, messages);
  }

  function reconcileHistory(sessionKey, messages = []) {
    renderCanonicalHistory(sessionKey, messages);
  }

  function send(sessionKey, text = '') {
    if (!sessionKey || !text) {return null;}
    if (mountedSessionKey !== sessionKey) {
      mountedSessionKey = sessionKey;
    }
    const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingMessages.push({ localId, text, sessionKey, state: 'pending' });
    const target = ensureMount();
    if (target && mountedSessionKey === sessionKey) {
      target.appendChild(createMessageRow('user', text, { status: 'pending' }));
    }
    return localId;
  }

  function markPendingFailed(sessionKey, localId) {
    pendingMessages = pendingMessages.map(item => item.localId === localId && item.sessionKey === sessionKey ? { ...item, state: 'failed' } : item);
    if (mountedSessionKey !== sessionKey) {return;}
    const target = ensureMount();
    if (!target) {return;}
    const sourceMessages = Array.isArray(lastCanonicalMessages) ? lastCanonicalMessages : [];
    target.innerHTML = '';
    for (const message of sourceMessages) {
      const role = message?.role === 'user' ? 'user' : 'assistant';
      target.appendChild(createMessageRow(role, message?.text || '', { status: message?.status || null }));
    }
    for (const pending of pendingMessages) {
      if (pending.sessionKey === sessionKey) {
        target.appendChild(createMessageRow('user', pending.text || '', { status: pending.state || 'pending' }));
      }
    }
  }

  function getMountedSessionKey() {
    return mountedSessionKey;
  }

  return {
    mountSession,
    reconcileHistory,
    reset,
    send,
    markPendingFailed,
    getMountedSessionKey,
  };
}
