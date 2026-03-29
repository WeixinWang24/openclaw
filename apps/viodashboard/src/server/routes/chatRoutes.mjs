import { readJsonRequest, sendJson } from '../httpUtils.mjs';

function buildHistoryViewMeta(view) {
  const runs = view && typeof view.runs === 'object' && view.runs
    ? Object.values(view.runs)
    : [];
  const activeRun = [...runs].toReversed().find(run => run && (run.status === 'started' || run.status === 'streaming')) || null;
  return {
    updatedAt: view?.updatedAt || null,
    activeRunId: activeRun?.runId || null,
    activeRunStatus: activeRun?.status || null,
    runs,
  };
}

export function handleChatRoutes({ req, res, requestUrl, chatRuntime, transcriptService, chatProjection }) {
  const historyMatch = requestUrl.pathname.match(/^\/api\/sessions\/([^/]+)\/history$/);
  if (historyMatch && req.method === 'GET') {
    const sessionKey = decodeURIComponent(historyMatch[1]);
    const limit = Number(requestUrl.searchParams.get('limit') || 40) || 40;
    const refresh = String(requestUrl.searchParams.get('refresh') || '').toLowerCase() === 'true';

    transcriptService.fetchHistory(sessionKey, { limit, force: refresh })
      .then(messages => {
        const view = chatProjection.getSessionView(sessionKey);
        sendJson(res, 200, {
          ok: true,
          sessionKey,
          messages,
          view,
          viewMeta: buildHistoryViewMeta(view),
          source: refresh ? 'history-refresh' : 'history',
          deferred: false,
        });
      })
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
