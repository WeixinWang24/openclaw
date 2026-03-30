import { createCodeReaderController } from '../../modules/workspace-support/code-reader.js';
import { createExplorerController } from '../../modules/workspace-support/explorer.js';

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
  const setExplorerStatus = createExplorerStatusSetter(refs);

  const codeReader = createCodeReaderController(refs, {
    onStatus: setExplorerStatus,
  });
  codeReader.bind();

  const explorer = createExplorerController(refs, {
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
