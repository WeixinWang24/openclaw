async function readJsonOrThrow(url, init = undefined, fallbackError = 'request failed') {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || fallbackError);
  }
  return data;
}

const CLAUDE_TERMINAL_INIT_ERROR = 'xterm.js not loaded — include vendor/xterm.js and vendor/xterm-addon-fit.js';

function shouldSendImmediately(data) {
  if (!data) {return false;}
  if (data === '\r' || data === '\n') {return true;}
  if (data === '\u001b') {return true;}
  if (data.startsWith('\u001b[')) {return true;}
  if (data.startsWith('\u001bO')) {return true;}
  if (data.length === 1) {
    const code = data.charCodeAt(0);
    if (code < 32 && data !== '\u007f') {return true;}
  }
  return false;
}

export function createClaudeCodeController(refs) {
  let pollTimer = null;
  const pollIntervalMs = 200;

  const state = {
    sessionKey: 'claude-default',
    status: 'idle',
    started: false,
    running: false,
    exited: false,
    exitCode: null,
    error: null,
    cwd: '.',
    loading: false,
    polling: false,
    sessionId: 'claude-default',
  };

  // xterm state
  let term = null;
  let fitAddon = null;
  let terminalReady = false;
  let streamOffset = 0;
  let streamTimer = null;
  let streamFetching = false;
  const streamPollIntervalMs = 120;
  let autoScroll = true;
  let focused = false;
  let useInitialColsCompensation = true;
  let terminalHydrated = false;

  // input buffer for xterm keypresses
  let inputBuffer = '';
  let inputFlushTimer = null;
  const inputFlushDelayMs = 30;

  // composer state
  let composerDraft = '';
  let composerSending = false;

  function ensureTerminal() {
    if (terminalReady || !refs?.claudeTerminalHostEl || !window.Terminal || !window.FitAddon?.FitAddon) {return;}
    refs.claudeTerminalHostEl.innerHTML = '';
    term?.dispose?.();
    term = new window.Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 17,
      theme: {
        background: '#0b1020',
        foreground: '#d7f8ff',
        cursor: '#8fffe0',
        selectionBackground: 'rgba(143,255,224,0.18)',
      },
      scrollback: 5000,
    });
    fitAddon = new window.FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(refs.claudeTerminalHostEl);
    fitAddon.fit();

    // focus tracking
    refs.claudeTerminalHostEl.addEventListener('focusin', () => { focused = true; updateFocusState(); });
    refs.claudeTerminalHostEl.addEventListener('focusout', () => { focused = false; updateFocusState(); });
    term.onFocus?.(() => { focused = true; updateFocusState(); });
    term.onBlur?.(() => { focused = false; updateFocusState(); });
    refs.claudeTerminalHostEl.addEventListener('pointerdown', () => {
      requestAnimationFrame(() => term?.focus());
    });

    // capture keypresses — send raw to PTY
    term.onData(data => {
      if (!state.running) {return;}
      if (useInitialColsCompensation) {
        useInitialColsCompensation = false;
      }
      if (shouldSendImmediately(data)) {
        void flushInputBuffer().finally(() => {
          sendRawInput(data).catch(() => {});
        });
        return;
      }
      inputBuffer += data;
      scheduleInputFlush();
    });

    terminalReady = true;
  }

  function updateFocusState() {
    refs?.claudeTerminalHostEl?.classList.toggle('is-focused', focused);
    refs?.claudeCodePanelEl?.classList.toggle('is-terminal-focused', focused);
  }

  // --- raw input (xterm keypresses) ---

  async function sendRawInput(text) {
    if (!text) {return;}
    await fetch('/api/claude/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, cwd: state.cwd, raw: true }),
    });
  }

  async function flushInputBuffer() {
    if (inputFlushTimer) {
      clearTimeout(inputFlushTimer);
      inputFlushTimer = null;
    }
    const payload = inputBuffer;
    if (!payload) {return;}
    inputBuffer = '';
    try {
      await sendRawInput(payload);
    } catch {}
  }

  function scheduleInputFlush() {
    if (inputFlushTimer) {return;}
    inputFlushTimer = window.setTimeout(() => {
      void flushInputBuffer();
    }, inputFlushDelayMs);
  }

  // --- terminal output ---

  function appendTerminalChunk(chunk) {
    ensureTerminal();
    if (!term) {
      state.error = state.error || CLAUDE_TERMINAL_INIT_ERROR;
      return;
    }
    if (!terminalHydrated) {return;}
    const nextChunk = String(chunk || '').replace(/^\[bridge\].*\n?/gm, '');
    if (!nextChunk) {return;}
    term.write(nextChunk, () => {
      if (autoScroll) {term.scrollToBottom();}
    });
  }

  function resetTerminalOutput() {
    ensureTerminal();
    useInitialColsCompensation = true;
    terminalHydrated = false;
    if (!term) {
      state.error = state.error || CLAUDE_TERMINAL_INIT_ERROR;
      streamOffset = 0;
      return;
    }
    term.reset();
    streamOffset = 0;
  }

  async function fetchTerminalStreamChunk(offset = streamOffset, options = {}) {
    if (streamFetching) {return null;}
    const applyChunk = options?.applyChunk !== false;
    const advanceOffset = options?.advanceOffset !== false;
    streamFetching = true;
    try {
      const data = await readJsonOrThrow(
        `/api/claude/stream?offset=${encodeURIComponent(String(offset))}&cwd=${encodeURIComponent(state.cwd || '.')}`,
        undefined,
        'claude code stream failed',
      );
      if (data?.reset) {
        if (applyChunk) {
          resetTerminalOutput();
        }
        if (advanceOffset) {
          streamOffset = Number(data?.nextOffset || 0);
        }
        return data;
      }
      if (applyChunk) {
        appendTerminalChunk(String(data?.chunk || ''));
      }
      if (advanceOffset) {
        streamOffset = Number(data?.nextOffset || streamOffset || 0);
      }
      return data;
    } finally {
      streamFetching = false;
    }
  }

  async function catchUpTerminalStream({ maxPasses = 12 } = {}) {
    for (let pass = 0; pass < maxPasses; pass += 1) {
      const data = await fetchTerminalStreamChunk();
      if (!data?.hasMore) {return data || null;}
    }
    return null;
  }

  async function probeInitialTerminalStream() {
    return await fetchTerminalStreamChunk(0, {
      applyChunk: false,
      advanceOffset: false,
    });
  }

  // --- resize ---

  async function resizeTerminal() {
    ensureTerminal();
    if (!term) {return;}
    const hostRect = refs?.claudeTerminalHostEl?.getBoundingClientRect?.();
    if (!hostRect || hostRect.width < 40 || hostRect.height < 40) {return;}
    if (fitAddon) {fitAddon.fit();}
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (fitAddon) {fitAddon.fit();}
    const hostWidth = Math.round(hostRect.width || 0);
    const narrowWidthPenalty = hostWidth > 0 && hostWidth < 900 ? 1 : 0;
    const cols = Math.max(20, term.cols - (useInitialColsCompensation ? 2 : 0) - narrowWidthPenalty);
    const rows = Math.max(8, term.rows);
    try {
      await fetch('/api/claude/resize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cols, rows }),
      });
    } catch {}
  }

  // --- state management ---

  function applyRemoteState(data = {}) {
    const prevSessionId = state.sessionId;
    const prevRunning = state.running;

    state.sessionId = data.sessionId || 'claude-default';
    state.status = String(data?.status || 'idle');
    state.started = !!data?.started;
    state.running = !!data?.running;
    state.exited = !!data?.exited;
    state.exitCode = data?.exitCode ?? null;
    state.error = data?.error || data?.terminationError || null;
    state.cwd = typeof data?.cwd === 'string' && data.cwd ? data.cwd : '.';

    const sessionChanged = state.sessionId !== prevSessionId;
    const becameRunning = !prevRunning && !!state.running;
    if (sessionChanged || becameRunning) {
      resetTerminalOutput();
      void catchUpTerminalStream();
    }

    renderChrome();
    renderComposer();

    if (state.running || state.started) {
      ensurePolling();
    } else {
      stopPolling();
    }

    if (state.running) {
      ensureStreamPolling();
    } else {
      stopStreamPolling();
    }
  }

  // --- chrome rendering ---

  function renderChrome() {
    if (refs?.claudeCodeStatusEl) {
      const parts = [state.status];
      if (state.cwd && state.cwd !== '.') {parts.push(`cwd=${state.cwd}`);}
      if (state.error) {parts.push(`error=${String(state.error)}`);}
      refs.claudeCodeStatusEl.innerHTML = `<span class="semantic-value">${parts.join(' · ')}</span>`;
    }
    if (refs?.claudeCodeStartBtnEl) {
      refs.claudeCodeStartBtnEl.disabled = state.loading || state.running;
    }
    if (refs?.claudeCodeStopBtnEl) {
      refs.claudeCodeStopBtnEl.disabled = state.loading || !state.started;
    }
    if (refs?.claudeCodeRestartBtnEl) {
      refs.claudeCodeRestartBtnEl.disabled = state.loading || !state.started;
    }
  }

  // --- composer ---

  function getComposerMode() {
    return state.running ? 'reply' : 'dispatch';
  }

  function getComposerPlaceholder(mode = getComposerMode()) {
    return mode === 'reply'
      ? 'Reply to the running Claude session...'
      : 'Dispatch a new task to Claude...';
  }

  function getComposerHint(mode = getComposerMode()) {
    return mode === 'reply'
      ? 'Reply to running Claude session: Enter send · Shift+Enter newline'
      : 'Dispatch new task: Enter send · Shift+Enter newline';
  }

  function renderComposer() {
    const mode = getComposerMode();
    const disabled = state.loading || composerSending;
    const trimmed = (composerDraft || '').trim();
    if (refs?.claudeCodeInputEl) {
      refs.claudeCodeInputEl.disabled = disabled;
      refs.claudeCodeInputEl.placeholder = getComposerPlaceholder(mode);
    }
    if (refs?.claudeCodeSendBtnEl) {
      refs.claudeCodeSendBtnEl.disabled = disabled || !trimmed.length;
      refs.claudeCodeSendBtnEl.textContent = composerSending ? 'Sending...' : (mode === 'reply' ? 'Reply' : 'Dispatch');
    }
    if (refs?.claudeComposerStatusEl) {
      refs.claudeComposerStatusEl.textContent = getComposerHint(mode);
    }
  }

  function resizeComposerTextarea() {
    const el = refs?.claudeCodeInputEl;
    if (!el) {return;}
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  async function submitComposer() {
    const value = String(composerDraft || '').trim();
    const mode = getComposerMode();
    if (!value || composerSending || state.loading) {return;}
    composerSending = true;
    renderComposer();
    try {
      await flushInputBuffer();
      const endpoint = mode === 'reply' ? '/api/claude/input' : '/api/claude/input';
      const body = mode === 'reply'
        ? { text: value, cwd: state.cwd, raw: false }
        : { text: value, cwd: state.cwd, raw: false };
      const data = await readJsonOrThrow(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, `Failed to ${mode} Claude`);
      applyRemoteState(data);
      composerDraft = '';
      if (refs?.claudeCodeInputEl) {refs.claudeCodeInputEl.value = '';}
      resizeComposerTextarea();
      if (refs?.claudeComposerStatusEl) {
        refs.claudeComposerStatusEl.textContent = mode === 'reply'
          ? 'Reply sent. Waiting for PTY output...'
          : 'Task dispatched. Waiting for PTY output...';
      }
      void catchUpTerminalStream();
      window.setTimeout(() => void fetchState(), 120);
      window.setTimeout(() => void catchUpTerminalStream(), 200);
      window.setTimeout(() => void fetchState(), 600);
    } catch (error) {
      state.error = error?.message || String(error);
      renderChrome();
    } finally {
      composerSending = false;
      renderComposer();
    }
  }

  // --- polling ---

  function ensurePolling() {
    if (pollTimer) {return;}
    pollTimer = window.setInterval(async () => {
      if (state.polling) {return;}
      state.polling = true;
      try {
        await fetchState();
      } catch (error) {
        state.error = error?.message || String(error);
        renderChrome();
      } finally {
        state.polling = false;
      }
    }, pollIntervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function ensureStreamPolling() {
    if (streamTimer) {return;}
    streamTimer = window.setInterval(async () => {
      if (!state.running) {return;}
      try {
        await catchUpTerminalStream();
      } catch (error) {
        state.error = error?.message || String(error);
        renderChrome();
      }
    }, streamPollIntervalMs);
  }

  function stopStreamPolling() {
    if (streamTimer) {
      clearInterval(streamTimer);
      streamTimer = null;
    }
  }

  async function fetchState() {
    const data = await readJsonOrThrow(
      `/api/claude/state?cwd=${encodeURIComponent(state.cwd || '.')}`,
      undefined,
      'claude code state failed',
    );
    applyRemoteState(data);
    return data;
  }

  // --- session lifecycle ---

  async function startSession() {
    selectCodeView();
    state.loading = true;
    state.error = null;
    renderChrome();
    try {
      await waitForStableTerminalHost();
      await resizeTerminal();
      const data = await readJsonOrThrow(
        '/api/claude/start',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cwd: state.cwd || '.' }),
        },
        'claude code start failed',
      );
      applyRemoteState(data);
      ensurePolling();
      ensureStreamPolling();
      scheduleTerminalRefit();
      void hydrateTerminalFromStableGeometry();
      window.setTimeout(() => {
        void fetchState();
        void hydrateTerminalFromStableGeometry();
      }, 200);
      return data;
    } catch (error) {
      state.error = error?.message || String(error);
      return null;
    } finally {
      state.loading = false;
      renderChrome();
    }
  }

  async function stopSession() {
    state.loading = true;
    state.error = null;
    renderChrome();
    try {
      const data = await readJsonOrThrow(
        '/api/claude/stop',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        'claude code stop failed',
      );
      applyRemoteState(data);
      stopStreamPolling();
      window.setTimeout(() => void fetchState(), 200);
      window.setTimeout(() => void fetchState(), 1000);
      return data;
    } catch (error) {
      state.error = error?.message || String(error);
      return null;
    } finally {
      state.loading = false;
      renderChrome();
    }
  }

  async function restartSession() {
    await stopSession();
    return startSession();
  }

  // --- SSE ---

  function handleSseClaudeState(data) {
    applyRemoteState(data);
  }

  function attachSseListener() {
    try {
      const evtSource = new EventSource('/api/events');
      evtSource.addEventListener('message', event => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed?.channel === 'claude-state' && parsed?.event) {
            handleSseClaudeState(parsed.event);
          }
        } catch {}
      });
    } catch {}
  }

  // --- view selection ---

  function selectCodeView() {
    try {
      window.__VIO_WORKSPACE_VIEWS__?.selectView?.('code');
    } catch {}
    scheduleTerminalRefit();
  }

  async function waitForStableTerminalHost({ tries = 10, delayMs = 80 } = {}) {
    let lastWidth = 0;
    let lastHeight = 0;
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const rect = refs?.claudeTerminalHostEl?.getBoundingClientRect?.();
      const width = Math.round(rect?.width || 0);
      const height = Math.round(rect?.height || 0);
      if (width >= 120 && height >= 120 && width === lastWidth && height === lastHeight) {
        return { width, height, stable: true };
      }
      lastWidth = width;
      lastHeight = height;
      await new Promise(resolve => window.setTimeout(resolve, delayMs));
    }
    return { width: lastWidth, height: lastHeight, stable: false };
  }

  function scheduleTerminalRefit() {
    window.setTimeout(() => void resizeTerminal(), 0);
    window.setTimeout(() => void resizeTerminal(), 80);
    window.setTimeout(() => void resizeTerminal(), 220);
    window.setTimeout(() => void resizeTerminal(), 420);
    window.setTimeout(() => void resizeTerminal(), 700);
    window.setTimeout(() => void resizeTerminal(), 1000);
  }

  async function hydrateTerminalFromStableGeometry() {
    selectCodeView();
    await waitForStableTerminalHost();
    await resizeTerminal();
    resetTerminalOutput();
    terminalHydrated = true;
    await catchUpTerminalStream();
  }

  // --- bind ---

  function bind() {
    refs?.claudeCodeStartBtnEl?.addEventListener('click', () => {
      selectCodeView();
      void startSession();
    });
    refs?.claudeCodeStopBtnEl?.addEventListener('click', () => {
      selectCodeView();
      void stopSession();
    });
    refs?.claudeCodeRestartBtnEl?.addEventListener('click', () => {
      selectCodeView();
      void restartSession();
    });

    // composer bindings
    refs?.claudeCodeInputEl?.addEventListener('input', () => {
      composerDraft = refs.claudeCodeInputEl.value || '';
      resizeComposerTextarea();
      renderComposer();
    });
    refs?.claudeCodeInputEl?.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void submitComposer();
      }
    });
    refs?.claudeCodeSendBtnEl?.addEventListener('click', () => {
      void submitComposer();
    });

    // resize observer for terminal fit
    if (refs?.claudeTerminalHostEl) {
      const ro = new ResizeObserver(() => void resizeTerminal());
      ro.observe(refs.claudeTerminalHostEl);
    }

    refs?.workspaceViewTabEls?.forEach(tabEl => {
      tabEl?.addEventListener('click', () => {
        if (tabEl?.dataset?.workspaceView === 'code') {
          scheduleTerminalRefit();
        }
      });
    });

    ensureTerminal();
    scheduleTerminalRefit();
    renderChrome();
    renderComposer();
    void fetchState().then(() => hydrateTerminalFromStableGeometry()).catch(() => {});
    attachSseListener();
  }

  function getState() {
    return { ...state };
  }

  return {
    bind,
    refreshState: fetchState,
    startSession,
    stopSession,
    restartSession,
    probeInitialTerminalStream,
    getState,
  };
}
