import { readJsonRequest, sendJson } from '../httpUtils.mjs';

export function handleChatRoutes({ req, res, requestUrl, chatRuntime, transcriptService, chatProjection }) {
  const historyMatch = requestUrl.pathname.match(/^\/api\/sessions\/([^/]+)\/history$/);
  if (historyMatch && req.method === 'GET') {
    const sessionKey = decodeURIComponent(historyMatch[1]);
    const limit = Number(requestUrl.searchParams.get('limit') || 40) || 40;
    const refresh = String(requestUrl.searchParams.get('refresh') || '').toLowerCase() === 'true';
    const view = chatProjection.getSessionView(sessionKey);
    const projectedMessages = Array.isArray(view?.messages)
      ? view.messages
        .filter(item => item?.role === 'user' || item?.role === 'assistant' || item?.role === 'system')
        .map(item => ({
          id: item.id,
          role: item.role,
          text: item.text,
          createdAt: item.createdAt || null,
        }))
        .slice(-limit)
      : [];
    const cachedMessages = typeof transcriptService.getCachedHistory === 'function'
      ? transcriptService.getCachedHistory(sessionKey, limit)
      : [];
    const immediateMessages = Array.isArray(cachedMessages) && cachedMessages.length ? cachedMessages : projectedMessages;

    if (!refresh && immediateMessages.length) {
      sendJson(res, 200, {
        ok: true,
        sessionKey,
        messages: immediateMessages,
        view,
        source: cachedMessages.length ? 'cache' : 'projection',
        deferred: true,
      });
      transcriptService.fetchHistory(sessionKey, { limit })
        .catch(() => {});
      return true;
    }

    transcriptService.fetchHistory(sessionKey, { limit, force: refresh })
      .then(messages => sendJson(res, 200, {
        ok: true,
        sessionKey,
        messages,
        view: chatProjection.getSessionView(sessionKey),
        source: 'history',
        deferred: false,
      }))
      .catch(error => sendJson(res, 500, { ok: false, error: error?.message || String(error) }));
    return true;
  }

  const sendMatch = requestUrl.pathname.match(/^\/api\/sessions\/([^/]+)\/send$/);
  if (sendMatch && req.method === 'POST') {
    const sessionKey = decodeURIComponent(sendMatch[1]);
    readJsonRequest(req)
      .then(body => chatRuntime.send({
        sessionKey,
        message: String(body?.text || ''),
        deliver: false,
      }))
      .then(result => sendJson(res, 200, {
        ok: true,
        ...result,
        view: chatProjection.getSessionView(sessionKey),
      }))
      .catch(error => sendJson(res, 400, { ok: false, error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/chat/abort' && req.method === 'POST') {
    readJsonRequest(req)
      .then(body => chatRuntime.abort({
        sessionKey: body?.sessionKey ? String(body.sessionKey) : undefined,
        runId: body?.runId ? String(body.runId) : undefined,
      }))
      .then(() => sendJson(res, 200, { ok: true }))
      .catch(error => sendJson(res, 400, { ok: false, error: error?.message || String(error) }));
    return true;
  }

  return false;
}
