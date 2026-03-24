import { readJsonRequest, sendJson } from '../httpUtils.mjs';

export function handleDistRoutes({ req, res, requestUrl, loadDistBuildInfo, rebuildDist }) {
  if (requestUrl.pathname === '/api/dist-info' && req.method === 'GET') {
    const info = loadDistBuildInfo();
    sendJson(res, 200, { ok: true, info });
    return true;
  }

  if (requestUrl.pathname === '/api/dist-rebuild' && req.method === 'POST') {
    readJsonRequest(req)
      .then(() => {
        sendJson(res, 202, { ok: true, rebuilding: true });
        setTimeout(() => {
          rebuildDist?.();
        }, 120);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  return false;
}
