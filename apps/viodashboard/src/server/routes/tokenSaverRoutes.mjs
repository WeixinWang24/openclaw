import fs from 'node:fs';
import { DEBUG_DIR } from '../../config.mjs';
import { readJsonRequest, sendJson } from '../httpUtils.mjs';

export function handleTokenSaverRoutes({ req, res, requestUrl, bridge, broadcast }) {
  if (requestUrl.pathname === '/api/coms/token-saver' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, tokenSaver: bridge.getTokenSaverSnapshot() });
    return true;
  }

  if (requestUrl.pathname === '/api/coms/token-saver' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const tokenSaver = bridge.setTokenSaverConfig({
          ...(typeof payload?.enabled === 'boolean' ? { enabled: payload.enabled } : {}),
          ...(typeof payload?.phase1Summary === 'boolean' ? { phase1Summary: payload.phase1Summary } : {}),
          ...(typeof payload?.phase2ToolCompression === 'boolean' ? { phase2ToolCompression: payload.phase2ToolCompression } : {}),
        });
        broadcast?.({ type: 'token-saver', tokenSaver });
        sendJson(res, 200, { ok: true, tokenSaver });
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/coms/token-saver/stats' && req.method === 'GET') {
    const snapshot = bridge.getTokenSaverSnapshot();
    sendJson(res, 200, {
      ok: true,
      stats: snapshot?.stats || null,
      lastSend: snapshot?.lastSend || null,
      memory: snapshot?.memory || { summary: '', turnCount: 0, recentTurns: [] },
      lastAssistantFinal: snapshot?.lastAssistantFinal || null,
    });
    return true;
  }

  if (requestUrl.pathname === '/api/coms/token-saver/runs' && req.method === 'GET') {
    try {
      const debugDir = DEBUG_DIR;
      const indexPath = `${debugDir}/run-index.json`;
      const items = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
      sendJson(res, 200, { ok: true, items: Array.isArray(items) ? items : [] });
    } catch (error) {
      sendJson(res, 500, { error: error?.message || String(error) });
    }
    return true;
  }

  if (requestUrl.pathname === '/api/coms/token-saver/run' && req.method === 'GET') {
    try {
      const runId = String(requestUrl.searchParams.get('runId') || '').trim();
      if (!runId) {throw new Error('runId is required');}
      const debugDir = DEBUG_DIR;
      const runDir = `${debugDir}/${runId}`;
      const readJson = name => {
        const p = `${runDir}/${name}.json`;
        return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
      };
      sendJson(res, 200, {
        ok: true,
        runId,
        before: readJson('before'),
        after: readJson('after'),
        diffSummary: readJson('diff-summary'),
      });
    } catch (error) {
      sendJson(res, 400, { error: error?.message || String(error) });
    }
    return true;
  }

  return false;
}
