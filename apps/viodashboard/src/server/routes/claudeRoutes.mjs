import { DEFAULT_CLAUDE_CWD } from '../../config.mjs';
import { readJsonRequest, sendJson } from '../httpUtils.mjs';

export function handleClaudeRoutes({ req, res, requestUrl, getClaudeState, startClaudeSession, sendClaudeInput, stopClaudeSession, restartClaudeSession, resizeClaudeSession }) {
  if (requestUrl.pathname === '/api/claude/state' && req.method === 'GET') {
    try {
      const cwdRel = requestUrl.searchParams.get('cwd') || DEFAULT_CLAUDE_CWD;
      sendJson(res, 200, getClaudeState({ cwdRel }));
    } catch (error) {
      sendJson(res, 400, { error: error?.message || String(error) });
    }
    return true;
  }

  if (requestUrl.pathname === '/api/claude/start' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const cwdRel = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : DEFAULT_CLAUDE_CWD;
        const state = startClaudeSession({ cwdRel });
        sendJson(res, 200, state);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/claude/input' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const text = String(payload?.text || '');
        if (!text.length) {throw new Error('text is required');}
        const cwdRel = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : DEFAULT_CLAUDE_CWD;
        const state = sendClaudeInput({ text, cwdRel, raw: !!payload?.raw });
        sendJson(res, 200, state);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/claude/stop' && req.method === 'POST') {
    readJsonRequest(req)
      .then(() => {
        sendJson(res, 200, stopClaudeSession());
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/claude/restart' && req.method === 'POST') {
    readJsonRequest(req)
      .then(async payload => {
        const cwdRel = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : DEFAULT_CLAUDE_CWD;
        const state = await restartClaudeSession({ cwdRel });
        sendJson(res, 200, state);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/claude/resize' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const state = resizeClaudeSession({ cols: payload?.cols, rows: payload?.rows });
        sendJson(res, 200, state);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  return false;
}
