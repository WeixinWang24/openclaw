import { sendJson } from '../httpUtils.mjs';

export function handleSessionRoutes({ req, res, requestUrl, rpcClient, sessionRegistry, defaultSessionKey = null, eventBridge = null }) {
  if (requestUrl.pathname === '/api/sessions' && req.method === 'GET') {
    rpcClient.call('sessions.list', { limit: Number(requestUrl.searchParams.get('limit') || 50) || 50 })
      .then(result => {
        const items = Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result?.sessions)
            ? result.sessions
            : Array.isArray(result)
              ? result
              : [];
        sessionRegistry?.replaceSessions?.(items);
        for (const item of items.slice(0, 12)) {
          eventBridge?.subscribeSession?.(item?.key).catch?.(() => {});
        }
        sendJson(res, 200, {
          ok: true,
          currentSessionKey: defaultSessionKey,
          items,
          source: Array.isArray(result?.sessions) ? 'sessions.list.sessions' : 'sessions.list.items',
        });
      })
      .catch(error => sendJson(res, 500, { ok: false, error: error?.message || String(error) }));
    return true;
  }

  return false;
}
