const STORAGE_KEY = 'vio.phase1.layout.v2';

const DEFAULTS = {
  sidebarW: 280,
  rightbarW: 360,
  workspaceSplit: 0.5,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readSaved() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {return { ...DEFAULTS };}
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveLayout(state) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function applyLayout(root, state) {
  if (!root) {return;}
  root.style.setProperty('--sidebar-w', `${Math.round(state.sidebarW)}px`);
  root.style.setProperty('--rightbar-w', `${Math.round(state.rightbarW)}px`);
  root.style.setProperty('--workspace-left', `${Number(state.workspaceSplit).toFixed(4)}fr`);
  root.style.setProperty('--workspace-right', `${Number(1 - state.workspaceSplit).toFixed(4)}fr`);
}

export function enableLayoutResize({ root = document.documentElement } = {}) {
  const state = readSaved();
  applyLayout(root, state);

  let rafId = 0;

  function scheduleApply() {
    if (rafId) {return;}
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      applyLayout(root, state);
    });
  }

  function bindPointerDrag(element, onMove, onEnd) {
    if (!element) {return;}
    element.addEventListener('pointerdown', event => {
      event.preventDefault();
      element.setPointerCapture?.(event.pointerId);

      const startX = event.clientX;
      const startY = event.clientY;
      const snapshot = { ...state };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = element.style.cursor || (element.classList.contains('vertical') ? 'col-resize' : 'row-resize');

      function handleMove(moveEvent) {
        moveEvent.preventDefault();
        onMove({
          startX,
          startY,
          snapshot,
          currentX: moveEvent.clientX,
          currentY: moveEvent.clientY,
          deltaX: moveEvent.clientX - startX,
          deltaY: moveEvent.clientY - startY,
        });
        scheduleApply();
      }

      function handleEnd() {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleEnd);
        window.removeEventListener('pointercancel', handleEnd);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        saveLayout(state);
        onEnd?.(state);
      }

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleEnd, { once: true });
      window.addEventListener('pointercancel', handleEnd, { once: true });
    });
  }

  const sidebarResizer = document.querySelector('.resizer[data-resize="sidebar"]');
  const rightResizer = document.querySelector('.resizer[data-resize="right"]');
  const workspaceResizer = document.querySelector('.split-resizer[data-resize="workspace"]');
  const workspaceSplit = document.getElementById('workspaceSplit');

  bindPointerDrag(sidebarResizer, ({ snapshot, deltaX }) => {
    state.sidebarW = clamp(snapshot.sidebarW + deltaX, 200, 520);
  });

  bindPointerDrag(rightResizer, ({ snapshot, deltaX }) => {
    state.rightbarW = clamp(snapshot.rightbarW - deltaX, 220, 520);
  });

  bindPointerDrag(workspaceResizer, ({ currentX }) => {
    if (!workspaceSplit) {return;}
    const rect = workspaceSplit.getBoundingClientRect();
    const x = clamp(currentX - rect.left, 200, rect.width - 200);
    state.workspaceSplit = Number((x / rect.width).toFixed(4));
  });

  saveLayout(state);
  const dashboard = document.querySelector('.dashboard.ide-layout');
  if (dashboard) {dashboard.dataset.resizeReady = 'true';}
  return {
    getState() {
      return { ...state };
    },
    reset() {
      Object.assign(state, DEFAULTS);
      applyLayout(root, state);
      saveLayout(state);
    },
  };
}
