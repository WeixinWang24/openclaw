import { readJsonRequest, sendJson } from '../httpUtils.mjs';

export function handleSetupRoutes({ req, res, requestUrl, bridgeConnected, getClaudeState, evaluateSetupState, handleSetupAction, restartService }) {
  if (requestUrl.pathname === '/api/setup/state' && req.method === 'GET') {
    const claudeState = getClaudeState();
    sendJson(res, 200, evaluateSetupState({ bridgeConnected, claudeState }));
    return true;
  }

  if (requestUrl.pathname === '/api/setup/action' && req.method === 'POST') {
    readJsonRequest(req)
      .then(async body => {
        const action = body && typeof body.action === 'string' ? body.action.trim() : '';
        if (!action) {
          sendJson(res, 400, { ok: false, error: 'missing "action" field' });
          return;
        }
        const result = await handleSetupAction({
          action,
          bridgeConnected,
          claudeState: getClaudeState(),
        });
        const shouldReload = result._reload === true;
        const { _reload: _, ...safeResult } = result;
        sendJson(res, shouldReload ? 202 : 200, safeResult);
        if (shouldReload) {
          setTimeout(() => {
            restartService?.();
          }, 120);
        }
      })
      .catch(error => sendJson(res, 400, { ok: false, error: error?.message || String(error) }));
    return true;
  }

  return false;
}
