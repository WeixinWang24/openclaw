// API route handler for agent task endpoints.
// Integrates with the agentTasks store and follows existing VioDashboard conventions.

import { sendJson } from '../httpUtils.mjs';
import { readJsonRequest } from '../httpUtils.mjs';
import {
  getCurrentTask, getEvents, getLogs,
  emitFollowUp, seedDemoTask,
} from '../agentTasks/index.mjs';

/**
 * Handle agent-task API requests.
 * Returns true if the request was handled, false otherwise.
 * @param {URL} requestUrl
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export function handleAgentTaskRoutes(requestUrl, req, res) {
  const { pathname } = requestUrl;

  // GET /api/agent-tasks/current
  if (pathname === '/api/agent-tasks/current' && req.method === 'GET') {
    const task = getCurrentTask();
    if (!task) {
      sendJson(res, 200, { ok: true, task: null });
    } else {
      // Compute elapsed if running
      const snapshot = { ...task };
      if (snapshot.status === 'running' && snapshot.startedAt) {
        snapshot.elapsedMs = Date.now() - new Date(snapshot.startedAt).getTime();
      }
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

  // POST /api/agent-tasks/seed-demo (development helper)
  if (pathname === '/api/agent-tasks/seed-demo' && req.method === 'POST') {
    const task = seedDemoTask();
    sendJson(res, 200, { ok: true, task });
    return true;
  }

  return false;
}
