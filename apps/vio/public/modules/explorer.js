async function readJsonOrThrow(url, init = undefined, fallbackError = 'request failed') {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {throw new Error(data?.error || fallbackError);}
  return data;
}

export function createExplorerController(refs, options = {}) {
  const state = {
    currentDir: '.',
    selectedEntryPath: '',
    lastVisitedDirs: [],
    entries: [],
  };

  const callbacks = {
    onFileSelected: typeof options?.onFileSelected === 'function' ? options.onFileSelected : null,
    canNavigateAway: typeof options?.canNavigateAway === 'function' ? options.canNavigateAway : null,
    onStatus: typeof options?.onStatus === 'function' ? options.onStatus : null,
  };

  function emitStatus(text, extra = {}) {
    callbacks.onStatus?.(text, extra);
  }

  function canNavigateAway() {
    return callbacks.canNavigateAway ? callbacks.canNavigateAway() !== false : true;
  }

  function syncNavButtons() {
    if (refs?.fileBackBtnEl) {refs.fileBackBtnEl.disabled = state.currentDir === '.';}
    if (refs?.fileForwardBtnEl) {refs.fileForwardBtnEl.disabled = state.lastVisitedDirs.length === 0;}
  }

  function setDirLabel() {
    if (refs?.fileBrowserRootEl) {refs.fileBrowserRootEl.textContent = state.currentDir;}
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
        item.addEventListener('click', async () => {
          if (!canNavigateAway()) {return;}
          state.selectedEntryPath = entry.path;
          renderTree(state.entries);
          const accepted = await callbacks.onFileSelected?.(entry.path);
          if (accepted === false) {
            state.selectedEntryPath = '';
            renderTree(state.entries);
          }
        });
      } else {
        item.addEventListener('click', () => openDirectory(entry.path));
      }
      refs.fileTreeEl.appendChild(item);
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
    if (!canNavigateAway()) {return;}
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
    emitStatus(`Opened in Finder: ${data.dir || state.currentDir}`);
  }

  function goParentDirectory() {
    if (state.currentDir === '.') {return;}
    if (!canNavigateAway()) {return;}
    const parent = state.currentDir.includes('/') ? state.currentDir.split('/').slice(0, -1).join('/') : '.';
    if (state.currentDir) {state.lastVisitedDirs.push(state.currentDir);}
    void loadFileTree(parent || '.');
  }

  function goForwardDirectory() {
    if (!canNavigateAway()) {return;}
    const next = state.lastVisitedDirs.pop();
    if (!next) {return;}
    void loadFileTree(next);
  }

  function bind() {
    refs?.openDirBtnEl?.addEventListener('click', () => {
      void openCurrentDirectoryInFinder().catch(error => emitStatus(error.message || String(error)));
    });
    refs?.fileRefreshBtnEl?.addEventListener('click', () => {
      void loadFileTree(state.currentDir);
    });
    refs?.fileBackBtnEl?.addEventListener('click', () => goParentDirectory());
    refs?.fileForwardBtnEl?.addEventListener('click', () => goForwardDirectory());
  }

  function getState() {
    return { ...state };
  }

  return {
    bind,
    loadFileTree,
    openDirectory,
    getState,
  };
}
