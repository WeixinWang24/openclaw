import { KERNEL_CHANNELS } from './kernelEventBus.mjs';

function stripReplyTagHeader(text = '') {
  return String(text || '').replace(/^\s*\[\[\s*reply_to_current\s*\]\]\s*/i, '').trimStart();
}

function stripCliSenderEnvelope(text = '') {
  return String(text || '')
    .replace(/^Sender \(untrusted metadata\):\s*```json[\s\S]*?```\s*/i, '')
    .replace(/^\[[^\]\n]*\]\s*/m, '')
    .trimStart();
}

function sanitizeTranscriptText(text = '') {
  return stripCliSenderEnvelope(stripReplyTagHeader(text));
}

function collapseContinuePromptForDisplay(text = '', role = '') {
  const source = String(text || '').trim();
  if (role !== 'user') {return source;}
  if (/^继续上一条 assistant 回复里最后明确提出的事情。/u.test(source)) {
    return '继续';
  }
  return source;
}

function parseMessageText(message) {
  if (!message || typeof message !== 'object') {return '';}
  const role = normalizeVisibleRole(message?.role || 'assistant') || '';
  if (typeof message.text === 'string') {return collapseContinuePromptForDisplay(sanitizeTranscriptText(message.text), role);}
  if (typeof message.content === 'string') {return collapseContinuePromptForDisplay(sanitizeTranscriptText(message.content), role);}
  if (Array.isArray(message.content)) {
    return collapseContinuePromptForDisplay(
      sanitizeTranscriptText(
        message.content
          .map(part => {
            if (typeof part?.text === 'string') {return part.text;}
            if (typeof part?.outputText === 'string') {return part.outputText;}
            if (typeof part?.output === 'string') {return part.output;}
            return '';
          })
          .filter(Boolean)
          .join('\n'),
      ),
      role,
    );
  }
  return '';
}

function normalizeVisibleRole(role = '') {
  const normalized = String(role || '').trim();
  if (normalized === 'user' || normalized === 'assistant' || normalized === 'system') {
    return normalized;
  }
  return null;
}

function normalizeHistoryMessage(message, index, sessionKey) {
  const role = normalizeVisibleRole(message?.role || 'assistant');
  if (!role) {return null;}
  const text = String(parseMessageText(message) || '').trim();
  if (!text) {return null;}
  return {
    id: message?.id || `${sessionKey}:${index}`,
    role,
    text,
    createdAt: message?.createdAt || message?.ts || null,
    raw: undefined,
  };
}

export function createTranscriptService({ rpcClient, eventBus, diagnostics }) {
  const cache = new Map();
  const inflight = new Map();
  const CACHE_TTL_MS = 5000;

  async function fetchHistory(sessionKey, { limit = 40, force = false } = {}) {
    if (!sessionKey) {throw new Error('sessionKey is required');}
    const requestedLimit = Math.max(1, Number(limit) || 40);
    const cacheKey = `${sessionKey}:${requestedLimit}`;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (!force && cached && (now - cached.cachedAt) < CACHE_TTL_MS) {
      diagnostics?.recordHistoryFetch({
        sessionKey,
        requestedLimit,
        overfetchLimit: requestedLimit,
        sourceCount: cached.messages.length,
        visibleCount: cached.messages.length,
        rpcDurationMs: 0,
        normalizeDurationMs: 0,
        totalDurationMs: 0,
        cache: 'hit',
      });
      return cached.messages;
    }
    if (!force && inflight.has(cacheKey)) {
      diagnostics?.recordHistoryFetch({
        sessionKey,
        requestedLimit,
        overfetchLimit: requestedLimit,
        sourceCount: 0,
        visibleCount: 0,
        rpcDurationMs: 0,
        normalizeDurationMs: 0,
        totalDurationMs: 0,
        cache: 'join-inflight',
      });
      return await inflight.get(cacheKey);
    }

    const job = (async () => {
      const startedAt = Date.now();
      const overfetchLimit = Math.min(Math.max(requestedLimit * 2, requestedLimit + 12), 80);
      const rpcStartedAt = Date.now();
      const result = await rpcClient.call('sessions.get', {
        key: sessionKey,
        limit: overfetchLimit,
      });
      const rpcDurationMs = Date.now() - rpcStartedAt;
      const messages = Array.isArray(result?.messages) ? result.messages : [];
      const normalizeStartedAt = Date.now();
      const normalized = messages
        .map((message, index) => normalizeHistoryMessage(message, index, sessionKey))
        .filter(Boolean)
        .slice(-requestedLimit);
      const normalizeDurationMs = Date.now() - normalizeStartedAt;
      cache.set(cacheKey, {
        sessionKey,
        limit: requestedLimit,
        cachedAt: Date.now(),
        updatedAt: new Date().toISOString(),
        messages: normalized,
      });
      diagnostics?.recordHistoryFetch({
        sessionKey,
        requestedLimit,
        overfetchLimit,
        sourceCount: messages.length,
        visibleCount: normalized.length,
        rpcDurationMs,
        normalizeDurationMs,
        totalDurationMs: Date.now() - startedAt,
        cache: 'miss',
      });
      eventBus?.emit(KERNEL_CHANNELS.TRANSCRIPT, {
        type: 'transcript.refreshed',
        sessionKey,
        messages: normalized,
        ts: Date.now(),
      });
      return normalized;
    })();

    inflight.set(cacheKey, job);
    try {
      return await job;
    } finally {
      inflight.delete(cacheKey);
    }
  }

  return {
    fetchHistory,
    refreshHistory: async (sessionKey, opts = {}) => await fetchHistory(sessionKey, { ...opts, force: true }),
    getCachedHistory: (sessionKey, limit = 40) => cache.get(`${sessionKey}:${Math.max(1, Number(limit) || 40)}`)?.messages || [],
    invalidateHistory: sessionKey => {
      for (const key of cache.keys()) {
        if (key.startsWith(`${sessionKey}:`)) {cache.delete(key);}
      }
      for (const key of inflight.keys()) {
        if (key.startsWith(`${sessionKey}:`)) {inflight.delete(key);}
      }
    },
  };
}
