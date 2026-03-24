import { sendJson } from '../httpUtils.mjs';

export function handleMemoryRoutes({ req, res, requestUrl, listGuidelines, getGuidelinesDir }) {
  if (requestUrl.pathname === '/api/memory/guidelines' && req.method === 'GET') {
    try {
      const limit = Number(requestUrl.searchParams.get('limit') || 100);
      const items = listGuidelines({ limit });
      sendJson(res, 200, {
        ok: true,
        source: 'workspace-directory',
        dir: getGuidelinesDir(),
        items,
        count: items.length,
      });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error?.message || String(error) });
    }
    return true;
  }

  if (requestUrl.pathname === '/api/memory/guidelines' && req.method === 'POST') {
    sendJson(res, 405, {
      ok: false,
      error: 'guideline writes are not enabled yet; edit files under memory/permanent/guidelines directly',
      dir: getGuidelinesDir(),
    });
    return true;
  }

  return false;
}
