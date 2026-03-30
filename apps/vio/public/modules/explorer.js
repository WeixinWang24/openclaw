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
    lastVisitedDirs: [],
  };

  function syncNavButtons() {
    if (refs?.fileBackBtnEl) {refs.fileBackBtnEl.disabled = state.currentDir === '.';}
    if (refs?.fileForwardBtnEl) {refs.fileForwardBtnEl.disabled = state.lastVisitedDirs.length === 0;}
  }

  function setDirLabel() {
    if (refs?.fileBrowserRootEl) {refs.fileBrowserRootEl.textContent = state.currentDir;}
  }

  function setStatus(text) {
    if (!refs?.activeFilePathEl) {return;}
    refs.activeFilePathEl.innerHTML = `<span class="semantic-value">${String(text || '')}</span>`;
  }

  function renderTree(entries = []) {
    if (!refs?.fileTreeEl) {return;}
    refs.fileTreeEl.innerHTML = '';
    for (const entry of entries) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `file-tree-item ${entry.type}`;
      item.textContent = entry.name || entry.path;
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

  async function loadFile(relPath) {
    if (!refs?.fileEditorEl || !refs?.activeFilePathEl) {return;}
    const dir = relPath.includes('/') ? relPath.split('/').slice(0, -1).join('/') : '.';
    if (dir !== state.currentDir) {await loadFileTree(dir || '.');}
    state.currentFilePath = relPath;
    refs.activeFilePathEl.innerHTML = `<span class="semantic-label">file</span> <span class="semantic-value">${relPath}</span>`;
    refs.fileEditorEl.value = 'Loading...';
    try {
      const data = await readJsonOrThrow(`/api/file?path=${encodeURIComponent(relPath)}`, undefined, 'file load failed');
      state.currentFileOriginal = typeof data.content === 'string' ? data.content : '';
      refs.fileEditorEl.value = state.currentFileOriginal;
    } catch (error) {
      refs.fileEditorEl.value = `Failed to load file:\n${error.message || error}`;
    }
  }

  async function loadFileTree(dir = state.currentDir) {
    if (!refs?.fileTreeEl) {return;}
    refs.fileTreeEl.innerHTML = '<div class="event-sub"><span class="semantic-value">Loading files...</span></div>';
    try {
      const data = await readJsonOrThrow(`/api/files?dir=${encodeURIComponent(dir)}`, undefined, 'file list failed');
      state.currentDir = data.currentDir || '.';
      setDirLabel();
      renderTree(data.entries || []);
      syncNavButtons();
    } catch (error) {
      refs.fileTreeEl.innerHTML = `<div class="event-sub"><span class="semantic-value">${error.message || error}</span></div>`;
    }
  }

  function openDirectory(dirPath) {
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
    setStatus(`Saved: ${state.currentFilePath}`);
    await loadFileTree(state.currentDir);
  }

  function undoCurrentFile() {
    if (!refs?.fileEditorEl) {return;}
    refs.fileEditorEl.value = state.currentFileOriginal || '';
  }

  function goParentDirectory() {
    if (state.currentDir === '.') {return;}
    const parent = state.currentDir.includes('/') ? state.currentDir.split('/').slice(0, -1).join('/') : '.';
    if (state.currentDir) {state.lastVisitedDirs.push(state.currentDir);}
    void loadFileTree(parent || '.');
  }

  function goForwardDirectory() {
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
