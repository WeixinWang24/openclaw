import { dispatchTask } from '../executors/registry.mjs';

export async function dispatchAgentTask(payload = {}) {
  const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
  if (!text) {
    const error = new Error('text is required');
    error.code = 'INVALID_DISPATCH_PAYLOAD';
    error.statusCode = 400;
    throw error;
  }

  const executor = typeof payload?.executor === 'string' && payload.executor
    ? payload.executor
    : 'claude-task';

  const cwd = typeof payload?.cwd === 'string' && payload.cwd
    ? payload.cwd
    : undefined;

  return await dispatchTask({
    executor,
    text,
    cwd,
    agent: typeof payload?.agent === 'string' && payload.agent ? payload.agent : undefined,
    sessionKey: typeof payload?.sessionKey === 'string' && payload.sessionKey ? payload.sessionKey : undefined,
    threadKey: typeof payload?.threadKey === 'string' && payload.threadKey ? payload.threadKey : undefined,
    meta: {
      source: 'api.agent-tasks.dispatch',
    },
  });
}
