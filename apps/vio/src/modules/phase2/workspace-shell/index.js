import { renderMessageRuntimeFrame } from '../../phase1/message-shell/frame.js';

export function createWorkspaceShellRefs() {
  return {
    openDirBtnEl: document.getElementById('openDirBtn'),
    fileBackBtnEl: document.getElementById('fileBackBtn'),
    fileForwardBtnEl: document.getElementById('fileForwardBtn'),
    fileRefreshBtnEl: document.getElementById('fileRefreshBtn'),
    fileBrowserRootEl: document.getElementById('fileBrowserRoot'),
    fileTreeEl: document.getElementById('fileTree'),
    activeFilePathEl: document.getElementById('activeFilePath'),
    fileUndoBtnEl: document.getElementById('fileUndoBtn'),
    fileSaveBtnEl: document.getElementById('fileSaveBtn'),
    fileModeBadgeEl: document.getElementById('fileModeBadge'),
    fileEditorEl: document.getElementById('fileEditor'),
    fileMarkdownPreviewEl: document.getElementById('fileMarkdownPreview'),
    markdownSplitShellEl: document.getElementById('markdownSplitShell'),
    markdownSplitResizerEl: document.getElementById('markdownSplitResizer'),
    workspaceCodeActionsEl: document.getElementById('workspaceCodeActions'),
    claudeCodePanelEl: document.getElementById('claudeCodePanel'),
    claudeCodeStatusEl: document.getElementById('claudeCodeStatus'),
    claudeCodeOutputEl: document.getElementById('claudeCodeOutput'),
    claudeCodeInputEl: document.getElementById('claudeCodeInput'),
    claudeCodeStartBtnEl: document.getElementById('claudeCodeStartBtn'),
    claudeCodeStopBtnEl: document.getElementById('claudeCodeStopBtn'),
    claudeCodeRestartBtnEl: document.getElementById('claudeCodeRestartBtn'),
    claudeCodeSendBtnEl: document.getElementById('claudeCodeSendBtn'),
  };
}

export function createWorkspaceStatusSetter(refs) {
  return function setWorkspaceStatus(text, extra = {}) {
    if (!refs?.activeFilePathEl) {return;}
    if (extra?.semanticLabel) {
      refs.activeFilePathEl.innerHTML = `<span class="semantic-label">${String(extra.semanticLabel)}</span> <span class="semantic-value">${String(text || '')}</span>`;
      return;
    }
    refs.activeFilePathEl.innerHTML = `<span class="semantic-value">${String(text || '')}</span>`;
  };
}

export function renderWorkspaceShell() {
  return `
      <aside class="sidebar panel-shell">
        <section class="card section explorer-shell">
          <div class="section-header">
            <h2 class="section-title">Explorer</h2>
            <button id="openDirBtn" type="button" class="chip state-idle">files</button>
          </div>
          <section class="file-browser-panel explorer-pane">
            <div class="explorer-toolbar">
              <button id="fileBackBtn" type="button" class="chip state-idle">↑</button>
              <button id="fileForwardBtn" type="button" class="chip state-idle">↩</button>
              <button id="fileRefreshBtn" type="button" class="chip state-idle">⟳</button>
              <div class="event-sub"><span class="semantic-label">dir</span> <span id="fileBrowserRoot" class="semantic-value">.</span></div>
            </div>
            <div id="fileTree" class="file-tree"></div>
          </section>
        </section>
      </aside>

      <div class="resizer vertical" data-resize="sidebar" title="拖动调整左侧宽度"></div>

      <main class="main panel-shell">
        <section class="card section workspace-panel">
          <div class="section-header interaction-header">
            <div class="interaction-header-top">
              <h2 class="section-title">INTERACTION</h2>
              <label class="chip state-idle history-window-chip" for="history-window-select">
                <span>history</span>
                <select id="history-window-select" class="history-window-select">
                  <option value="3">3</option>
                  <option value="7" selected>7</option>
                  <option value="15">15</option>
                </select>
              </label>
            </div>
            <div class="interaction-header-right">
              <div class="workspace-view-tabs workspace-view-tabs-inline" role="tablist" aria-label="Unified workspace views">
                <button type="button" class="console-tab is-active" role="tab" aria-selected="true">VIEWER</button>
                <button type="button" class="console-tab" role="tab" aria-selected="false">Replies</button>
                <button type="button" class="console-tab" role="tab" aria-selected="false">Terminal</button>
                <button type="button" class="console-tab" role="tab" aria-selected="false">Code</button>
              </div>
              <div id="sessions-list" class="sessions-list sessions-list-inline"></div>
              <button id="refresh-session-btn" type="button" class="chip state-idle">refresh</button>
            </div>
          </div>

          <div class="workspace-split" id="workspaceSplit">
            <section class="editor-stack" id="editorStack">
              <section class="file-editor-pane vio-unified-workspace-page">
                <div class="workspace-view-stack">
                  <div class="workspace-view-pane is-active">
                    <div class="editor-shell markdown-split-shell" id="markdownSplitShell" data-mode="plain">
                      <div id="fileMarkdownPreview" class="file-markdown-preview" hidden></div>
                      <div class="markdown-split-resizer" id="markdownSplitResizer" title="拖动调整预览/源码比例" hidden></div>
                      <textarea id="fileEditor" class="file-editor" spellcheck="false" placeholder="Project file preview / edit area"></textarea>
                    </div>
                  </div>
                </div>
                <div class="pane-header workspace-view-header workspace-view-toolbar-bottom">
                  <div class="viewer-toolbar-shell" id="workspaceCodeActions">
                    <div class="viewer-toolbar-left">
                      <div id="fileModeBadge" class="chip state-idle">plain</div>
                    </div>
                    <div class="viewer-toolbar-right">
                      <button id="fileUndoBtn" type="button" class="chip state-idle">undo</button>
                      <button id="fileSaveBtn" type="button" class="chip state-idle">save</button>
                    </div>
                  </div>
                </div>
                <div class="pane-header workspace-view-header workspace-view-footer">
                  <div class="pane-actions">
                    <div id="activeFilePath" class="event-sub"><span class="semantic-value">Select a file from Explorer</span></div>
                  </div>
                </div>

                <section id="claudeCodePanel" class="card section claude-code-panel">
                  <div class="section-header">
                    <h3 class="section-title">Claude Code</h3>
                    <div id="claudeCodeStatus" class="event-sub"><span class="semantic-value">idle</span></div>
                  </div>
                  <pre id="claudeCodeOutput" class="claude-code-output"></pre>
                  <textarea id="claudeCodeInput" class="file-editor claude-code-input" spellcheck="false" placeholder="Send input to Claude Code"></textarea>
                  <div class="pane-actions">
                    <button id="claudeCodeStartBtn" type="button" class="chip state-idle">start</button>
                    <button id="claudeCodeStopBtn" type="button" class="chip state-idle">stop</button>
                    <button id="claudeCodeRestartBtn" type="button" class="chip state-idle">restart</button>
                    <button id="claudeCodeSendBtn" type="button" class="chip state-idle">send</button>
                  </div>
                </section>
              </section>
            </section>

            <div class="resizer split-resizer" data-resize="workspace" title="拖动调整编辑器/聊天比例"></div>

${renderMessageRuntimeFrame()}
          </div>
        </section>
      </main>
  `;
}
