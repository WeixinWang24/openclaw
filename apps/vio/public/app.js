import { createClaudeCodeController } from './runtime/src/modules/phase2/claude-code/controller.js';

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
          </div>
        </div>
      </header>

      <main class="main panel-shell" style="grid-area:main;min-height:0;">
        <section class="card section workspace-panel" style="height:100%;">
          <section id="claudeCodePanel" class="section claude-code-panel vio-unified-workspace-card claude-code-terminal-layout" style="padding:0;min-height:0;height:100%;">
            <div class="section-header claude-code-chrome" style="padding:14px 16px 0;">
              <h3 class="section-title">Claude Code</h3>
              <div class="pane-actions claude-code-chrome-actions">
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
    claudeTerminalHostEl: document.getElementById('claudeTerminalHost'),
    claudeCodeInputEl: document.getElementById('claudeCodeInput'),
    claudeComposerStatusEl: document.getElementById('claudeComposerStatus'),
    claudeCodeStartBtnEl: document.getElementById('claudeCodeStartBtn'),
    claudeCodeStopBtnEl: document.getElementById('claudeCodeStopBtn'),
    claudeCodeRestartBtnEl: document.getElementById('claudeCodeRestartBtn'),
    claudeCodeSendBtnEl: document.getElementById('claudeCodeSendBtn'),
  };
}

async function bootstrap() {
  const rootEl = document.getElementById('app');
  const refs = createMinimalClaudePage(rootEl);
  const claude = createClaudeCodeController(refs);
  claude.bind();
  const initialState = await claude.refreshState().catch(() => null);
  if (!initialState?.started && !initialState?.running) {
    await claude.startSession().catch(() => null);
  }
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
