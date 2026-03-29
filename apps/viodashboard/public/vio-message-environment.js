export function createVioMessageEnvironment({
  refs,
  helpers,
  getLatestWrapperRuntime,
  setLatestWrapperRuntime,
}) {
  const {
    moodEl,
    moodMiniEl,
    streamStateEl,
    moodRouterDotEl,
    currentMoodDotEl,
    tokenSaverDetailEl,
    tokenSaverToggleBtnEl,
    tokenSaverPhase1BtnEl,
    tokenSaverPhase2BtnEl,
    tokenSaverDotEl,
  } = refs;
  const { applyStateClass, applyDotState, fetchJson } = helpers;

  function renderMood(mode, detail = '', runtime = null) {
    void detail;
    if (runtime && typeof runtime === 'object') {setLatestWrapperRuntime(runtime);}
    const latestWrapperRuntime = getLatestWrapperRuntime();
    const value = mode || latestWrapperRuntime?.mood || latestWrapperRuntime?.lightOutput || 'idle';
    const state = value === 'thinking' ? 'thinking' : value === 'waiting' ? 'waiting' : value === 'error' ? 'error' : value === 'streaming' ? 'streaming' : 'idle';
    if (moodEl) {moodEl.innerHTML = `<span class="semantic-label">mood:</span> <span class="semantic-value">${value}</span>`;}
    if (moodMiniEl) {moodMiniEl.innerHTML = `<span class="semantic-value state-text-${state}">${value}</span>`;}
    if (streamStateEl) {streamStateEl.innerHTML = `<span class="semantic-value">${value}</span>`;}
    if (moodEl) {applyStateClass(moodEl, state);}
    if (moodMiniEl) {applyStateClass(moodMiniEl, state);}
    if (streamStateEl) {applyStateClass(streamStateEl, state);}
    if (moodRouterDotEl) {applyDotState(moodRouterDotEl, 'mood', state);}
    if (currentMoodDotEl) {applyDotState(currentMoodDotEl, 'mood', state);}
  }

  function renderTokenSaverState(data = {}) {
    const enabled = data?.enabled === true || data?.disabled === false;
    const rules = data?.rules || {};
    const stats = data?.stats || {};
    const last = data?.lastSend?.stats || stats?.last || null;
    const totalSaved = Number(stats?.totalSavedChars || 0) || 0;
    const sendCount = Number(stats?.sendCount || 0) || 0;
    const savedLast = Number(last?.savedChars || 0) || 0;
    const contextChars = Number(last?.contextChars || 0) || 0;
    const savedPct = Number(last?.savedPct || 0) || 0;
    const totalSavedPct = Number(stats?.totalSavedPctWeighted || 0) || 0;
    const detail = enabled
      ? (sendCount
          ? `on · last ${savedLast} chars (${savedPct}%) · total ${totalSaved} (${totalSavedPct}%) · sends ${sendCount} · ctx ${contextChars}`
          : 'on · no savings recorded yet')
      : 'off · pass-through mode';
    if (tokenSaverDetailEl) {tokenSaverDetailEl.innerHTML = `<span class="semantic-value">${detail}</span>`;}
    if (tokenSaverToggleBtnEl) {
      tokenSaverToggleBtnEl.textContent = enabled ? 'on' : 'off';
      tokenSaverToggleBtnEl.className = `chip ${enabled ? 'state-thinking' : 'state-idle'} token-saver-toggle`;
      tokenSaverToggleBtnEl.dataset.enabled = enabled ? 'true' : 'false';
    }
    if (tokenSaverPhase1BtnEl) {
      const on = rules.phase1Summary !== false;
      tokenSaverPhase1BtnEl.textContent = `L1 ${on ? 'on' : 'off'}`;
      tokenSaverPhase1BtnEl.className = `chip ${on ? 'state-thinking' : 'state-idle'} token-saver-toggle`;
      tokenSaverPhase1BtnEl.dataset.enabled = on ? 'true' : 'false';
    }
    if (tokenSaverPhase2BtnEl) {
      const on = rules.phase2ToolCompression === true;
      tokenSaverPhase2BtnEl.textContent = `L2 ${on ? 'on' : 'off'}`;
      tokenSaverPhase2BtnEl.className = `chip ${on ? 'state-thinking' : 'state-idle'} token-saver-toggle`;
      tokenSaverPhase2BtnEl.dataset.enabled = on ? 'true' : 'false';
    }
    if (tokenSaverDotEl) {applyDotState(tokenSaverDotEl, 'window', enabled ? (totalSaved > 0 || savedLast > 0 ? 'safe' : sendCount > 0 ? 'mid' : 'safe') : 'danger');}
  }

  async function refreshTokenSaverStats() {
    try {
      const data = await fetchJson('/api/coms/token-saver', 'token saver stats unavailable');
      renderTokenSaverState(data?.tokenSaver || {});
    } catch (error) {
      if (tokenSaverDetailEl) {tokenSaverDetailEl.innerHTML = `<span class="semantic-value">${error.message || error}</span>`;}
      if (tokenSaverDotEl) {applyDotState(tokenSaverDotEl, 'window', 'danger');}
    }
  }

  return {
    renderMood,
    renderTokenSaverState,
    refreshTokenSaverStats,
  };
}
