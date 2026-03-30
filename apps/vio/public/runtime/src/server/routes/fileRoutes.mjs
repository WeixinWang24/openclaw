import { readJsonRequest, sendJson } from '../httpUtils.mjs';

export function handleFileRoutes({ req, res, requestUrl, listProjectFiles, readProjectFile, writeProjectFile, safeProjectPath, openPath }) {
  if (requestUrl.pathname === '/api/files' && req.method === 'GET') {
    try {
      sendJson(res, 200, listProjectFiles(requestUrl.searchParams.get('dir') || '.'));
    } catch (error) {
      sendJson(res, 500, { error: error?.message || String(error) });
    }
    return true;
  }

  if (requestUrl.pathname === '/api/file' && req.method === 'GET') {
    try {
      sendJson(res, 200, readProjectFile(requestUrl.searchParams.get('path') || ''));
    } catch (error) {
      sendJson(res, 400, { error: error?.message || String(error) });
    }
    return true;
  }

  if (requestUrl.pathname === '/api/file' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => sendJson(res, 200, writeProjectFile(payload.path || '', typeof payload.content === 'string' ? payload.content : '')))
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/explorer/open' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const targetDir = safeProjectPath(typeof payload.dir === 'string' && payload.dir ? payload.dir : '.');
        openPath(targetDir, error => {
          if (error) {sendJson(res, 500, { error: error?.message || error?.code || 'open failed' });}
          else {sendJson(res, 200, { ok: true, dir: targetDir });}
        });
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  return false;
}
