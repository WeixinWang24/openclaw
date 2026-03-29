const executors = new Map();

function normalizeExecutorRecord(id, executor = {}) {
  return {
    id,
    label: executor?.label || id,
    enabled: executor?.enabled !== false,
    available: executor?.available !== false,
    capabilities: executor?.capabilities || {},
    dispatchTask: executor?.dispatchTask,
    getState: executor?.getState,
    sendFollowUp: executor?.sendFollowUp,
    abort: executor?.abort,
    collectArtifacts: executor?.collectArtifacts,
  };
}

export function registerExecutor(id, executor) {
  if (!id || typeof id !== 'string') {
    throw new Error('executor id is required');
  }
  if (!executor || typeof executor.dispatchTask !== 'function') {
    throw new Error(`executor ${id} must implement dispatchTask()`);
  }
  const record = normalizeExecutorRecord(id, executor);
  executors.set(id, record);
  return record;
}

export function unregisterExecutor(id) {
  executors.delete(id);
}

export function getExecutor(id) {
  return executors.get(id) || null;
}

export function listExecutors() {
  return [...executors.values()].map(item => ({
    id: item.id,
    label: item.label,
    enabled: item.enabled,
    available: item.available,
    capabilities: item.capabilities || {},
  }));
}

export async function dispatchTask(spec = {}) {
  const executorId = typeof spec.executor === 'string' && spec.executor
    ? spec.executor
    : 'claude-task';

  const executor = getExecutor(executorId);
  if (!executor) {
    const error = new Error(`unknown executor: ${executorId}`);
    error.code = 'EXECUTOR_NOT_FOUND';
    throw error;
  }
  if (executor.enabled === false) {
    const error = new Error(`executor disabled: ${executorId}`);
    error.code = 'EXECUTOR_DISABLED';
    throw error;
  }
  return await executor.dispatchTask(spec);
}
