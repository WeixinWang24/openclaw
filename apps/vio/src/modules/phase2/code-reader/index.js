export function createCodeReaderModuleSpec() {
  return {
    id: 'code-reader',
    status: 'active',
    owns: [
      'current-file content loading',
      'codeview display boundary',
      'editor-state and dirty-state semantics',
      'save and undo behavior for the current file',
    ],
  };
}

export { createCodeReaderController } from './controller.js';
