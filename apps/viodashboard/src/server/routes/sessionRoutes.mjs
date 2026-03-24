import { sendJson } from '../httpUtils.mjs';

export function handleSessionRoutes({ req, res, requestUrl, bridge, sessionRegistry }) {
  if (requestUrl.pathname === '/api/sessions' && req.method === 'GET') {
    bridge.listSessions({ limit: Number(requestUrl.searchParams.get('limit') || 50) || 50 })
      .then(items => {
        sessionRegistry?.replaceSessions?.(items);
        sendJson(res, 200, {
          ok: true,
          currentSessionKey: bridge.sessionKey,
          items,
        });
      })
      .catch(error => sendJson(res, 500, { ok: false, error: error?.message || String(error) }));
    return true;
  }

  const contextMatch = requestUrl.pathname.match(/^\/api\/sessions\/([^/]+)\/context$/);
  if (contextMatch && req.method === 'GET') {
    const sessionKey = decodeURIComponent(contextMatch[1]);
    bridge.fetchSessionContextSnapshot(sessionKey)
      .then(snapshot => sendJson(res, 200, {
        ok: true,
        sessionKey,
        contextSnapshot: snapshot,
        diagnosticContext: snapshot?.diagnosticContext || null,
        activeRuns: sessionRegistry?.getActiveRuns?.(sessionKey) || [],
      }))
      .catch(error => sendJson(res, 500, { ok: false, error: error?.message || String(error) }));
    return true;
  }

  return false;
}
