import { createWorkspaceShellRefs } from '../../modules/phase1/page-shell/index.js';
import { createCodeReaderController } from '../../modules/phase2/code-reader/controller.js';
import { createExplorerController } from '../../modules/phase2/explorer/controller.js';

export function createExplorerStatusSetter(refs) {
  return function setExplorerStatus(text, extra = {}) {
    if (!refs?.activeFilePathEl) {return;}
    if (extra?.semanticLabel) {
      refs.activeFilePathEl.innerHTML = `<span class="semantic-label">${String(extra.semanticLabel)}</span> <span class="semantic-value">${String(text || '')}</span>`;
      return;
    }
    refs.activeFilePathEl.innerHTML = `<span class="semantic-value">${String(text || '')}</span>`;
  };
}

export async function bootstrapWorkspaceShell(refs) {
  void refs;
  const workspaceRefs = createWorkspaceShellRefs();
  const setExplorerStatus = createExplorerStatusSetter(workspaceRefs);

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

  return {
    codeReader,
    explorer,
    setExplorerStatus,
  };
}
