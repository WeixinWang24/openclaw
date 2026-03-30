async function readJsonOrThrow(url, init = undefined, fallbackError = 'request failed') {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {throw new Error(data?.error || fallbackError);}
  return data;
}

export function createExplorerController(refs) {
  const state = {
    currentDir: '.',
    currentFilePath: '',
    currentFileOriginal: '',
    currentFileDirty: false,
    currentFileLoading: false,
    selectedEntryPath: '',
    lastVisitedDirs: [],
    entries: [],
  };

  function syncNavButtons() {
    if (refs?.fileBackBtnEl) {refs.fileBackBtnEl.disabled = state.currentDir === '.';}
    if (refs?.fileForwardBtnEl) {refs.fileForwardBtnEl.disabled = state.lastVisitedDirs.length === 0;}
  }

  function detectMode(filePath = '') {
    return /\.md$/i.test(String(filePath || '')) ? 'markdown' : 'plain';
  }

  function setDirLabel() {
    if (refs?.fileBrowserRootEl) {refs.fileBrowserRootEl.textContent = state.currentDir;}
  }

  function setStatus(text, { semanticLabel = null } = {}) {
    if (!refs?.activeFilePathEl) {return;}
    if (semanticLabel) {
      const labelText = String(semanticLabel);
      refs.activeFilePathEl.innerHTML = `<span class="semantic-label">${labelText}</span> <span class="semantic-value">${String(text || '')}</span>`;
      return;
    }
    refs.activeFilePathEl.innerHTML = `<span class="semantic-value">${String(text || '')}</span>`;
  }

  function syncEditorChrome() {
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
      setStatus(`${state.currentFilePath}${dirtyTag}`, { semanticLabel: 'file' });
    }
  }

  function markDirty(isDirty) {
    state.currentFileDirty = !!isDirty;
    syncEditorChrome();
  }

  function renderTree(entries = []) {
    if (!refs?.fileTreeEl) {return;}
    refs.fileTreeEl.innerHTML = '';
    for (const entry of entries) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `file-tree-item ${entry.type}`;
      item.textContent = entry.name || entry.path;
      item.dataset.selected = entry.path === state.selectedEntryPath ? 'true' : 'false';
      if (entry.type === 'file') {
        item.addEventListener('click', () => {
          void loadFile(entry.path);
        });
      } else {
        item.addEventListener('click', () => openDirectory(entry.path));
      }
      refs.fileTreeEl.appendChild(item);
    }
  }

  function confirmDiscardIfDirty() {
    if (!state.currentFileDirty) {return true;}
    return window.confirm('Current file has unsaved changes. Discard them?');
  }

  async function loadFile(relPath) {
    if (!refs?.fileEditorEl || !refs?.activeFilePathEl) {return;}
    if (state.currentFilePath !== relPath && !confirmDiscardIfDirty()) {return;}
    const dir = relPath.includes('/') ? relPath.split('/').slice(0, -1).join('/') : '.';
    if (dir !== state.currentDir) {await loadFileTree(dir || '.');}
    state.currentFilePath = relPath;
    state.selectedEntryPath = relPath;
    state.currentFileLoading = true;
    markDirty(false);
    refs.fileEditorEl.value = 'Loading...';
    syncEditorChrome();
    try {
      const data = await readJsonOrThrow(`/api/file?path=${encodeURIComponent(relPath)}`, undefined, 'file load failed');
      state.currentFileOriginal = typeof data.content === 'string' ? data.content : '';
      refs.fileEditorEl.value = state.currentFileOriginal;
      state.currentFileLoading = false;
      markDirty(false);
      renderTree(state.entries);
    } catch (error) {
      state.currentFileLoading = false;
      refs.fileEditorEl.value = `Failed to load file:\n${error.message || error}`;
      setStatus(error.message || String(error));
      syncEditorChrome();
    }
  }

  async function loadFileTree(dir = state.currentDir) {
    if (!refs?.fileTreeEl) {return;}
    refs.fileTreeEl.innerHTML = '<div class="event-sub"><span class="semantic-value">Loading files...</span></div>';
    try {
      const data = await readJsonOrThrow(`/api/files?dir=${encodeURIComponent(dir)}`, undefined, 'file list failed');
      state.currentDir = data.currentDir || '.';
      state.entries = Array.isArray(data.entries) ? data.entries : [];
      setDirLabel();
      renderTree(state.entries);
      syncNavButtons();
    } catch (error) {
      refs.fileTreeEl.innerHTML = `<div class="event-sub"><span class="semantic-value">${error.message || error}</span></div>`;
    }
  }

  function openDirectory(dirPath) {
    if (!confirmDiscardIfDirty()) {return;}
    state.selectedEntryPath = dirPath;
    if (state.currentDir && state.currentDir !== dirPath) {state.lastVisitedDirs.push(state.currentDir);}
    void loadFileTree(dirPath);
  }

  async function openCurrentDirectoryInFinder() {
    const data = await readJsonOrThrow('/api/explorer/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir: state.currentDir || '.' }),
    }, 'open directory failed');
    setStatus(`Opened in Finder: ${data.dir || state.currentDir}`);
  }

  async function saveCurrentFile() {
    if (!state.currentFilePath || !refs?.fileEditorEl) {return;}
    await readJsonOrThrow('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: state.currentFilePath, content: refs.fileEditorEl.value }),
    }, 'save failed');
    state.currentFileOriginal = refs.fileEditorEl.value;
    markDirty(false);
    setStatus(`Saved: ${state.currentFilePath}`);
    await loadFileTree(state.currentDir);
  }

  function undoCurrentFile() {
    if (!refs?.fileEditorEl) {return;}
    refs.fileEditorEl.value = state.currentFileOriginal || '';
    markDirty(false);
  }

  function goParentDirectory() {
    if (state.currentDir === '.') {return;}
    if (!confirmDiscardIfDirty()) {return;}
    const parent = state.currentDir.includes('/') ? state.currentDir.split('/').slice(0, -1).join('/') : '.';
    if (state.currentDir) {state.lastVisitedDirs.push(state.currentDir);}
    void loadFileTree(parent || '.');
  }

  function goForwardDirectory() {
    if (!confirmDiscardIfDirty()) {return;}
    const next = state.lastVisitedDirs.pop();
    if (!next) {return;}
    void loadFileTree(next);
  }

  function bind() {
    refs?.openDirBtnEl?.addEventListener('click', () => {
      void openCurrentDirectoryInFinder().catch(error => setStatus(error.message || String(error)));
    });
    refs?.fileRefreshBtnEl?.addEventListener('click', () => {
      void loadFileTree(state.currentDir);
    });
    refs?.fileBackBtnEl?.addEventListener('click', () => goParentDirectory());
    refs?.fileForwardBtnEl?.addEventListener('click', () => goForwardDirectory());
    refs?.fileSaveBtnEl?.addEventListener('click', () => {
      void saveCurrentFile().catch(error => setStatus(error.message || String(error)));
    });
    refs?.fileUndoBtnEl?.addEventListener('click', () => undoCurrentFile());
    refs?.fileEditorEl?.addEventListener('input', () => {
      const currentValue = refs?.fileEditorEl?.value || '';
      markDirty(state.currentFilePath && currentValue !== state.currentFileOriginal);
    });
    syncEditorChrome();
  }

  return {
    bind,
    loadFileTree,
    loadFile,
    openDirectory,
    getState() {
      return { ...state };
    },
  };
}
