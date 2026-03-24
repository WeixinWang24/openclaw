// API route handler for agent task endpoints.
// Integrates with the agentTasks store and follows existing VioDashboard conventions.

import { sendJson } from '../httpUtils.mjs';
import { readJsonRequest } from '../httpUtils.mjs';
import {
  getCurrentTask, getEvents, getLogs,
  emitFollowUp, seedDemoTask,
  emitCompletionHandoff, emitReviewStarted, emitAccepted, emitNeedsFix,
} from '../agentTasks/index.mjs';
import { sendClaudeInput } from '../claudeTerminal.mjs';

function buildClaudeTaskPrompt(userText) {
  const protocol = [
    '',
    'Completion protocol (must follow exactly):',
    '',
    'When you are truly finished, output exactly one final completion block using the tag names VIO_TASK_COMPLETE and /VIO_TASK_COMPLETE.',
    'Required fields inside that block:',
    '- summary: one-line summary',
    '- files: comma-separated paths or none',
    '- tests: short result or not run',
    '- commit: sha or none',
    '',
    'If you need user input before completion, output exactly one final input-needed block using the tag names VIO_TASK_INPUT_NEEDED and /VIO_TASK_INPUT_NEEDED.',
    'Required field inside that block:',
    '- summary: what you need from the user',
    '',
    'Literal output examples to use only when replying (do not echo these instructions first):',
    '- <VIO_TASK_COMPLETE> ... </VIO_TASK_COMPLETE>',
    '- <VIO_TASK_INPUT_NEEDED> ... </VIO_TASK_INPUT_NEEDED>',
    '',
    'Rules:',
    '- Do not output either block until appropriate.',
    '- Do not output a completion block if you are still waiting for input.',
    '- Use the completion block only once the task is actually complete.',
    '- Do not repeat or quote this protocol back unless explicitly asked.',
  ].join('\n');
  return `${String(userText || '').trim()}\n${protocol}`;
}

