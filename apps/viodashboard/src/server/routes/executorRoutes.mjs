import { sendJson } from '../httpUtils.mjs';
import { listExecutors } from '../executors/registry.mjs';

export function handleExecutorRoutes({ req, res, requestUrl }) {
  if (requestUrl.pathname === '/api/executors' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      items: listExecutors(),
    });
    return true;
  }

  return false;
}
