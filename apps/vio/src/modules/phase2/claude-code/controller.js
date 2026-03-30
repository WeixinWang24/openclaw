async function readJsonOrThrow(url, init = undefined, fallbackError = 'request failed') {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || fallbackError);
  }
  return data;
}

export function createClaudeCodeController(refs, options = {}) {
  const state = {
    sessionKey: '',
    status: 'idle',
    started: false,
    running: false,
    output: '',
    exitCode: null,
    error: null,
    cwd: '.',
    loading: false,
  };

  const getActiveSessionKey =
    typeof options?.getActiveSessionKey === 'function'
      ? options.getActiveSessionKey
      : () => state.sessionKey;

  function applyRemoteState(data = {}) {
    state.status = String(data?.status || 'idle');
    state.started = !!data?.started;
    state.running = !!data?.running;
    state.output = String(data?.output || '');
    state.exitCode = data?.exitCode ?? null;
    state.error = data?.error || data?.terminationError || null;
    state.cwd = typeof data?.cwd === 'string' && data.cwd ? data.cwd : '.';
  }

  function renderStatus() {
    if (!refs?.claudeCodeStatusEl) {return;}
    const parts = [state.status];
    if (state.sessionKey) {parts.push(`session=${state.sessionKey}`);}
    if (state.cwd) {parts.push(`cwd=${state.cwd}`);}
    if (state.error) {parts.push(`error=${String(state.error)}`);}
    refs.claudeCodeStatusEl.innerHTML = `<span class="semantic-value">${parts.join(' · ')}</span>`;
  }

  function renderOutput() {
    if (!refs?.claudeCodeOutputEl) {return;}
    refs.claudeCodeOutputEl.textContent = state.output || '';
  }

  function renderControls() {
    if (refs?.claudeCodeStartBtnEl) {
      refs.claudeCodeStartBtnEl.disabled = state.loading || state.running;
    }
    if (refs?.claudeCodeStopBtnEl) {
      refs.claudeCodeStopBtnEl.disabled = state.loading || !state.started;
    }
    if (refs?.claudeCodeRestartBtnEl) {
      refs.claudeCodeRestartBtnEl.disabled = state.loading || !state.started;
    }
    if (refs?.claudeCodeSendBtnEl) {
      refs.claudeCodeSendBtnEl.disabled =
        state.loading || !state.started || !String(refs?.claudeCodeInputEl?.value || '').trim();
    }
    if (refs?.claudeCodeInputEl) {
      refs.claudeCodeInputEl.disabled = state.loading || !state.started;
    }
  }

  function render() {
    renderStatus();
    renderOutput();
    renderControls();
  }

  function setSessionKey(sessionKey) {
    state.sessionKey = String(sessionKey || '');
    render();
  }

  async function refreshState(nextSessionKey = state.sessionKey) {
    const resolvedSessionKey = String(nextSessionKey || getActiveSessionKey() || '');
    if (!resolvedSessionKey) {return null;}
    state.sessionKey = resolvedSessionKey;
    state.loading = true;
    state.error = null;
    render();
    try {
      const data = await readJsonOrThrow(
        `/api/sessions/${encodeURIComponent(resolvedSessionKey)}/claude-code`,
        undefined,
        'claude code state failed',
      );
      applyRemoteState(data);
      return data;
    } catch (error) {
      state.error = error?.message || String(error);
      return null;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function startSession() {
    const resolvedSessionKey = String(state.sessionKey || getActiveSessionKey() || '');
    if (!resolvedSessionKey) {return null;}
    state.loading = true;
    state.error = null;
    render();
    try {
      const data = await readJsonOrThrow(
        `/api/sessions/${encodeURIComponent(resolvedSessionKey)}/claude-code/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cwd: state.cwd || '.' }),
        },
        'claude code start failed',
      );
      applyRemoteState(data);
      return data;
    } catch (error) {
      state.error = error?.message || String(error);
      return null;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function sendInput() {
    const resolvedSessionKey = String(state.sessionKey || getActiveSessionKey() || '');
    if (!resolvedSessionKey || !refs?.claudeCodeInputEl) {return null;}
    const text = String(refs.claudeCodeInputEl.value || '').trim();
    if (!text) {return null;}
    state.loading = true;
    state.error = null;
    render();
    try {
      const data = await readJsonOrThrow(
        `/api/sessions/${encodeURIComponent(resolvedSessionKey)}/claude-code/input`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, cwd: state.cwd || '.', raw: false }),
        },
        'claude code input failed',
      );
      refs.claudeCodeInputEl.value = '';
      applyRemoteState(data);
      return data;
    } catch (error) {
      state.error = error?.message || String(error);
      return null;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function stopSession() {
    const resolvedSessionKey = String(state.sessionKey || getActiveSessionKey() || '');
    if (!resolvedSessionKey) {return null;}
    state.loading = true;
    state.error = null;
    render();
    try {
      const data = await readJsonOrThrow(
        `/api/sessions/${encodeURIComponent(resolvedSessionKey)}/claude-code/stop`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        'claude code stop failed',
      );
      applyRemoteState(data);
      return data;
    } catch (error) {
      state.error = error?.message || String(error);
      return null;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function restartSession() {
    await stopSession();
    return startSession();
  }

  function bind() {
    refs?.claudeCodeStartBtnEl?.addEventListener('click', () => {
      void startSession();
    });
    refs?.claudeCodeStopBtnEl?.addEventListener('click', () => {
      void stopSession();
    });
    refs?.claudeCodeRestartBtnEl?.addEventListener('click', () => {
      void restartSession();
    });
    refs?.claudeCodeSendBtnEl?.addEventListener('click', () => {
      void sendInput();
    });
    refs?.claudeCodeInputEl?.addEventListener('input', () => renderControls());
    refs?.claudeCodeInputEl?.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        void sendInput();
      }
    });
    render();
  }

  function getState() {
    return { ...state };
  }

  return {
    bind,
    setSessionKey,
    refreshState,
    startSession,
    sendInput,
    stopSession,
    restartSession,
    getState,
  };
}
