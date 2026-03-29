function buildClaudeTaskPrompt(userText = '') {
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

export function createClaudeTaskExecutor({ sendClaudeInput, getCurrentTask } = {}) {
  if (typeof sendClaudeInput !== 'function') {
    throw new Error('createClaudeTaskExecutor requires sendClaudeInput()');
  }
  if (typeof getCurrentTask !== 'function') {
    throw new Error('createClaudeTaskExecutor requires getCurrentTask()');
  }

  return {
    id: 'claude-task',
    label: 'Claude Task',
    enabled: true,
    available: true,
    capabilities: {
      task: true,
      directTerminalBacked: true,
      review: true,
      artifacts: false,
      followUp: false,
    },

    async dispatchTask(spec = {}) {
      const text = typeof spec.text === 'string' ? spec.text.trim() : '';
      if (!text) {
        throw new Error('text is required');
      }

      const cwd = typeof spec.cwd === 'string' && spec.cwd ? spec.cwd : undefined;
      const dispatchText = buildClaudeTaskPrompt(text);

      const session = sendClaudeInput({
        text: dispatchText,
        cwdRel: cwd,
        raw: false,
        registerTask: true,
      });

      const task = getCurrentTask() || null;

      return {
        ok: true,
        executor: 'claude-task',
        task: task
          ? {
              ...task,
              executorId: 'claude-task',
              orchestrationMode: 'task',
              isRealTask: !!(task.runtime?.source === 'claude-terminal'),
            }
          : null,
        session,
      };
    },
  };
}
