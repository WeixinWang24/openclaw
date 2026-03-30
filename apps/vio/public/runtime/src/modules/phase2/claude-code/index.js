export function createClaudeCodeModuleSpec() {
  return {
    id: 'claude-code',
    status: 'active',
    owns: [
      'Claude Code interaction surface inside the Code workspace page',
      'Claude Code session-attached control boundary',
      'Claude Code output/status display boundary',
      'Claude Code UI-to-runtime action bridge',
    ],
  };
}

export { createClaudeCodeController } from './controller.js';
