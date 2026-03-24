export function createSessionRegistry() {
  const sessionsByKey = new Map();
  const activeRunsBySession = new Map();

  function replaceSessions(list = []) {
    sessionsByKey.clear();
    for (const item of list) {
      if (!item?.key) {continue;}
      sessionsByKey.set(item.key, item);
    }
  }

  function listSessions() {
    return [...sessionsByKey.values()];
  }

  function getSession(sessionKey) {
    return sessionsByKey.get(sessionKey) || null;
  }

  function markRunActive(sessionKey, runId) {
    if (!sessionKey || !runId) {return;}
    if (!activeRunsBySession.has(sessionKey)) {
      activeRunsBySession.set(sessionKey, new Set());
    }
    activeRunsBySession.get(sessionKey).add(runId);
  }

  function markRunFinished(sessionKey, runId) {
    const set = activeRunsBySession.get(sessionKey);
    if (!set) {return;}
    set.delete(runId);
    if (set.size === 0) {activeRunsBySession.delete(sessionKey);}
  }

  function getActiveRuns(sessionKey) {
    return [...(activeRunsBySession.get(sessionKey) || new Set())];
  }

  return {
    replaceSessions,
    listSessions,
    getSession,
    markRunActive,
    markRunFinished,
    getActiveRuns,
  };
}
