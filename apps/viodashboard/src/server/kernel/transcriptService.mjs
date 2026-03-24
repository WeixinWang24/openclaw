import { KERNEL_CHANNELS } from './kernelEventBus.mjs';

function parseMessageText(message) {
  if (!message || typeof message !== 'object') {return '';}
  if (typeof message.text === 'string') {return message.text;}
  if (typeof message.content === 'string') {return message.content;}
  if (Array.isArray(message.content)) {
    return message.content
      .map(part => {
        if (typeof part?.text === 'string') {return part.text;}
        if (typeof part?.outputText === 'string') {return part.outputText;}
        if (typeof part?.output === 'string') {return part.output;}
        return '';
      })
      .filter(Boolean)
      .join('\n');
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

function clampText(text = '', maxChars = 4000) {
  const source = String(text || '');
  if (source.length <= maxChars) {return source;}
  return `${source.slice(0, maxChars)}\n\n[truncated ${source.length - maxChars} chars]`;
}

function normalizeHistoryMessage(message, index, sessionKey) {
  const role = normalizeVisibleRole(message?.role || 'assistant');
  if (!role) {return null;}
  const text = clampText(parseMessageText(message), 4000).trim();
  if (!text) {return null;}
  return {
    id: message?.id || `${sessionKey}:${index}`,
    role,
    text,
    createdAt: message?.createdAt || message?.ts || null,
    raw: undefined,
  };
}

export function createTranscriptService({ rpcClient, eventBus }) {
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
      return cached.messages;
    }
    if (!force && inflight.has(cacheKey)) {
      return await inflight.get(cacheKey);
    }

    const job = (async () => {
      const overfetchLimit = Math.min(Math.max(requestedLimit * 6, requestedLimit), 240);
      const result = await rpcClient.call('sessions.get', {
        key: sessionKey,
        limit: overfetchLimit,
      });
      const messages = Array.isArray(result?.messages) ? result.messages : [];
      const normalized = messages
        .map((message, index) => normalizeHistoryMessage(message, index, sessionKey))
        .filter(Boolean)
        .slice(-requestedLimit);
      cache.set(cacheKey, {
        sessionKey,
        limit: requestedLimit,
        cachedAt: Date.now(),
        updatedAt: new Date().toISOString(),
        messages: normalized,
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
