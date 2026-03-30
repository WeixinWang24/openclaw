export function normalizeFlowMessages(messages = []) {
  return Array.isArray(messages)
    ? messages.map(message => ({
        id: message?.id || null,
        role: message?.role || 'unknown',
        text: typeof message?.text === 'string' ? message.text : '',
        status: message?.status || null,
        runId: message?.runId || null,
      }))
    : [];
}
