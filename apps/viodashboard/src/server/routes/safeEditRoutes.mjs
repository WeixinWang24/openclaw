import { sendJson } from '../httpUtils.mjs';

export function handleSafeEditRoutes({ req, res, requestUrl, getSafeEditState, startupRecovery, runSafeEditSmokeSummary }) {
  if (requestUrl.pathname === '/api/safe-edit/state' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      ...getSafeEditState(),
      startupRecovery,
      smoke: runSafeEditSmokeSummary(),
    });
    return true;
  }

  return false;
}
