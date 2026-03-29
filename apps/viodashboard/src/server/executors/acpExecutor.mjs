import { dispatchAcpStubTask } from './acpRuntimeBridge.mjs';

export function createAcpExecutor() {
  return {
    id: 'acp-task',
    label: 'ACP Task',
    enabled: true,
    available: true,
    capabilities: {
      task: true,
      directTerminalBacked: false,
      review: false,
      artifacts: false,
      followUp: false,
      visibleOnly: true,
      acp: true,
    },

    async dispatchTask(spec = {}) {
      const text = typeof spec?.text === 'string' ? spec.text.trim() : '';
      if (!text) {
        const error = new Error('text is required');
        error.code = 'INVALID_DISPATCH_PAYLOAD';
        error.statusCode = 400;
        throw error;
      }
      return dispatchAcpStubTask(spec);
    },
  };
}
