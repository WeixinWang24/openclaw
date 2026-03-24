import { readJsonRequest, sendJson } from '../httpUtils.mjs';

export function handleRoadmapRoutes({ req, res, requestUrl, roadmapStateService, broadcast }) {
  if (requestUrl.pathname === '/api/roadmap' && req.method === 'GET') {
    const roadmap = roadmapStateService.loadRoadmapData();
    sendJson(res, 200, { ok: true, roadmap });
    return true;
  }

  if (requestUrl.pathname === '/api/roadmap/history' && req.method === 'GET') {
    const items = roadmapStateService.loadRoadmapHistory();
    sendJson(res, 200, { ok: true, items });
    return true;
  }

  if (requestUrl.pathname === '/api/roadmap/history/clear' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        if (payload?.confirm !== true) {throw new Error('confirm=true is required to clear roadmap history');}
        roadmapStateService.saveRoadmapHistory([]);
        broadcast?.({ type: 'roadmap.history.cleared' });
        sendJson(res, 200, { ok: true, cleared: true, count: 0 });
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  return false;
}
