import { enableLayoutResize } from './runtime/src/modules/workspace-support/layout-resize.js';
import { attachRunEventStream } from './runtime/src/app/bootstrap/bootstrap-event-stream.js';
import { bootstrapInitialSessionSelection, bootstrapMessageRuntime } from './runtime/src/app/bootstrap/bootstrap-message-runtime.js';
import { bootstrapWorkspaceShell } from './runtime/src/app/bootstrap/bootstrap-workspace-shell.js';
import { createPageShell, renderBootError, renderPreviewPlaceholder } from './runtime/src/modules/phase1/page-shell/index.js';

const rootEl = document.getElementById('app');

async function bootstrap() {
  const refs = createPageShell(rootEl);
  enableLayoutResize({ root: document.documentElement });
  renderPreviewPlaceholder(refs, {
    title: 'Flow preview',
    text: 'Loading session shell…',
  });

  const { flow, shell } = bootstrapMessageRuntime(refs);
  attachRunEventStream(flow, shell);
  await bootstrapWorkspaceShell(refs);
  await bootstrapInitialSessionSelection(refs, flow);
  window.__VIO_LOADED__ = true;
}

bootstrap().catch(error => {
  renderBootError(rootEl, error);
});
