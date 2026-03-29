import { sendJson } from '../httpUtils.mjs';

export function handleAcpRoutes({ req, res, requestUrl, bridge }) {
  if (requestUrl.pathname === '/api/acp/session-status' && req.method === 'GET') {
    const sessionKey = requestUrl.searchParams.get('sessionKey') || '';
    if (!sessionKey) {
      sendJson(res, 400, { ok: false, error: 'sessionKey is required' });
      return true;
    }

    Promise.allSettled([
      bridge?.listSessions ? bridge.listSessions({ limit: 200 }) : Promise.resolve([]),
      bridge?.fetchSessionHistory ? bridge.fetchSessionHistory(sessionKey, { limit: 20 }) : Promise.resolve([]),
    ]).then(([sessionsRes, historyRes]) => {
      const sessions = sessionsRes.status === 'fulfilled' ? (sessionsRes.value || []) : [];
      const history = historyRes.status === 'fulfilled' ? (historyRes.value || []) : [];
      const session = sessions.find(item => item?.key === sessionKey) || null;
      const assistantMessages = history.filter(message => message?.role === 'assistant' && String(message?.text || '').trim());
      const userMessages = history.filter(message => message?.role === 'user' && String(message?.text || '').trim());
      const lastAssistant = assistantMessages.at(-1) || null;
      const lastUser = userMessages.at(-1) || null;

      sendJson(res, 200, {
        ok: true,
        source: 'dashboard-acp-bridge',
        rpcMethod: null,
        note: 'No dedicated ACP gateway RPC method is currently wired in VioDashboard; this bridge synthesizes status from sessions.list + sessions.get history.',
        sessionKey,
        session,
        derivedStatus: {
          visible: !!session,
          isAcp: !!session?.isAcp || String(sessionKey).includes(':acp:'),
          messageCount: session?.messageCount ?? history.length,
          lastActiveAt: session?.lastActiveAt || session?.lastMessageAt || null,
          lastAssistantSummary: String(lastAssistant?.text || '').trim().slice(0, 240) || null,
          lastAssistantAt: lastAssistant?.createdAt || null,
          lastUserSummary: String(lastUser?.text || '').trim().slice(0, 240) || null,
          lastUserAt: lastUser?.createdAt || null,
          historyCount: history.length,
        },
        capabilities: {
          dispatchViaExecutor: true,
          historyBackedStatus: true,
          dedicatedAcpRpcDiscovered: false,
        },
      });
    }).catch(error => {
      sendJson(res, 500, {
        ok: false,
        error: error?.message || String(error),
      });
    });

    return true;
  }

  return false;
}
