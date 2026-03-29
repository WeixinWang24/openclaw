import { sendJson } from '../httpUtils.mjs';

export function handleSessionRoutes({ req, res, requestUrl, rpcClient, sessionRegistry, defaultSessionKey = null }) {
  if (requestUrl.pathname === '/api/sessions' && req.method === 'GET') {
    rpcClient.call('sessions.list', { limit: Number(requestUrl.searchParams.get('limit') || 50) || 50 })
      .then(result => {
        const items = Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : [];
        sessionRegistry?.replaceSessions?.(items);
        sendJson(res, 200, {
          ok: true,
          currentSessionKey: defaultSessionKey,
          items,
        });
      })
      .catch(error => sendJson(res, 500, { ok: false, error: error?.message || String(error) }));
    return true;
  }

  return false;
}
