import { createWorkspaceShellRefs, createWorkspaceStatusSetter } from '../../modules/phase2/workspace-shell/index.js';
import { createCodeReaderController } from '../../modules/phase2/code-reader/controller.js';
import { createExplorerController } from '../../modules/phase2/explorer/controller.js';
import { createClaudeCodeController } from '../../modules/phase2/claude-code/controller.js';

function bindWorkspaceViewTabs(workspaceRefs) {
  const tabEls = Array.isArray(workspaceRefs?.workspaceViewTabEls) ? workspaceRefs.workspaceViewTabEls : [];
  const paneEls = Array.isArray(workspaceRefs?.workspaceViewPaneEls) ? workspaceRefs.workspaceViewPaneEls : [];

  function selectView(viewId = 'viewer') {
    for (const tabEl of tabEls) {
      const active = tabEl?.dataset?.workspaceView === viewId;
      tabEl.classList.toggle('is-active', active);
      tabEl.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    for (const paneEl of paneEls) {
      const active = paneEl?.dataset?.workspacePane === viewId;
      paneEl.classList.toggle('is-active', active);
    }
  }

  for (const tabEl of tabEls) {
    tabEl.addEventListener('click', () => {
      selectView(tabEl?.dataset?.workspaceView || 'viewer');
    });
  }

  selectView('code');

  return { selectView };
}

async function ensureUsableClaudeSession(claudeCode) {
  let state = await claudeCode.refreshState().catch(() => null);
  if (!state?.started && !state?.running) {
    await claudeCode.startSession().catch(() => null);
    state = await claudeCode.refreshState().catch(() => state);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await new Promise(resolve => window.setTimeout(resolve, attempt === 0 ? 120 : 320));
    state = await claudeCode.refreshState().catch(() => state);
    const probe = await claudeCode.probeInitialTerminalStream?.().catch(() => null);
    const hasStreamOutput = !!(probe && (Number(probe?.nextOffset || 0) > 0 || String(probe?.chunk || '').length > 0));
    const hasLiveChild = !!state?.childPid;
    if (hasStreamOutput || hasLiveChild) {
      return state;
    }
    await claudeCode.restartSession().catch(() => null);
  }

  return state;
}

export async function bootstrapWorkspaceShell(refs) {
  const workspaceRefs = refs || createWorkspaceShellRefs();
  const setExplorerStatus = createWorkspaceStatusSetter(workspaceRefs);
  const workspaceViews = bindWorkspaceViewTabs(workspaceRefs);

  const codeReader = createCodeReaderController(workspaceRefs, {
    onStatus: setExplorerStatus,
  });
  codeReader.bind();

  const explorer = createExplorerController(workspaceRefs, {
    onStatus: setExplorerStatus,
    canNavigateAway: () => codeReader.confirmDiscardIfDirty(),
    onFileSelected: async relPath => await codeReader.loadFile(relPath),
  });
  explorer.bind();
  await explorer.loadFileTree('.');

  const claudeCode = createClaudeCodeController(workspaceRefs);
  claudeCode.bind();
  await ensureUsableClaudeSession(claudeCode);

  if (typeof window !== 'undefined') {
    window.__VIO_WORKSPACE_VIEWS__ = workspaceViews;
  }

  return {
    codeReader,
    explorer,
    claudeCode,
    setExplorerStatus,
    workspaceViews,
  };
}
