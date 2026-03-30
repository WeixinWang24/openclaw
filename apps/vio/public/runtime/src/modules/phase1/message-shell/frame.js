export function renderMessageRuntimeFrame() {
  return `
            <section class="chat-pane">
              <div class="chat-stack">
                <div class="chat-shell">
                  <div id="session-preview" class="chat"></div>
                  <div id="slash-command-banner" class="slash-command-banner" hidden></div>
                </div>
                <div class="chat-continue-slot">
                  <button type="button" class="chat-stop-btn" hidden>Stop</button>
                  <div class="chip state-idle stop-status-badge" hidden>Stopped</div>
                  <button type="button" class="chat-continue-fab" disabled>继续</button>
                </div>
                <form id="composer-form" class="composer-panel composer-inline">
                  <div class="section-header compact composer-header">
                    <h2 class="section-title">Input</h2>
                  </div>
                  <div class="composer-shell">
                    <div class="composer-input-stack">
                      <div class="composer-toolbar">
                        <div id="composer-status" class="composer-voice-status">Enter newline · Shift+Enter send</div>
                      </div>
                      <textarea id="composer-input" placeholder="输入消息…" rows="4"></textarea>
                    </div>
                    <button id="composer-send-btn" type="submit" class="send-btn">Send</button>
                  </div>
                </form>
              </div>
            </section>
  `;
}
