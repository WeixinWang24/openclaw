import fs from 'node:fs';
import path from 'node:path';
import { readJsonRequest, sendJson } from '../httpUtils.mjs';

export function handleRuntimeControlRoutes({ req, res, requestUrl, root, launchdLabel, bridge, broadcast, broadcastHub, restartWrapper, restartGateway }) {
  if (requestUrl.pathname === '/api/run-mode' && req.method === 'GET') {
    try {
      const modeFile = path.join(root, 'launchd', '.run-mode');
      const mode = fs.existsSync(modeFile) ? fs.readFileSync(modeFile, 'utf8').trim() || 'source' : 'source';
      sendJson(res, 200, { ok: true, mode });
    } catch (error) {
      sendJson(res, 500, { error: error?.message || String(error) });
    }
    return true;
  }

  if (requestUrl.pathname === '/api/run-mode' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const mode = payload?.mode === 'runtime' ? 'runtime' : 'source';
        sendJson(res, 202, { ok: true, mode, switching: true });
        setTimeout(() => {
          restartWrapper?.({ mode });
        }, 120);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/wrapper/restart' && req.method === 'POST') {
    readJsonRequest(req)
      .then(() => {
        sendJson(res, 202, { ok: true, restarting: true, target: 'wrapper' });
        setTimeout(() => {
          restartWrapper?.({ mode: null, launchdLabel });
        }, 120);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/context/compact' && req.method === 'POST') {
    readJsonRequest(req)
      .then(async payload => {
        const sessionKey = typeof payload?.sessionKey === 'string' ? payload.sessionKey : bridge.sessionKey;
        const result = await bridge.compactSession(sessionKey);
        broadcast({ type: 'context.compacted', sessionKey, result });
        sendJson(res, 200, { ok: true, sessionKey, result });
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/debug/ws-tail' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, items: broadcastHub.getTail(100) });
    return true;
  }

  if (requestUrl.pathname === '/api/gateway/restart' && req.method === 'POST') {
    readJsonRequest(req)
      .then(() => {
        sendJson(res, 202, { ok: true, restarting: true, target: 'gateway' });
        setTimeout(() => {
          restartGateway?.();
        }, 120);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  return false;
}
