import { readJsonRequest, sendJson } from '../httpUtils.mjs';

function buildTerminalResponse(session) {
  return {
    ok: true,
    sessionId: session.id,
    cwd: session.cwdRel,
    output: session.output,
    exited: session.exited,
    exitCode: session.exitCode,
    status: session.status,
    terminationRequestedAt: session.terminationRequestedAt,
    terminatedAt: session.terminatedAt,
    terminationError: session.terminationError,
  };
}

export function handleTerminalRoutes({ req, res, requestUrl, getOrCreateTerminalSession, getTerminalSession, ingestToolResult }) {
  if (requestUrl.pathname === '/api/terminal/session' && req.method === 'GET') {
    const session = getOrCreateTerminalSession('default', requestUrl.searchParams.get('cwd') || '.');
    sendJson(res, 200, buildTerminalResponse(session));
    return true;
  }

  if (requestUrl.pathname === '/api/terminal/input' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const session = getOrCreateTerminalSession(String(payload.sessionId || 'default'), typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : '.');
        const text = String(payload.text || '');
        session.child.stdin.write(text);
        setTimeout(() => {
          const toolLabel = `terminal ${session.cwdRel || '.'} $ ${text.trim() || '<empty>'}`;
          ingestToolResult(toolLabel, session.output || '', { sessionId: session.id, cwdRel: session.cwdRel });
          sendJson(res, 200, buildTerminalResponse(session));
        }, 120);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/terminal/terminate' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const sessionId = String(payload?.sessionId || 'default');
        const session = getTerminalSession(sessionId);
        if (!session) {throw new Error(`terminal session not found: ${sessionId}`);}
        if (session.exited || !session.child || session.child.killed) {
          session.status = session.status === 'terminated' ? 'terminated' : 'exited';
          sendJson(res, 200, buildTerminalResponse(session));
          return;
        }
        session.status = 'terminating';
        session.terminationRequestedAt = new Date().toISOString();
        session.terminationError = null;
        try {
          session.child.kill('SIGTERM');
        } catch (error) {
          session.status = 'failed';
          session.terminationError = error?.message || String(error);
        }
        setTimeout(() => {
          if (!session.exited && session.child && !session.child.killed) {
            try {
              session.child.kill('SIGKILL');
            } catch (error) {
              session.status = 'failed';
              session.terminationError = error?.message || String(error);
            }
          }
          if (session.exited && session.status === 'terminating') {
            session.status = 'terminated';
            session.terminatedAt = session.terminatedAt || new Date().toISOString();
          }
          sendJson(res, 200, {
            ...buildTerminalResponse(session),
            ok: !session.terminationError,
          });
        }, 120);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  return false;
}
