import { readJsonRequest, sendJson } from '../httpUtils.mjs';

function matchClaudeCodeRoute(pathname = '') {
  const globalMatch = pathname.match(/^\/api\/claude(?:\/(state|start|input|stop|restart|resize|stream))?$/);
  if (globalMatch) {
    return {
      sessionKey: 'claude-default',
      action: globalMatch[1] || 'state',
    };
  }
  const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/claude-code(?:\/(start|input|stop|restart|resize))?$/);
  if (sessionMatch) {
    return {
      sessionKey: 'claude-default',
      action: sessionMatch[2] || 'state',
    };
  }
  return null;
}

export function handleClaudeCodeRoutes({
  req,
  res,
  requestUrl,
  getClaudeCodeState,
  startClaudeCodeSession,
  sendClaudeCodeInput,
  stopClaudeCodeSession,
  restartClaudeCodeSession,
  resizeClaudeCodeSession,
  readClaudeCodeStream,
}) {
  const matched = matchClaudeCodeRoute(requestUrl.pathname);
  if (!matched) {return false;}

  const { sessionKey, action } = matched;

  if (action === 'state' && req.method === 'GET') {
    try {
      sendJson(res, 200, getClaudeCodeState({
        sessionKey,
        cwdRel: requestUrl.searchParams.get('cwd') || '.',
      }));
    } catch (error) {
      sendJson(res, 400, { error: error?.message || String(error) });
    }
    return true;
  }

  if (action === 'stream' && req.method === 'GET') {
    try {
      sendJson(res, 200, readClaudeCodeStream({
        sessionKey,
        cwdRel: requestUrl.searchParams.get('cwd') || '.',
        offset: Number(requestUrl.searchParams.get('offset') || 0),
        maxBytes: Number(requestUrl.searchParams.get('maxBytes') || 16384),
      }));
    } catch (error) {
      sendJson(res, 400, { error: error?.message || String(error) });
    }
    return true;
  }

  if (action === 'start' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        sendJson(res, 200, startClaudeCodeSession({
          sessionKey,
          cwdRel: typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : '.',
        }));
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (action === 'input' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        sendJson(res, 200, sendClaudeCodeInput({
          sessionKey,
          text: String(payload?.text || ''),
          cwdRel: typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : '.',
          raw: !!payload?.raw,
        }));
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (action === 'stop' && req.method === 'POST') {
    readJsonRequest(req)
      .then(() => {
        sendJson(res, 200, stopClaudeCodeSession({ sessionKey }));
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (action === 'restart' && req.method === 'POST') {
    readJsonRequest(req)
      .then(async payload => {
        const result = await restartClaudeCodeSession({
          sessionKey,
          cwdRel: typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : '.',
        });
        sendJson(res, 200, result);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (action === 'resize' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        sendJson(res, 200, resizeClaudeCodeSession({
          sessionKey,
          cols: payload?.cols,
          rows: payload?.rows,
        }));
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  return false;
}
