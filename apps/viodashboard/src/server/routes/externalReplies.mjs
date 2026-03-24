import { readJsonRequest, sendJson } from '../httpUtils.mjs';
import { listExternalReplies, ingestExternalReply } from '../externalReplies/store.mjs';

export function handleExternalRepliesRoutes(requestUrl, req, res) {
  const { pathname } = requestUrl;

  if (pathname === '/api/external-replies/inbox' && req.method === 'GET') {
    try {
      const items = listExternalReplies();
      sendJson(res, 200, { ok: true, items });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error?.message || String(error) });
    }
    return true;
  }

  if (pathname === '/api/external-replies/ingest' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const result = ingestExternalReply(payload || {});
        sendJson(res, 200, { ok: true, ...result });
      })
      .catch(error => sendJson(res, 400, { ok: false, error: error?.message || String(error) }));
    return true;
  }

  return false;
}
