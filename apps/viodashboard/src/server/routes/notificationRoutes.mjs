import { readJsonRequest, sendJson } from '../httpUtils.mjs';

export function handleNotificationRoutes({ req, res, requestUrl, getNotificationPrefs, setNotificationPrefs }) {
  if (requestUrl.pathname === '/api/notification-prefs') {
    if (req.method === 'GET') {
      sendJson(res, 200, getNotificationPrefs());
      return true;
    }
    if (req.method === 'POST' || req.method === 'PATCH') {
      readJsonRequest(req)
        .then(body => sendJson(res, 200, setNotificationPrefs(body)))
        .catch(err => sendJson(res, 400, { error: err?.message || String(err) }));
      return true;
    }
  }

  return false;
}
