function formatStamp() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text = '') {
  return String(text || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function renderInlineChatMarkdown(text = '') {
  return escapeHtml(String(text || ''))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a class="chat-link" href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderChatMarkdown(text = '') {
  const source = String(text || '').replace(/\r\n?/g, '\n');
  const parts = [];
  const fencedRe = /```([a-zA-Z0-9_-]+)?[ \t]*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = fencedRe.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: source.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'code',
      lang: String(match[1] || '').trim(),
      value: String(match[2] || ''),
    });
    lastIndex = fencedRe.lastIndex;
  }

  if (lastIndex < source.length) {
    parts.push({ type: 'text', value: source.slice(lastIndex) });
  }

  const out = [];
  for (const part of parts) {
    if (part.type === 'code') {
      const langAttr = part.lang ? ` data-lang="${escapeHtml(part.lang)}"` : '';
      out.push(`<pre class="chat-code-block"${langAttr}><code>${escapeHtml(part.value)}</code></pre>`);
      continue;
    }

    const lines = String(part.value || '').split('\n');
    let listType = null;

    const closeList = () => {
      if (!listType) {return;}
      out.push(listType === 'ol' ? '</ol>' : '</ul>');
      listType = null;
    };

    for (const rawLine of lines) {
      const line = String(rawLine || '');
      const trimmed = line.trim();
      const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);

      if (bullet || numbered) {
        const nextListType = numbered ? 'ol' : 'ul';
        if (listType !== nextListType) {
          closeList();
          out.push(nextListType === 'ol' ? '<ol class="chat-md-list">' : '<ul class="chat-md-list">');
          listType = nextListType;
        }
        out.push(`<li>${renderInlineChatMarkdown((bullet || numbered)[1])}</li>`);
        continue;
      }

      closeList();

      if (!trimmed) {
        out.push('<div class="chat-md-space"></div>');
      } else {
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = Math.min(3, headingMatch[1].length);
          out.push(`<div class="chat-md-h${level}">${renderInlineChatMarkdown(headingMatch[2])}</div>`);
        } else if (/^>\s+/.test(trimmed)) {
          out.push(`<div class="chat-md-quote">${renderInlineChatMarkdown(trimmed.replace(/^>\s+/, ''))}</div>`);
        } else {
          out.push(`<div class="chat-md-p">${renderInlineChatMarkdown(line)}</div>`);
        }
      }
    }

    closeList();
  }

  return out.join('');
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

function avatarLabel(role) {
  return role === 'user' ? 'X' : role === 'assistant' ? 'V' : '•';
}

function avatarImageSrc(role) {
  if (role === 'user') {return '/avatars/Xin.JPEG';}
  if (role === 'assistant') {return '/avatars/vio.png';}
  return null;
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
  const avatarSrc = (role === 'user' || role === 'assistant') ? avatarImageSrc(role) : null;
  if (avatarSrc) {
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.alt = role === 'user' ? 'Xin avatar' : 'Vio avatar';
    img.addEventListener('error', () => {
      img.remove();
      avatar.textContent = avatarLabel(role);
    });
    img.src = `${avatarSrc}?v=1`;
    avatar.appendChild(img);
  } else {
    avatar.textContent = avatarLabel(role);
  }

  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-wrap';

  const meta = document.createElement('div');
  meta.className = `msg-meta ${role}`.trim();
  meta.textContent = `${role === 'user' ? 'Xin' : 'Vio'} · ${formatStamp()}${status ? ` · ${String(status)}` : ''}`;

  const msg = document.createElement('div');
  msg.className = `msg ${role} ${extraClass}`.trim();
  msg.innerHTML = renderChatMarkdown(text || '');

  bubbleWrap.appendChild(meta);
  bubbleWrap.appendChild(msg);
  row.appendChild(avatar);
  row.appendChild(bubbleWrap);
  return row;
}

const DEFAULT_VISIBLE_HISTORY = 7;

function shouldDisplayMessage(message = {}) {
  const role = normalizeMessageRole(message);
  return role === 'user' || role === 'assistant';
}

function normalizeComparableUserText(text = '') {
  return String(text || '')
    .replace(/^\s*\[\[\s*reply_to_current\s*\]\]\s*/i, '')
    .replace(/^Sender \(untrusted metadata\):\s*```json[\s\S]*?```\s*/i, '')
    .replace(/^\[[^\]\n]*\]\s*/m, '')
    .trim();
}

export function createMessageShell({ mountEl, debug = null, historyWindow = DEFAULT_VISIBLE_HISTORY } = {}) {
  let mountedSessionKey = null;
  let visibleHistoryWindow = Number.isFinite(historyWindow) ? historyWindow : DEFAULT_VISIBLE_HISTORY;
  let pendingMessages = [];
  let lastCanonicalMessages = [];
  let activeAssistantStream = null;
  let runtimeRunHint = null;

  function emitDebug(event, payload = {}) {
    void debug?.emit?.({
      area: 'message-shell',
      event,
      mountedSessionKey,
      payload,
    });
  }

  function ensureMount() {
    return mountEl || null;
  }

  function scrollToBottom() {
    const target = ensureMount();
    if (!target) {return;}
    requestAnimationFrame(() => {
      target.scrollTop = target.scrollHeight;
    });
  }

  function reset(sessionKey = null) {
    mountedSessionKey = sessionKey || null;
    pendingMessages = [];
    lastCanonicalMessages = [];
    activeAssistantStream = null;
    const target = ensureMount();
    if (target) {
      target.innerHTML = '';
      scrollToBottom();
    }
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
    const localId = options?.localId || `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    emitDebug('pending.append', {
      sessionKey,
      localId,
      textLength: String(text || '').length,
      state: options.state || 'pending',
    });
    scrollToBottom();
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
        .map(item => normalizeComparableUserText(item?.text || ''))
        .filter(Boolean),
    );
    const latestCanonicalUserText = [...messages]
      .toReversed()
      .find(item => normalizeMessageRole(item) === 'user')?.text || '';
    const latestCanonicalComparable = normalizeComparableUserText(latestCanonicalUserText);
    const remaining = [];
    const absorbedIds = [];
    for (const pending of pendingMessages) {
      if (pending.sessionKey !== mountedSessionKey) {
        remaining.push(pending);
        continue;
      }
      const pendingComparable = normalizeComparableUserText(pending.text || '');
      const shouldAbsorb = !!pendingComparable && (
        canonicalUserTexts.has(pendingComparable)
        || latestCanonicalComparable === pendingComparable
      );
      if (shouldAbsorb) {
        const row = findPendingRow(pending.localId);
        row?.remove();
        absorbedIds.push(pending.localId);
        emitDebug('pending.absorb', {
          sessionKey: mountedSessionKey,
          localId: pending.localId,
        });
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

  function clearRuntimeHintRows() {
    const target = ensureMount();
    if (!target) {return;}
    for (const row of target.querySelectorAll('.msg-row.assistant[data-runtime-hint="true"]')) {
      row.remove();
    }
    runtimeRunHint = null;
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
    const visibleMessages = sourceMessages.filter(shouldDisplayMessage).slice(-visibleHistoryWindow);
    mountedSessionKey = sessionKey || null;
    emitDebug('mount.render-history', {
      sessionKey,
      messageCount: sourceMessages.length,
      visibleCount: visibleMessages.length,
    });
    lastCanonicalMessages = sourceMessages;
    if (activeAssistantStream) {
      const hasMatchingAssistant = sourceMessages.some(message => {
        const role = normalizeMessageRole(message);
        const runId = message?.runId || message?.id || null;
        return role === 'assistant' && (!activeAssistantStream.runId || runId === activeAssistantStream.runId || String(message?.text || '') === String(activeAssistantStream.text || ''));
      });
      if (hasMatchingAssistant) {
        activeAssistantStream = null;
      }
    }
    target.innerHTML = '';
    clearActiveStreamRows();
    clearRuntimeHintRows();
    for (const message of visibleMessages) {
      addCanonicalRow(message);
    }
    const absorbResult = absorbPendingMessages(sourceMessages);
    const remainingPending = pendingMessages.filter(item => item.sessionKey === sessionKey);
    if (remainingPending.length) {
      emitDebug('pending.preserved', {
        sessionKey,
        count: remainingPending.length,
        localIds: remainingPending.map(item => item.localId),
      });
    }
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
    scrollToBottom();
    return {
      absorbedIds: absorbResult?.absorbedIds || [],
      pendingMessages,
    };
  }

  function reconcileHistory(sessionKey, messages = []) {
    if (!sessionKey) {return { absorbedIds: [], pendingMessages };}
    emitDebug('reconcile.start', {
      sessionKey,
      messageCount: Array.isArray(messages) ? messages.length : 0,
    });
    if (mountedSessionKey !== sessionKey) {
      mountedSessionKey = sessionKey;
    }
    if (activeAssistantStream?.state === 'streaming' && hasStreamingRowMounted(sessionKey, activeAssistantStream?.runId || null)) {
      emitDebug('reconcile.skip', {
        sessionKey,
        why: 'active-streaming-row-mounted',
      });
      return { absorbedIds: [], pendingMessages };
    }
    if (!activeAssistantStream) {
      const target = ensureMount();
      const hasCommittedFinalRow = !!target?.querySelector('.msg-row.assistant[data-status="final"][data-run-id]');
      const sourceMessages = Array.isArray(messages) ? messages : [];
      const canonicalHasMatchingAssistant = sourceMessages.some(message => normalizeMessageRole(message) === 'assistant');
      if (hasCommittedFinalRow && !canonicalHasMatchingAssistant) {
        emitDebug('reconcile.skip', {
          sessionKey,
          why: 'final-row-without-canonical-assistant',
        });
        return { absorbedIds: [], pendingMessages };
      }
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
    stream.msg.innerHTML = renderChatMarkdown(String(text || ''));
    scrollToBottom();
    return true;
  }

  function commitActiveStreamToHistory(sessionKey, runId = null) {
    const target = ensureMount();
    if (!target || !sessionKey || mountedSessionKey !== sessionKey || !activeAssistantStream) {return false;}
    const effectiveRunId = runId || activeAssistantStream.runId || null;
    const streamRow = effectiveRunId
      ? target.querySelector(`.msg-row.assistant[data-stream-run-id="${CSS.escape(String(effectiveRunId))}"]`)
      : target.querySelector('.msg-row.assistant[data-stream-run-id]');
    if (!streamRow) {return false;}

    streamRow.removeAttribute('data-stream-run-id');
    streamRow.dataset.status = 'final';
    streamRow.dataset.messageRole = 'assistant';
    if (effectiveRunId) {streamRow.dataset.runId = String(effectiveRunId);}
    const meta = streamRow.querySelector('.msg-meta.assistant');
    if (meta) {meta.textContent = `Vio · ${formatStamp()}`;}
    const msg = streamRow.querySelector('.msg.assistant');
    if (msg) {
      msg.classList.remove('stream');
      msg.innerHTML = renderChatMarkdown(String(activeAssistantStream.text || ''));
    }
    activeAssistantStream = null;
    scrollToBottom();
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
    commitActiveStreamToHistory(sessionKey, runId || null);
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

  function setRuntimeRunHint(sessionKey, { runId = null, status = null, text = '' } = {}) {
    if (!sessionKey || mountedSessionKey !== sessionKey) {return false;}
    const target = ensureMount();
    if (!target) {return false;}
    clearRuntimeHintRows();
    if (!status) {return false;}
    const normalizedStatus = String(status).toLowerCase();
    if (!['started', 'acknowledged', 'streaming', 'finalizing', 'final'].includes(normalizedStatus)) {
      return false;
    }
    const hasAssistantCanonical = lastCanonicalMessages.some(message => normalizeMessageRole(message) === 'assistant');
    if (normalizedStatus === 'final' && hasAssistantCanonical) {
      return false;
    }
    runtimeRunHint = { runId, status: normalizedStatus, text: String(text || '') };
    const label = normalizedStatus === 'acknowledged'
      ? 'thinking…'
      : normalizedStatus === 'final'
        ? 'finalizing…'
        : `${normalizedStatus}…`;
    const row = createMessageRow('assistant', runtimeRunHint.text || label, {
      status: normalizedStatus,
      streamRunId: runId || 'runtime-hint',
      messageRole: 'runtime-hint',
      extraClass: 'stream',
    });
    row.dataset.runtimeHint = 'true';
    target.appendChild(row);
    return true;
  }

  function clearRuntimeRunHint(sessionKey = null) {
    if (sessionKey && mountedSessionKey !== sessionKey) {return false;}
    clearRuntimeHintRows();
    return true;
  }

  function hasStreamingRowMounted(sessionKey, runId = null) {
    const target = ensureMount();
    if (!target || mountedSessionKey !== sessionKey) {return false;}
    if (runId) {
      return !!target.querySelector(`.msg-row.assistant[data-stream-run-id="${CSS.escape(String(runId))}"][data-status="streaming"]`);
    }
    return !!target.querySelector('.msg-row.assistant[data-status="streaming"]');
  }

  function setHistoryWindow(nextWindow) {
    const parsed = Number(nextWindow);
    if (!Number.isFinite(parsed) || parsed < 1) {return visibleHistoryWindow;}
    visibleHistoryWindow = parsed;
    if (mountedSessionKey) {
      renderCanonicalHistory(mountedSessionKey, lastCanonicalMessages);
    }
    return visibleHistoryWindow;
  }

  function getHistoryWindow() {
    return visibleHistoryWindow;
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
      runtimeRunHint,
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
    setRuntimeRunHint,
    clearRuntimeRunHint,
    setHistoryWindow,
    getHistoryWindow,
    getMountedSessionKey,
    getDebugState,
    hasStreamingRowMounted,
    hasPendingMessage(sessionKey, localId) {
      return pendingMessages.some(item => item.sessionKey === sessionKey && item.localId === localId);
    },
  };
}

export { renderSessionListView } from './session-list-view.js';
export { renderSessionStatus } from './session-status-view.js';
