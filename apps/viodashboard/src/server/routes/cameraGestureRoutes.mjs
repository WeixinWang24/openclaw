import { readJsonRequest, sendJson } from '../httpUtils.mjs';

function sendTemporarilyOffline(res, feature, extra = {}) {
  sendJson(res, 503, {
    ok: false,
    offline: true,
    feature,
    error: `${feature} routes are temporarily offline during server route migration`,
    ...extra,
  });
}

export function handleCameraGestureRoutes({ req, res, requestUrl }) {
  if (requestUrl.pathname === '/api/camera' && req.method === 'GET') {
    sendTemporarilyOffline(res, 'camera');
    return true;
  }

  if (requestUrl.pathname === '/api/vio-body-state' && req.method === 'GET') {
    sendTemporarilyOffline(res, 'vio-body-state');
    return true;
  }

  if (requestUrl.pathname === '/api/camera/capture' && req.method === 'POST') {
    sendTemporarilyOffline(res, 'camera-capture');
    return true;
  }

  if (requestUrl.pathname === '/api/camera/capture-step' && req.method === 'POST') {
    sendTemporarilyOffline(res, 'camera-capture-step');
    return true;
  }

  if (requestUrl.pathname === '/api/camera/recognize-step' && req.method === 'POST') {
    readJsonRequest(req)
      .then(() => sendTemporarilyOffline(res, 'camera-recognize-step'))
      .catch(error => sendJson(res, 400, { ok: false, error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/gesture/state' && req.method === 'GET') {
    sendTemporarilyOffline(res, 'gesture-state');
    return true;
  }

  if (requestUrl.pathname === '/api/gesture/watcher' && req.method === 'POST') {
    readJsonRequest(req)
      .then(() => sendTemporarilyOffline(res, 'gesture-watcher'))
      .catch(error => sendJson(res, 400, { ok: false, error: error?.message || String(error) }));
    return true;
  }

  return false;
}
