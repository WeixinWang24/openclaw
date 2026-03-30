async function readJsonOrThrow(url, init = undefined, fallbackError = 'request failed') {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {throw new Error(data?.error || fallbackError);}
  return data;
}

export function createCodeReaderController(refs, options = {}) {
  const state = {
    currentFilePath: '',
    currentFileAbsolutePath: '',
    currentFileOriginal: '',
    currentFileDirty: false,
    currentFileLoading: false,
  };

  const callbacks = {
    onDirtyChange: typeof options?.onDirtyChange === 'function' ? options.onDirtyChange : null,
    onFileLoaded: typeof options?.onFileLoaded === 'function' ? options.onFileLoaded : null,
    onStatus: typeof options?.onStatus === 'function' ? options.onStatus : null,
  };

  function emitStatus(text, extra = {}) {
    callbacks.onStatus?.(text, extra);
  }

  function detectMode(filePath = '') {
    const value = String(filePath || '');
    if (/\.md$/i.test(value)) {return 'markdown';}
    if (/\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(value)) {return 'javascript';}
    if (/\.py$/i.test(value)) {return 'python';}
    return 'plain';
  }

  function escapeHtml(text = '') {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderMarkdown(text = '') {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    return lines.map(line => {
      if (/^###\s+/.test(line)) {return `<h3>${escapeHtml(line.replace(/^###\s+/, ''))}</h3>`;}
      if (/^##\s+/.test(line)) {return `<h2>${escapeHtml(line.replace(/^##\s+/, ''))}</h2>`;}
      if (/^#\s+/.test(line)) {return `<h1>${escapeHtml(line.replace(/^#\s+/, ''))}</h1>`;}
      if (/^-\s+/.test(line)) {return `<li>${escapeHtml(line.replace(/^-\s+/, ''))}</li>`;}
      if (!line.trim()) {return '<div class="md-spacer"></div>';} 
      return `<p>${escapeHtml(line)}</p>`;
    }).join('');
  }

  function renderHighlightedCode(text = '', mode = 'plain') {
    const escaped = escapeHtml(text)
      .replace(/(\/\/[^\n]*|#[^\n]*)/g, '<span class="tok-comment">$1</span>')
      .replace(/(&quot;[^&]*&quot;|'[^']*')/g, '<span class="tok-string">$1</span>')
      .replace(/\b(function|return|const|let|var|if|else|for|while|class|import|export|from|async|await|def|lambda|True|False|None|try|except)\b/g, '<span class="tok-keyword">$1</span>')
      .replace(/\b([0-9]+)\b/g, '<span class="tok-number">$1</span>');
    return `<pre class="code-preview ${mode}"><code>${escaped}</code></pre>`;
  }

  function syncViewerMode() {
    const mode = detectMode(state.currentFilePath);
    const shellEl = refs?.markdownSplitShellEl;
    const previewEl = refs?.fileMarkdownPreviewEl;
    const resizerEl = refs?.markdownSplitResizerEl;
    if (!shellEl || !previewEl || !resizerEl) {return;}

    shellEl.dataset.mode = mode;
    if (mode === 'markdown' && state.currentFilePath) {
      previewEl.hidden = false;
      resizerEl.hidden = false;
      previewEl.innerHTML = renderMarkdown(refs?.fileEditorEl?.value || '');
      return;
    }

    if ((mode === 'javascript' || mode === 'python') && state.currentFilePath) {
      previewEl.hidden = false;
      resizerEl.hidden = true;
      previewEl.innerHTML = renderHighlightedCode(refs?.fileEditorEl?.value || '', mode);
      return;
    }

    previewEl.hidden = true;
    resizerEl.hidden = true;
    previewEl.innerHTML = '';
  }

  function syncChrome() {
    if (refs?.fileModeBadgeEl) {
      const mode = detectMode(state.currentFilePath);
      refs.fileModeBadgeEl.textContent = state.currentFilePath ? mode : 'plain';
      refs.fileModeBadgeEl.classList.toggle('state-thinking', mode === 'markdown');
      refs.fileModeBadgeEl.classList.toggle('state-idle', mode !== 'markdown');
    }
    if (refs?.fileSaveBtnEl) {
      refs.fileSaveBtnEl.disabled = !state.currentFilePath || !state.currentFileDirty || state.currentFileLoading;
    }
    if (refs?.fileUndoBtnEl) {
      refs.fileUndoBtnEl.disabled = !state.currentFilePath || state.currentFileLoading || (!state.currentFileDirty && !refs?.fileEditorEl?.value);
    }
    if (refs?.fileEditorEl) {
      refs.fileEditorEl.disabled = state.currentFileLoading;
    }
    if (refs?.workspaceCodeActionsEl) {
      refs.workspaceCodeActionsEl.dataset.dirty = state.currentFileDirty ? 'true' : 'false';
    }
    if (state.currentFilePath) {
      const dirtyTag = state.currentFileDirty ? ' *' : '';
      emitStatus(`${state.currentFileAbsolutePath || state.currentFilePath}${dirtyTag}`, { semanticLabel: 'file' });
    }
    syncViewerMode();
  }

  function markDirty(isDirty) {
    state.currentFileDirty = !!isDirty;
    syncChrome();
    callbacks.onDirtyChange?.(state.currentFileDirty, getState());
  }

  function confirmDiscardIfDirty() {
    if (!state.currentFileDirty) {return true;}
    return window.confirm('Current file has unsaved changes. Discard them?');
  }

  async function loadFile(relPath) {
    if (!refs?.fileEditorEl) {return false;}
    if (state.currentFilePath !== relPath && !confirmDiscardIfDirty()) {return false;}
    state.currentFilePath = relPath;
    state.currentFileLoading = true;
    markDirty(false);
    refs.fileEditorEl.value = 'Loading...';
    syncChrome();
    try {
      const data = await readJsonOrThrow(`/api/file?path=${encodeURIComponent(relPath)}`, undefined, 'file load failed');
      state.currentFileAbsolutePath = typeof data.absolutePath === 'string' ? data.absolutePath : relPath;
      state.currentFileOriginal = typeof data.content === 'string' ? data.content : '';
      refs.fileEditorEl.value = state.currentFileOriginal;
      state.currentFileLoading = false;
      markDirty(false);
      callbacks.onFileLoaded?.(relPath, getState());
      return true;
    } catch (error) {
      state.currentFileLoading = false;
      refs.fileEditorEl.value = `Failed to load file:\n${error.message || error}`;
      emitStatus(error.message || String(error));
      syncChrome();
      return false;
    }
  }

  async function saveCurrentFile() {
    if (!state.currentFilePath || !refs?.fileEditorEl) {return false;}
    await readJsonOrThrow('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: state.currentFilePath, content: refs.fileEditorEl.value }),
    }, 'save failed');
    state.currentFileOriginal = refs.fileEditorEl.value;
    markDirty(false);
    emitStatus(`Saved: ${state.currentFilePath}`);
    return true;
  }

  function undoCurrentFile() {
    if (!refs?.fileEditorEl) {return;}
    refs.fileEditorEl.value = state.currentFileOriginal || '';
    markDirty(false);
  }

  function bindMarkdownSplitResizer() {
    const shellEl = refs?.markdownSplitShellEl;
    const resizerEl = refs?.markdownSplitResizerEl;
    if (!shellEl || !resizerEl || shellEl.dataset.resizerBound === 'true') {return;}
    shellEl.dataset.resizerBound = 'true';

    let dragging = false;

    function stopDrag() {
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    function onMove(event) {
      if (!dragging || shellEl.dataset.mode !== 'markdown') {return;}
      const rect = shellEl.getBoundingClientRect();
      const next = Math.max(120, Math.min(rect.height - 120, event.clientY - rect.top));
      shellEl.style.gridTemplateRows = `${next}px 10px minmax(120px, 1fr)`;
    }

    resizerEl.addEventListener('pointerdown', event => {
      if (shellEl.dataset.mode !== 'markdown') {return;}
      dragging = true;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      event.preventDefault();
    });

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stopDrag);
  }

  function bind() {
    refs?.fileSaveBtnEl?.addEventListener('click', () => {
      void saveCurrentFile().catch(error => emitStatus(error.message || String(error)));
    });
    refs?.fileUndoBtnEl?.addEventListener('click', () => undoCurrentFile());
    refs?.fileEditorEl?.addEventListener('input', () => {
      const currentValue = refs?.fileEditorEl?.value || '';
      markDirty(!!state.currentFilePath && currentValue !== state.currentFileOriginal);
    });
    refs?.fileEditorEl?.addEventListener('click', () => syncViewerMode());
    refs?.fileEditorEl?.addEventListener('keyup', () => syncViewerMode());
    bindMarkdownSplitResizer();
    syncChrome();
  }

  function getState() {
    return { ...state };
  }

  return {
    bind,
    loadFile,
    saveCurrentFile,
    undoCurrentFile,
    confirmDiscardIfDirty,
    getState,
  };
}