/**
 * Handle agent-task API requests.
 * Returns true if the request was handled, false otherwise.
 * @param {URL} requestUrl
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export function handleAgentTaskRoutes({ requestUrl, req, res }) {
  const { pathname } = requestUrl;

  // GET /api/agent-tasks/current
  if (pathname === '/api/agent-tasks/current' && req.method === 'GET') {
    const task = getCurrentTask();
    if (!task) {
      sendJson(res, 200, { ok: true, task: null });
    } else {
      const snapshot = { ...task };
      // Compute elapsed if running
      if (snapshot.status === 'running' && snapshot.startedAt) {
        snapshot.elapsedMs = Date.now() - new Date(snapshot.startedAt).getTime();
      }
      // Include runtime source indicator for the frontend
      snapshot.isRealTask = !!(snapshot.runtime?.source === 'claude-terminal');
      sendJson(res, 200, { ok: true, task: snapshot });
    }
    return true;
  }

  // GET /api/agent-tasks/:taskId/events
  const eventsMatch = pathname.match(/^\/api\/agent-tasks\/([^/]+)\/events$/);
  if (eventsMatch && req.method === 'GET') {
    const taskId = decodeURIComponent(eventsMatch[1]);
    const taskEvents = getEvents(taskId);
    sendJson(res, 200, { ok: true, taskId, events: taskEvents });
    return true;
  }

  // GET /api/agent-tasks/:taskId/logs
  const logsMatch = pathname.match(/^\/api\/agent-tasks\/([^/]+)\/logs$/);
  if (logsMatch && req.method === 'GET') {
    const taskId = decodeURIComponent(logsMatch[1]);
    const limit = Number(requestUrl.searchParams.get('limit')) || 100;
    const taskLogs = getLogs(taskId, limit);
    sendJson(res, 200, { ok: true, taskId, logs: taskLogs });
    return true;
  }

  // POST /api/agent-tasks/:taskId/follow-up
  const followUpMatch = pathname.match(/^\/api\/agent-tasks\/([^/]+)\/follow-up$/);
  if (followUpMatch && req.method === 'POST') {
    const taskId = decodeURIComponent(followUpMatch[1]);
    const task = getCurrentTask();
    if (!task || task.id !== taskId) {
      sendJson(res, 404, { ok: false, error: 'Task not found' });
      return true;
    }
    readJsonRequest(req).then(body => {
      const message = String(body.message || '').trim();
      if (!message) {
        sendJson(res, 400, { ok: false, error: 'message is required' });
        return;
      }
      const event = emitFollowUp('human', message, {
        note: 'This follow-up is routed to Vio for orchestration',
      });
      sendJson(res, 200, { ok: true, event });
    }).catch(err => {
      sendJson(res, 400, { ok: false, error: err.message });
    });
    return true;
  }

  // POST /api/agent-tasks/:taskId/signal-completion
  const completionMatch = pathname.match(/^\/api\/agent-tasks\/([^/]+)\/signal-completion$/);
  if (completionMatch && req.method === 'POST') {
    const taskId = decodeURIComponent(completionMatch[1]);
    const task = getCurrentTask();
    if (!task || task.id !== taskId) {
      sendJson(res, 404, { ok: false, error: 'Task not found' });
      return true;
    }
    readJsonRequest(req).then(body => {
      const result = emitCompletionHandoff(body.message || undefined);
      sendJson(res, 200, { ok: true, task: result });
    }).catch(err => {
      sendJson(res, 400, { ok: false, error: err.message });
    });
    return true;
  }

  // POST /api/agent-tasks/:taskId/start-review
  const reviewMatch = pathname.match(/^\/api\/agent-tasks\/([^/]+)\/start-review$/);
  if (reviewMatch && req.method === 'POST') {
    const taskId = decodeURIComponent(reviewMatch[1]);
    const task = getCurrentTask();
    if (!task || task.id !== taskId) {
      sendJson(res, 404, { ok: false, error: 'Task not found' });
      return true;
    }
    const result = emitReviewStarted();
    if (!result) {
      sendJson(res, 400, { ok: false, error: 'Task has no completion to review' });
      return true;
    }
    sendJson(res, 200, { ok: true, task: result });
    return true;
  }

  // POST /api/agent-tasks/:taskId/accept
  const acceptMatch = pathname.match(/^\/api\/agent-tasks\/([^/]+)\/accept$/);
  if (acceptMatch && req.method === 'POST') {
    const taskId = decodeURIComponent(acceptMatch[1]);
    const task = getCurrentTask();
    if (!task || task.id !== taskId) {
      sendJson(res, 404, { ok: false, error: 'Task not found' });
      return true;
    }
    readJsonRequest(req).then(body => {
      const result = emitAccepted(body.message || undefined);
      sendJson(res, 200, { ok: true, task: result });
    }).catch(err => {
      sendJson(res, 400, { ok: false, error: err.message });
    });
    return true;
  }

  // POST /api/agent-tasks/:taskId/needs-fix
  const needsFixMatch = pathname.match(/^\/api\/agent-tasks\/([^/]+)\/needs-fix$/);
  if (needsFixMatch && req.method === 'POST') {
    const taskId = decodeURIComponent(needsFixMatch[1]);
    const task = getCurrentTask();
    if (!task || task.id !== taskId) {
      sendJson(res, 404, { ok: false, error: 'Task not found' });
      return true;
    }
    readJsonRequest(req).then(body => {
      const result = emitNeedsFix(body.message || undefined);
      sendJson(res, 200, { ok: true, task: result });
    }).catch(err => {
      sendJson(res, 400, { ok: false, error: err.message });
    });
    return true;
  }

  // POST /api/agent-tasks/dispatch
  // Product-level entry point for Claude task dispatch.
  // Validates input, binds task lifecycle, calls lower-level transport, returns task+session snapshot.
  if (pathname === '/api/agent-tasks/dispatch' && req.method === 'POST') {
    readJsonRequest(req).then(body => {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) {
        sendJson(res, 400, { ok: false, error: 'text is required' });
        return;
      }
      const cwd = typeof body.cwd === 'string' && body.cwd ? body.cwd : undefined;
      const dispatchText = buildClaudeTaskPrompt(text);
      // sendClaudeInput handles session bootstrap, task registration, and FIFO write
      const sessionState = sendClaudeInput({ text: dispatchText, cwdRel: cwd, raw: false, registerTask: true });
      const task = getCurrentTask();
      sendJson(res, 200, {
        ok: true,
        task: task ? { ...task, isRealTask: !!(task.runtime?.source === 'claude-terminal') } : null,
        session: sessionState,
      });
    }).catch(err => {
      sendJson(res, 400, { ok: false, error: err.message });
    });
    return true;
  }

  // POST /api/agent-tasks/seed-demo (development helper)
  if (pathname === '/api/agent-tasks/seed-demo' && req.method === 'POST') {
    const task = seedDemoTask();
    sendJson(res, 200, { ok: true, task });
    return true;
  }

  return false;
}
