export function createCodeReaderModuleSeed() {
  return {
    id: 'code-reader',
    status: 'seed',
    owns: [
      'current-file content loading',
      'current-file display boundary',
      'editor-state and dirty-state semantics',
      'save and undo behavior for the current file',
    ],
  };
}

export { createCodeReaderController } from './controller.js';
