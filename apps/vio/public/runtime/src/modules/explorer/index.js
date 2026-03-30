export function createExplorerModuleSeed() {
  return {
    id: 'explorer',
    status: 'seed',
    owns: [
      'left-side Explorer shell',
      'tree/data loading boundary',
      'explorer-to-workspace selection bridge',
    ],
  };
}
