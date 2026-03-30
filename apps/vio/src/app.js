import { createClaudeCodeController } from './modules/phase2/claude-code/controller.js';

function createMinimalClaudePage(rootEl) {
  if (!rootEl) {return null;}
  rootEl.innerHTML = `
    <div class="dashboard ide-layout" style="grid-template-columns:minmax(0,1fr);grid-template-areas:'top' 'main';">
      <header class="topbar card cyan">
        <div class="topbar-main">
          <div class="brand">
            <div class="brand-mark">V</div>
            <div class="brand-text">
              <h1>Vio Claude PTY</h1>
              <p>minimal recovery shell</p>
            </div>
          </div>
          <div class="topbar-right">
            <div class="chip live">runtime: local</div>
            <div id="claudeCodeStatus" class="chip state-idle">idle</div>
            <div id="claudeStatusMeta" class="chip state-idle">cwd: .</div>
          </div>
        </div>
      </header>

      <main class="main panel-shell" style="grid-area:main;min-height:0;">
        <section class="card section workspace-panel" style="height:100%;">
          <section id="claudeCodePanel" class="section claude-code-panel vio-unified-workspace-card claude-code-terminal-layout" style="padding:0;min-height:0;height:100%;">
            <div class="section-header claude-code-chrome" style="padding:14px 16px 0;align-items:flex-start;">
              <div style="min-width:0;display:grid;gap:6px;">
                <h3 class="section-title" style="margin:0;">Claude Code</h3>
                <div id="claudeInfoLine" class="event-sub"><span class="semantic-value">Preparing terminal…</span></div>
              </div>
              <div class="pane-actions claude-code-chrome-actions">
                <button id="claudeReconnectBtn" type="button" class="chip state-idle">reconnect</button>
                <button id="claudeClearBtn" type="button" class="chip state-idle">clear</button>
                <button id="claudeCodeStartBtn" type="button" class="chip state-idle">start</button>
                <button id="claudeCodeStopBtn" type="button" class="chip state-idle">stop</button>
                <button id="claudeCodeRestartBtn" type="button" class="chip state-idle">restart</button>
              </div>
            </div>
            <div id="claudeTerminalHost" class="claude-terminal-host" style="margin:14px 16px 10px;min-height:420px;"></div>
            <div class="claude-composer-shell" style="padding:0 16px 16px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;">
              <textarea id="claudeCodeInput" class="claude-composer-input" spellcheck="false" rows="1" placeholder="Dispatch a new task to Claude..."></textarea>
              <button id="claudeCodeSendBtn" type="button" class="chip state-idle" style="height:56px;">Dispatch</button>
              <div id="claudeComposerStatus" class="claude-composer-status" style="grid-column:1 / -1;">Enter send · Shift+Enter newline</div>
            </div>
          </section>
        </section>
      </main>
    </div>
  `;

  return {
    claudeCodePanelEl: document.getElementById('claudeCodePanel'),
    claudeCodeStatusEl: document.getElementById('claudeCodeStatus'),
    claudeStatusMetaEl: document.getElementById('claudeStatusMeta'),
    claudeInfoLineEl: document.getElementById('claudeInfoLine'),
    claudeTerminalHostEl: document.getElementById('claudeTerminalHost'),
    claudeCodeInputEl: document.getElementById('claudeCodeInput'),
    claudeComposerStatusEl: document.getElementById('claudeComposerStatus'),
    claudeCodeStartBtnEl: document.getElementById('claudeCodeStartBtn'),
    claudeCodeStopBtnEl: document.getElementById('claudeCodeStopBtn'),
    claudeCodeRestartBtnEl: document.getElementById('claudeCodeRestartBtn'),
    claudeCodeSendBtnEl: document.getElementById('claudeCodeSendBtn'),
    claudeReconnectBtnEl: document.getElementById('claudeReconnectBtn'),
    claudeClearBtnEl: document.getElementById('claudeClearBtn'),
  };
}

async function fetchClaudeState() {
  const res = await fetch('/api/claude/state?cwd=.');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'failed to fetch claude state');
  }
  return data;
}

async function fetchInitialStreamProbe() {
  const res = await fetch('/api/claude/stream?offset=0&cwd=.');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'failed to probe claude stream');
  }
  return data;
}

function renderStateChrome(refs, state = null, extras = {}) {
  const status = String(state?.status || 'idle');
  const cwd = String(state?.cwd || '.');
  if (refs?.claudeCodeStatusEl) {
    refs.claudeCodeStatusEl.textContent = status;
  }
  if (refs?.claudeStatusMetaEl) {
    refs.claudeStatusMetaEl.textContent = `cwd: ${cwd}`;
  }
  if (refs?.claudeInfoLineEl) {
    const parts = [];
    if (extras?.recovering) {parts.push('recovering blank PTY');}
    else if (state?.running) {parts.push('PTY attached');}
    else if (state?.started) {parts.push('session exists');}
    else {parts.push('session idle');}
    if (state?.childPid) {parts.push(`child=${state.childPid}`);}
    if (state?.bridgePid) {parts.push(`bridge=${state.bridgePid}`);}
    if (extras?.streamBytes === 0 && state?.running) {parts.push('stream=empty');}
    if (state?.error) {parts.push(`error=${String(state.error)}`);}
    refs.claudeInfoLineEl.innerHTML = `<span class="semantic-value">${parts.join(' · ')}</span>`;
  }
}

async function ensureUsableClaudeSession(claude, refs) {
  let state = await claude.refreshState().catch(() => null);
  if (!state?.started && !state?.running) {
    await claude.startSession().catch(() => null);
    state = await fetchClaudeState().catch(() => state);
  }

  let probe = await fetchInitialStreamProbe().catch(() => null);
  const hasStreamOutput = !!(probe && (Number(probe?.nextOffset || 0) > 0 || String(probe?.chunk || '').length > 0));
  if (state?.running && !hasStreamOutput) {
    renderStateChrome(refs, state, { recovering: true, streamBytes: 0 });
    await claude.restartSession().catch(() => null);
    state = await fetchClaudeState().catch(() => state);
    probe = await fetchInitialStreamProbe().catch(() => probe);
  }

  renderStateChrome(refs, state, {
    streamBytes: Number(probe?.nextOffset || 0),
  });

  return { state, probe };
}

async function bootstrap() {
  const rootEl = document.getElementById('app');
  const refs = createMinimalClaudePage(rootEl);
  const claude = createClaudeCodeController(refs);
  claude.bind();

  refs?.claudeReconnectBtnEl?.addEventListener('click', async () => {
    renderStateChrome(refs, await fetchClaudeState().catch(() => null), { recovering: true });
    await claude.restartSession().catch(() => null);
    await ensureUsableClaudeSession(claude, refs);
  });

  refs?.claudeClearBtnEl?.addEventListener('click', () => {
    window.location.assign(`/?t=${Date.now()}`);
  });

  await ensureUsableClaudeSession(claude, refs);

  window.setInterval(async () => {
    const next = await fetchClaudeState().catch(() => null);
    renderStateChrome(refs, next);
  }, 1500);

  if (typeof window !== 'undefined') {
    window.__VIO_LOADED__ = true;
    window.__VIO_DEBUG__ = { claude };
  }
}

bootstrap().catch(error => {
  const rootEl = document.getElementById('app');
  if (rootEl) {
    rootEl.innerHTML = `<pre style="padding:16px;color:#ff8cb8;white-space:pre-wrap;">Bootstrap failed: ${String(error?.message || error)}</pre>`;
  }
});
