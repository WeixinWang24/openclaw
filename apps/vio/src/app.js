import { enableLayoutResize } from './modules/workspace-support/layout-resize.js';
import { attachRunEventStream } from './app/bootstrap/bootstrap-event-stream.js';
import { bootstrapInitialSessionSelection, bootstrapMessageRuntime } from './app/bootstrap/bootstrap-message-runtime.js';
import { bootstrapWorkspaceShell } from './app/bootstrap/bootstrap-workspace-shell.js';
import { createPageLayout, renderPageBootError, renderPreviewPlaceholder } from './modules/phase1/page-shell/index.js';

const rootEl = document.getElementById('app');

async function bootstrap() {
  const refs = createPageLayout(rootEl);
  enableLayoutResize({ root: document.documentElement });
  renderPreviewPlaceholder(refs?.message, {
    title: 'Flow preview',
    text: 'Loading session shell…',
  });

  const { flow, shell } = bootstrapMessageRuntime(refs?.message);
  attachRunEventStream(flow, shell);
  await bootstrapWorkspaceShell(refs?.workspace);
  await bootstrapInitialSessionSelection(refs?.message, flow);
  window.__VIO_LOADED__ = true;
}

bootstrap().catch(error => {
  renderPageBootError(rootEl, error);
});
