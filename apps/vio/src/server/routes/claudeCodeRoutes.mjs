import { readJsonRequest, sendJson } from '../httpUtils.mjs';

function matchClaudeCodeSessionRoute(pathname = '') {
  const match = pathname.match(/^\/api\/sessions\/([^/]+)\/claude-code(?:\/(start|input|stop))?$/);
  if (!match) {return null;}
  return {
    sessionKey: decodeURIComponent(match[1] || ''),
    action: match[2] || 'state',
  };
}

export function handleClaudeCodeRoutes({
  req,
  res,
  requestUrl,
  getClaudeCodeState,
  startClaudeCodeSession,
  sendClaudeCodeInput,
  stopClaudeCodeSession,
}) {
  const matched = matchClaudeCodeSessionRoute(requestUrl.pathname);
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

  return false;
}
