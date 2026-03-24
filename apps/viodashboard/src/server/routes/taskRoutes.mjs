import { readJsonRequest, sendJson } from '../httpUtils.mjs';

export function handleTaskRoutes({ req, res, requestUrl, bridge, broadcast }) {
  if (requestUrl.pathname === '/api/tasks/deploy' && req.method === 'POST') {
    readJsonRequest(req)
      .then(async payload => {
        const task = payload?.task && typeof payload.task === 'object' ? payload.task : {};
        const title = String(task.title || task.text || '').trim();
        if (!title) {throw new Error('task title is required');}
        const description = String(task.description || '').trim();
        const priority = String(task.priority || 'normal');
        const status = String(task.status || 'todo');
        const source = String(task.source || 'task-board');
        const lines = [
          'Deployed task from telemetry Task Board:',
          `Title: ${title}`,
          `Priority: ${priority}`,
          `Status: ${status}`,
          `Source: ${source}`,
        ];
        if (description) {lines.push(`Description: ${description}`);}
        lines.push('', 'Please continue by working on this task or proposing the immediate next concrete action.');
        const message = lines.join('\n');
        const dryRun = !!payload?.dryRun;
        if (dryRun) {
          sendJson(res, 200, { ok: true, dryRun: true, runId: null, message });
          return;
        }
        const runId = await bridge.sendChat(message);
        broadcast({ type: 'task.deploy', task: { ...task, title, description, priority, status, source }, runId });
        sendJson(res, 200, { ok: true, dryRun: false, runId, message });
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  if (requestUrl.pathname === '/api/tasks/deploy-batch' && req.method === 'POST') {
    readJsonRequest(req)
      .then(async payload => {
        const tasks = Array.isArray(payload?.tasks) ? payload.tasks.filter(task => task && typeof task === 'object') : [];
        if (tasks.length < 2) {throw new Error('at least two tasks are required for batch deploy');}
        const normalizedTasks = tasks.map((task, index) => {
          const title = String(task.title || task.text || '').trim();
          if (!title) {throw new Error(`task ${index + 1} title is required`);}
          return {
            ...task,
            title,
            description: String(task.description || '').trim(),
            priority: String(task.priority || 'normal'),
            status: String(task.status || 'todo'),
            source: String(task.source || 'task-board'),
          };
        });
        const batchId = String(payload?.batchId || `batch-${Date.now()}`);
        const deployedAt = new Date().toISOString();
        const lines = [
          'Batch deployed tasks from telemetry Task Board:',
          `Batch ID: ${batchId}`,
          `Task Count: ${normalizedTasks.length}`,
          '',
          'Treat each task as a separate entity. Do not merge them. Work through them as a coordinated batch and call out immediate next actions per task.',
          '',
          'Tasks:',
        ];
        for (const [index, task] of normalizedTasks.entries()) {
          lines.push(`${index + 1}. Title: ${task.title}`);
          lines.push(`   Priority: ${task.priority}`);
          lines.push(`   Status: ${task.status}`);
          lines.push(`   Source: ${task.source}`);
          if (task.description) {lines.push(`   Description: ${task.description}`);}
          if (task.roadmapItemId) {lines.push(`   Roadmap Item ID: ${task.roadmapItemId}`);}
          if (task.id) {lines.push(`   Task ID: ${task.id}`);}
        }
        lines.push('', 'Please continue by working on this batch while preserving separate task identities, reporting progress per task, and proposing the immediate next concrete action for the batch.');
        const message = lines.join('\n');
        const dryRun = !!payload?.dryRun;
        if (dryRun) {
          sendJson(res, 200, { ok: true, dryRun: true, runId: null, batchId, deployedAt, message, tasks: normalizedTasks });
          return;
        }
        const runId = await bridge.sendChat(message);
        broadcast({ type: 'task.batch_deploy', batchId, deployedAt, tasks: normalizedTasks, runId });
        sendJson(res, 200, { ok: true, dryRun: false, runId, batchId, deployedAt, message, tasks: normalizedTasks });
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return true;
  }

  return false;
}
