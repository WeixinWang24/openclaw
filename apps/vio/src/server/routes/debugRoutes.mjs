import { readJsonRequest, sendJson } from '../httpUtils.mjs';

export function handleDebugRoutes({ req, res, requestUrl, messageDebugSink }) {
  if (requestUrl.pathname === '/api/debug/message-event' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const event = payload?.event && typeof payload.event === 'object' ? payload.event : payload;
        if (!event || typeof event !== 'object') {
          sendJson(res, 400, { error: 'event payload is required' });
          return;
        }
        if (!String(event?.event || '').trim()) {
          sendJson(res, 400, { error: 'event name is required' });
          return;
        }
        const result = messageDebugSink.append(event);
        sendJson(res, 200, result);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  return false;
}
