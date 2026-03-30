export function attachRunEventStream(flow, shell) {
  const es = new EventSource('/api/events');
  es.addEventListener('message', event => {
    try {
      const payload = JSON.parse(String(event.data || '{}'));
      const kernelEvent = payload?.event || null;
      if (!kernelEvent) {return;}
      const sessionKey = kernelEvent?.sessionKey || null;
      const runId = kernelEvent?.runId || null;
      const isSelected = flow?.getActiveSessionKey?.() === sessionKey;
      if (!sessionKey) {return;}

      if (kernelEvent.type === 'run.delta') {
        if (isSelected) {
          shell?.handleDelta?.(sessionKey, runId, String(kernelEvent.accumulatedText || kernelEvent.textDelta || ''));
        }
        return;
      }

      if (kernelEvent.type === 'run.final') {
        if (isSelected) {
          shell?.handleFinal?.(sessionKey, runId || null);
        }
        window.setTimeout(() => {
          flow?.refreshSession?.(sessionKey, 'run-final', { force: true, cacheOnly: true }).catch(() => {});
        }, 120);
        return;
      }

      if (kernelEvent.type === 'run.aborted' || kernelEvent.type === 'run.error') {
        flow?.refreshSession?.(sessionKey, kernelEvent.type, { force: true, cacheOnly: true }).catch(() => {});
      }
    } catch {}
  });
  return es;
}
