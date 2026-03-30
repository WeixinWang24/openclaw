export function createExplorerModuleSpec() {
  return {
    id: 'explorer',
    status: 'active',
    owns: [
      'workspace explorer surface',
      'tree/data loading boundary',
      'explorer-to-codeview selection bridge',
    ],
  };
}

export { createExplorerController } from './controller.js';
