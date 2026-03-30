import { createWorkspaceShellRefs, createWorkspaceStatusSetter } from '../../modules/phase2/workspace-shell/index.js';
import { createCodeReaderController } from '../../modules/phase2/code-reader/controller.js';
import { createExplorerController } from '../../modules/phase2/explorer/controller.js';

export async function bootstrapWorkspaceShell(refs) {
  const workspaceRefs = refs || createWorkspaceShellRefs();
  const setExplorerStatus = createWorkspaceStatusSetter(workspaceRefs);

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
