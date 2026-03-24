import { sendJson } from '../httpUtils.mjs';

export function handleDiagnosticsRoutes({ req, res, requestUrl, bridge, runtimeDiagnostics, sessionRegistry, chatProjection, broadcastHub }) {
  if (requestUrl.pathname === '/api/diagnostics/runtime' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      bridgeConnected: bridge.connected,
      currentSessionKey: bridge.sessionKey,
      diagnostics: runtimeDiagnostics.getSnapshot(),
      sessions: sessionRegistry.listSessions(),
      broadcast: {
        clientCount: broadcastHub?.getClientCount?.() || 0,
        tail: broadcastHub?.getTail?.(20) || [],
      },
    });
    return true;
  }

  const viewMatch = requestUrl.pathname.match(/^\/api\/diagnostics\/sessions\/([^/]+)\/view$/);
  if (viewMatch && req.method === 'GET') {
    const sessionKey = decodeURIComponent(viewMatch[1]);
    const fullView = chatProjection.getSessionView(sessionKey);
    const trimmedView = {
      ...fullView,
      messages: Array.isArray(fullView?.messages) ? fullView.messages.slice(-20) : [],
    };
    sendJson(res, 200, {
      ok: true,
      sessionKey,
      activeRuns: sessionRegistry.getActiveRuns(sessionKey),
      view: trimmedView,
    });
    return true;
  }

  return false;
}
