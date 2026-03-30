export function mapRuntimeEventToSemanticState(event) {
  const runtimeEvent = String(event?.type || '');

  if (runtimeEvent === 'run.delta') {
    return { semanticState: 'thinking', runtimeEvent };
  }
  if (runtimeEvent === 'run.final') {
    return { semanticState: 'success', runtimeEvent };
  }
  if (runtimeEvent === 'run.error') {
    return { semanticState: 'error', runtimeEvent };
  }
  if (runtimeEvent === 'run.aborted') {
    return { semanticState: 'idle', runtimeEvent };
  }
  return null;
}
