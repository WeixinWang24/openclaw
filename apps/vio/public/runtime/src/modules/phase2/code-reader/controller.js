async function readJsonOrThrow(url, init = undefined, fallbackError = 'request failed') {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {throw new Error(data?.error || fallbackError);}
  return data;
}

export function createCodeReaderController(refs, options = {}) {
  const state = {
    currentFilePath: '',
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
    return /\.md$/i.test(String(filePath || '')) ? 'markdown' : 'plain';
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
      emitStatus(`${state.currentFilePath}${dirtyTag}`, { semanticLabel: 'file' });
    }
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

  function bind() {
    refs?.fileSaveBtnEl?.addEventListener('click', () => {
      void saveCurrentFile().catch(error => emitStatus(error.message || String(error)));
    });
    refs?.fileUndoBtnEl?.addEventListener('click', () => undoCurrentFile());
    refs?.fileEditorEl?.addEventListener('input', () => {
      const currentValue = refs?.fileEditorEl?.value || '';
      markDirty(!!state.currentFilePath && currentValue !== state.currentFileOriginal);
    });
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
