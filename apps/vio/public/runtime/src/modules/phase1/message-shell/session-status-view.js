export function renderSessionStatus(refs, flow, sessionKey, { loading = false, messages = null, reconciled = false, meta = null, view = null, viewMeta = null } = {}) {
  if (loading) {
    if (refs?.sessionStatusChipEl) {refs.sessionStatusChipEl.textContent = 'runtime: loading';}
    return;
  }
  const count = Array.isArray(messages) ? messages.length : flow?.getSessionMessages(sessionKey).length;
  const activeRunId = viewMeta?.activeRunId || null;
  const activeRunStatus = viewMeta?.activeRunStatus || null;
  const runCount = Array.isArray(viewMeta?.runs) ? viewMeta.runs.length : (view?.runs && typeof view.runs === 'object' ? Object.keys(view.runs).length : 0);
  if (refs?.sessionStatusChipEl) {
    refs.sessionStatusChipEl.textContent = activeRunId ? `runtime: ${String(activeRunStatus || 'active')}` : 'runtime: idle';
  }
  if (refs?.runtimeSessionSummaryEl) {
    const mode = reconciled ? 'reconciled' : 'ready';
    const pendingTag = meta?.pending ? ' · pending' : '';
    refs.runtimeSessionSummaryEl.textContent = `Session ${sessionKey} · ${count} visible messages · mode ${mode}${pendingTag}`;
  }
  if (refs?.runtimeRunSummaryEl) {
    refs.runtimeRunSummaryEl.textContent = activeRunId
      ? `Active run ${String(activeRunId)} · status ${String(activeRunStatus || 'active')}`
      : runCount > 0
        ? `Known runs in projection: ${runCount}`
        : 'No active run.';
  }
}
