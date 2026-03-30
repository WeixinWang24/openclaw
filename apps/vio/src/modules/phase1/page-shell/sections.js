export function renderTopbarSection() {
  return `
      <header class="topbar card cyan">
        <div class="topbar-main">
          <div class="brand">
            <div class="brand-mark">V</div>
            <div class="brand-text">
              <h1>Vio Dashboard</h1>
              <p>Gateway chat · reset shell on old VioDashboard layout</p>
            </div>
          </div>
          <div class="topbar-right">
            <button id="runModeChip" type="button" class="chip mode-chip state-idle">mode: source</button>
            <div id="session-status-chip" class="chip live">runtime: booting</div>
            <div id="routing" class="chip">routing: live</div>
          </div>
        </div>
      </header>
  `;
}

export function renderRightRailSection() {
  return `
      <div class="resizer vertical" data-resize="right" title="拖动调整右侧宽度"></div>

      <section class="right panel-shell compact-rail">
        <section class="card section compact-rail-card system-core-card">
          <div class="section-header compact compact-rail-header">
            <h2 class="section-title">System</h2>
            <div class="chip">rewire</div>
          </div>
          <div class="status-list compact-event-list">
            <div class="agent-row"><div class="agent-left"><span class="dot status-runtime"></span><div class="agent-meta"><div class="agent-name semantic-label">Runtime</div><div id="runtime-session-summary" class="agent-sub semantic-value">No active session.</div></div></div></div>
            <div class="agent-row"><div class="agent-left"><span class="dot status-link"></span><div class="agent-meta"><div class="agent-name semantic-label">Active run</div><div id="runtime-run-summary" class="agent-sub semantic-value">No active run.</div></div></div></div>
          </div>
        </section>

        <section class="card section compact-rail-card system-context-card">
          <div class="section-header compact compact-rail-header">
            <h2 class="section-title">Debug</h2>
          </div>
          <div class="event-list compact-event-list">
            <div class="event-row"><div class="event-meta"><div class="event-name semantic-label">Status</div><div class="event-sub semantic-value">Old VioDashboard shell is now the active front-end baseline for apps/vio.</div></div></div>
            <div class="event-row"><div class="event-meta"><div class="event-name semantic-label">Next</div><div class="event-sub semantic-value">Reconnect sessions, chat send, delta stream, then restore tools progressively.</div></div></div>
          </div>
        </section>
      </section>
  `;
}
