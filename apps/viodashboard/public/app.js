// Main browser UI for VioDashboard: chat, telemetry, camera controls, and file browser.
const CLAUDE_TERMINAL_INIT_ERROR = 'Claude terminal failed to initialize; PTY text fallback has been removed.';
const serverConfig = {
  defaultClaudeCwd: '',
  projectRoot: '',
  openclawRepoRoot: '',
  appBaseUrl: '',
  setup: {
    hasLocalConfig: true,
    localConfigPath: '',
    bootstrapCommand: 'node scripts/bootstrap-local-config.mjs',
    bootstrapPreviewCommand: 'node scripts/bootstrap-local-config.mjs --print --yes',
  },
};
const statusEl = document.getElementById('status');
const runModeChipEl = document.getElementById('runModeChip');
const setupBannerEl = document.getElementById('setupBanner');
const moodEl = document.getElementById('mood');
const routingEl = document.getElementById('routing');
const cameraTopbarEl = document.getElementById('cameraTopbar');
const chatEl = document.getElementById('chat');
const formEl = document.getElementById('composer');
const inputEl = document.getElementById('input');
const chatAttachmentInputEl = document.getElementById('chatAttachmentInput');
const chatAttachBtnEl = document.getElementById('chatAttachBtn');
const voiceInputBtnEl = document.getElementById('voiceInputBtn');
const voiceInputStatusEl = document.getElementById('voiceInputStatus');
const voiceLiveTranscriptEl = document.getElementById('voiceLiveTranscript');
const voiceInputDeviceEl = document.getElementById('voiceInputDevice');
const voiceLevelMeterEl = document.getElementById('voiceLevelMeter');
const voiceLevelBarEl = document.getElementById('voiceLevelBar');
const chatAttachmentsPreviewEl = document.getElementById('chatAttachmentsPreview');
const continueBtnEl = document.getElementById('continueBtn');
const stopBtnEl = document.getElementById('stopBtn');
const stopStatusBadgeEl = document.getElementById('stopStatusBadge');
const wrapperDotEl = document.getElementById('wrapperDot');
const sessionKeyEl = document.getElementById('sessionKey');
const moodMiniEl = document.getElementById('moodMini');
const streamStateEl = document.getElementById('streamState');
const distDetailEl = document.getElementById('distDetail');
const distRebuildBtnEl = document.getElementById('distRebuildBtn');
const distDotEl = document.getElementById('distDot');
const debugLogEl = document.getElementById('debugLog');
const _chatFlowValueEl = document.getElementById('chatFlowValue');
const _chatFlowDetailEl = document.getElementById('chatFlowDetail');
const bodyLinkValueEl = document.getElementById('bodyLinkValue');
const bodyLinkDetailEl = document.getElementById('bodyLinkDetail');
const lastTokensDetailEl = document.getElementById('lastTokensDetail');
const totalTokensDetailEl = document.getElementById('totalTokensDetail');
const modelWindowDetailEl = document.getElementById('modelWindowDetail');
const gatewayDotEl = document.getElementById('gatewayDot');
const moodRouterDotEl = document.getElementById('moodRouterDot');
const currentMoodDotEl = document.getElementById('currentMoodDot');
const modelWindowDotEl = document.getElementById('modelWindowDot');
const cameraDetailEl = document.getElementById('cameraDetail');
const cameraDotEl = document.getElementById('cameraDot');
const cameraCaptureBtnEl = document.getElementById('cameraCaptureBtn');
const cameraPreviewEl = document.getElementById('cameraPreview');
const cameraVisionLabelEl = document.getElementById('cameraVisionLabel');
const cameraGestureLabelEl = document.getElementById('cameraGestureLabel');
const gestureRuntimeDetailEl = document.getElementById('gestureRuntimeDetail');
const gestureActionDetailEl = document.getElementById('gestureActionDetail');
const gestureDebugDetailEl = document.getElementById('gestureDebugDetail');
const gestureWatcherBtnEl = document.getElementById('gestureWatcherBtn');
const gestureWatcherDotEl = document.getElementById('gestureWatcherDot');
const environmentDetailEl = document.getElementById('environmentDetail');
const environmentDotEl = document.getElementById('environmentDot');
const nightLogicDetailEl = document.getElementById('nightLogicDetail');
const nightLogicDotEl = document.getElementById('nightLogicDot');
const tokenSaverDetailEl = document.getElementById('tokenSaverDetail');
const tokenSaverDotEl = document.getElementById('tokenSaverDot');
const contextDetailEl = document.getElementById('contextDetail');
const contextDotEl = document.getElementById('contextDot');
const contextCompactBtnEl = document.getElementById('contextCompactBtn');
const wrapperRestartBtnEl = document.getElementById('wrapperRestartBtn');
const gatewayRestartBtnEl = document.getElementById('gatewayRestartBtn');
const tokenSaverToggleBtnEl = document.getElementById('tokenSaverToggleBtn');
const tokenSaverPhase1BtnEl = document.getElementById('tokenSaverPhase1Btn');
const tokenSaverPhase2BtnEl = document.getElementById('tokenSaverPhase2Btn');
const fileTreeEl = document.getElementById('fileTree');
const sessionsListEl = document.getElementById('sessionsList');
const sessionsRefreshBtnEl = document.getElementById('sessionsRefreshBtn');
const activeFilePathEl = document.getElementById('activeFilePath');
const workspaceTabCodeEl = document.getElementById('workspaceTabCode');
const workspaceTabRepliesEl = document.getElementById('workspaceTabReplies');
const workspacePaneCodeEl = document.getElementById('workspacePaneCode');
const workspacePaneRepliesEl = document.getElementById('workspacePaneReplies');
const workspaceCodeActionsEl = document.getElementById('workspaceCodeActions');
const workspaceRepliesToolbarEl = document.getElementById('workspaceRepliesToolbar');
const fileEditorEl = document.getElementById('fileEditor');
const fileBrowserRootEl = document.getElementById('fileBrowserRoot');
const fileBackBtnEl = document.getElementById('fileBackBtn');
const fileForwardBtnEl = document.getElementById('fileForwardBtn');
const fileRefreshBtnEl = document.getElementById('fileRefreshBtn');
const openDirBtnEl = document.getElementById('openDirBtn');
const terminalFormEl = document.getElementById('terminalForm');
const terminalInputEl = document.getElementById('terminalInput');
const terminalOutputEl = document.getElementById('terminalOutput');
const terminalCwdEl = document.getElementById('terminalCwd');
const terminalDetachBtnEl = document.getElementById('terminalDetachBtn');
const terminalTerminateBtnEl = document.getElementById('terminalTerminateBtn');
const consoleTabTerminalEl = document.getElementById('consoleTabTerminal');
const consoleTabClaudeEl = document.getElementById('consoleTabClaude');
const consolePaneTerminalEl = document.getElementById('consolePaneTerminal');
const consolePaneClaudeEl = document.getElementById('consolePaneClaude');
const repliesListEl = document.getElementById('repliesList');
const replyDetailEl = document.getElementById('replyDetail');
const replyEmptyEl = document.getElementById('replyEmpty');
const replyRefreshBtnEl = document.getElementById('replyRefreshBtn');
const replyIngestTestBtnEl = document.getElementById('replyIngestTestBtn');
const replyCaptureSetupBtnEl = document.getElementById('replyCaptureSetupBtn');
const replySendToVioBtnEl = document.getElementById('replySendToVioBtn');
const replySaveBtnEl = document.getElementById('replySaveBtn');
const replyDoneBtnEl = document.getElementById('replyDoneBtn');
const replyDeleteBtnEl = document.getElementById('replyDeleteBtn');
const replyOpenSourceBtnEl = document.getElementById('replyOpenSourceBtn');
const claudeStatusBadgeEl = document.getElementById('claudeStatusBadge');
const claudeCwdInputEl = document.getElementById('claudeCwdInput');
const claudeStartBtnEl = document.getElementById('claudeStartBtn');
const claudeStopBtnEl = document.getElementById('claudeStopBtn');
const claudeRestartBtnEl = document.getElementById('claudeRestartBtn');
const claudeMetaEl = document.getElementById('claudeMeta');
const claudeTerminalHostEl = document.getElementById('claudeTerminalHost');
const claudeOutputEl = document.getElementById('claudeOutput');
const claudeAutoScrollEl = document.getElementById('claudeAutoScroll');
const claudeErrorEl = document.getElementById('claudeError');
const claudeComposerFormEl = document.getElementById('claudeComposer');
const claudeComposerInputEl = document.getElementById('claudeComposerInput');
const claudeComposerSendBtnEl = document.getElementById('claudeComposerSendBtn');
const claudeComposerStatusEl = document.getElementById('claudeComposerStatus');
const fileSaveBtnEl = document.getElementById('fileSaveBtn');
const fileUndoBtnEl = document.getElementById('fileUndoBtn');
const fileHighlightEl = document.getElementById('fileHighlight');
const fileModeBadgeEl = document.getElementById('fileModeBadge');
const workspaceSplitEl = document.getElementById('workspaceSplit');
const editorStackEl = document.getElementById('editorStack');
const cameraFoldEl = document.getElementById('cameraFold');
const gestureFoldEl = document.getElementById('gestureFold');
const safeEditSummaryEl = document.getElementById('safeEditSummary');
const safeEditTxnDetailEl = document.getElementById('safeEditTxnDetail');
const safeEditSmokeDetailEl = document.getElementById('safeEditSmokeDetail');
const safeEditDotEl = document.getElementById('safeEditDot');
let _lastSafeEditState = null;

const LAST_REPLY_ROADMAP_KEY = 'vio-wrapper-last-reply-roadmap-v1';
const STRUCTURED_ROADMAP_KEY = 'vio-wrapper-roadmap-v2';
const LAST_ASSISTANT_REPLY_KEY = 'vio-wrapper-last-assistant-reply-v1';
const LAST_ASSISTANT_REPLY_BY_SESSION_KEY = 'vio-wrapper-last-assistant-reply-by-session-v1';

let ws;
let streamingEl = null;
let streamingRunId = null;
const abortedRunIds = new Set();
let _stopRequestedAt = null;
let lastStreamEventAt = 0;
const taskRegistry = new Map();
let latestWrapperRuntime = null;
let lastVisitedDirs = [];
let dashboardSessions = [];
let selectedSessionKey = null;
let gatewayMainSessionKey = null;
let sessionSelectionSeq = 0;
let sessionHistoryRequestSeq = 0;
const sessionMeta = new Map();
const sessionRefreshTimers = new Map();
const sessionMessages = new Map();
const sessionHistoryInflight = new Map();
const sessionRunState = new Map();
const sessionLoadingState = new Map();
let chatAttachments = [];
const voiceInputState = {
  stream: null,
  recorder: null,
  chunks: [],
  recording: false,
  transcribing: false,
  mimeType: 'audio/webm',
  // chunked live transcription state
  chunkIndex: 0,
  chunkTranscripts: [],
  pendingChunks: 0,
  runToken: 0,
  finalizing: false,
  stoppedAt: 0,
  aborted: false,
  // audio analysis (level meter)
  audioContext: null,
  analyser: null,
  sourceNode: null,
  levelRafId: null,
};
let currentDir = '.';
let currentFilePath = null;
let currentFileOriginal = '';
let terminalSessionId = 'default';
const UI_PREFS_KEY = 'vio-wrapper-ui-prefs-v2';
let infraActionInFlight = null;

const consoleTabs = {
  active: 'claude',
};

const workspaceTabs = {
  active: 'code',
};

const repliesState = {
  items: [],
  selectedId: null,
  loading: false,
  detailLoading: false,
  error: '',
};

const runModeState = {
  mode: 'source',
  switching: false,
};

function getDefaultClaudeCwd() {
  return String(currentDir || '.').trim() || '.';
}

function isPlaceholderClaudeCwd(value) {
  const cwd = String(value || '').trim();
  return !cwd || cwd === '.';
}

const claude = {
  sessionId: 'claude-default',
  cwd: getDefaultClaudeCwd(),
  status: 'idle',
  running: false,
  started: false,
  exited: false,
  exitCode: null,
  output: '',
  loading: false,
  polling: false,
  pollTimer: null,
  pollIntervalMs: 5000,
  outputTruncated: false,
  autoScroll: true,
  lastOutputLength: 0,
  renderedLength: 0,
  error: '',
  focused: false,
  term: null,
  fitAddon: null,
  terminalReady: false,
  suppressInput: false,
  inputBuffer: '',
  inputFlushTimer: null,
  inputFlushDelayMs: 16,
  composerDraft: '',
  composerSending: false,
  composerStatus: 'Dispatch new task: Enter send · Shift+Enter newline',
  composerStatusTone: 'hint',
  autoStartAttempted: false,
};

function renderRunModeChip() {
  if (!runModeChipEl) {return;}
  runModeChipEl.textContent = runModeState.switching ? `mode: ${runModeState.mode} → switching…` : `mode: ${runModeState.mode}`;
  runModeChipEl.disabled = !!runModeState.switching;
  runModeChipEl.dataset.mode = runModeState.mode;
  runModeChipEl.classList.remove('state-idle', 'state-thinking');
  runModeChipEl.classList.add(runModeState.switching ? 'state-thinking' : 'state-idle');
}

async function fetchRunMode() {
  const res = await fetch('/api/run-mode', { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) {throw new Error(data?.error || 'run mode fetch failed');}
  runModeState.mode = data.mode || 'source';
  runModeState.switching = false;
  renderRunModeChip();
  return data;
}

async function toggleRunMode() {
  if (runModeState.switching) {return;}
  const nextMode = runModeState.mode === 'runtime' ? 'source' : 'runtime';
  runModeState.switching = true;
  renderRunModeChip();
  try {
    await fetch('/api/run-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: nextMode }),
    });
  } catch {}

  const startedAt = Date.now();
  const tryPoll = async () => {
    try {
      const data = await fetchRunMode();
      if (data.mode === nextMode) {
        location.reload();
        return;
      }
    } catch {}
    if (Date.now() - startedAt < 20000) {window.setTimeout(tryPoll, 1000);}
    else {
      runModeState.switching = false;
      renderRunModeChip();
    }
  };
  window.setTimeout(tryPoll, 1200);
}

function shouldSuppressDebugLine(text = '') {
  const source = String(text || '');
  return (
    source.startsWith('loadSessionHistory cache ') ||
    source.startsWith('loadSessionHistory start ') ||
    source.startsWith('loadSessionHistory resolved ') ||
    source.startsWith('scheduleSessionRefresh ') ||
    source.startsWith('sessionRefreshTimerFired ') ||
    source.startsWith('refreshSessionHistory seq=') ||
    source.startsWith('renderSessionMessages active=')
  );
}

function addDebugLine(text, tone = 'cyan') {
  if (!debugLogEl) {return;}
  if (shouldSuppressDebugLine(text)) {return;}
  const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const el = document.createElement('div');
  el.className = `log-line ${tone}`.trim();
  el.innerHTML = `<span class="log-bracket">[</span><span class="log-time">${stamp}</span><span class="log-bracket">]</span> <span class="log-text">${text.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span>`;
  debugLogEl.prepend(el);
  while (debugLogEl.children.length > 12) {debugLogEl.removeChild(debugLogEl.lastElementChild);}
}

function renderSetupBanner() {
  if (!setupBannerEl) {return;}
  const setup = serverConfig.setup || {};
  if (setup.hasLocalConfig) {
    setupBannerEl.hidden = true;
    setupBannerEl.innerHTML = '';
    return;
  }
  const localConfigPath = setup.localConfigPath || 'config/local.mjs';
  const bootstrapCommand = setup.bootstrapCommand || 'node scripts/bootstrap-local-config.mjs';
  const previewCommand = setup.bootstrapPreviewCommand || 'node scripts/bootstrap-local-config.mjs --print --yes';
  setupBannerEl.hidden = false;
  setupBannerEl.innerHTML = `
    <div class="setup-banner-title">Setup required · local config missing</div>
    <div class="setup-banner-body">This machine is still using repo defaults. Generate the gitignored local config before relying on launchd or machine-specific paths.</div>
    <div class="setup-banner-meta">Missing: <code>${localConfigPath.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</code></div>
    <div class="setup-banner-meta">Run in <code>apps/viodashboard</code>: <code>${bootstrapCommand.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</code></div>
    <div class="setup-banner-meta">Preview only: <code>${previewCommand.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</code></div>
  `;
}

function formatCompactTokens(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {return 'n/a';}
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(2)}M`;}
  if (n >= 10_000) {return `${Math.round(n / 1000)}k`;}
  if (n >= 1000) {return `${(n / 1000).toFixed(1)}k`;}
  return String(Math.round(n));
}

function formatContextSource(label, data, { staleLabel = false } = {}) {
  if (!data) {return `${label}: n/a`;}
  const used = Number.isFinite(Number(data.used)) ? Number(data.used) : null;
  const limit = Number.isFinite(Number(data.limit)) ? Number(data.limit) : null;
  const pct = Number.isFinite(Number(data.pct)) ? Number(data.pct) : null;
  if (used == null || limit == null || limit <= 0) {return `${label}: n/a`;}
  const stale = staleLabel && data.fresh === false ? ' stale' : '';
  const pctLabel = pct != null ? ` (${pct.toFixed(1)}%)` : '';
  return `${label}: ${formatCompactTokens(used)} / ${formatCompactTokens(limit)}${pctLabel}${stale}`;
}

function renderContextTelemetry(msg = {}) {
  if (!contextDetailEl) {return;}
  const snapshot = msg.contextSnapshot || null;
  const diagnostic = msg.diagnosticContext || snapshot?.diagnosticContext || null;
  const parts = [];
  if (diagnostic) {
    parts.push(formatContextSource('ctx', diagnostic, { staleLabel: true }));
  } else if (snapshot?.totalTokens != null && snapshot?.contextTokens != null) {
    const used = Number(snapshot.totalTokens);
    const limit = Number(snapshot.contextTokens);
    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 1000) / 10) : null;
    parts.push(formatContextSource('ctx', { used, limit, pct, fresh: snapshot?.totalTokensFresh !== false }, { staleLabel: true }));
  }
  if (snapshot?.model) {
    parts.push(snapshot.model);
  }
  if (!parts.length) {parts.push('ctx: n/a');}
  contextDetailEl.textContent = parts.join(' · ');

  const usedForDot = diagnostic?.used ?? snapshot?.totalTokens ?? null;
  const dotUsed = usedForDot != null ? Number(usedForDot) : null;
  const dotState = dotUsed == null || !Number.isFinite(dotUsed) ? 'safe' : dotUsed > 200_000 ? 'alert' : dotUsed >= 100_000 ? 'mid' : 'safe';
  applyDotState(contextDotEl, 'window', dotState);
}

function registerChatRun(runId) {
  if (!runId) {return;}
  taskRegistry.set(runId, {
    taskId: runId,
    kind: 'chat-run',
    status: 'running',
    backendHandle: runId,
    visibleInUi: true,
    canDetach: false,
    canTerminate: false,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function updateChatRunStatus(runId, status) {
  const task = taskRegistry.get(runId);
  if (!task) {return;}
  task.status = status;
  task.updatedAt = Date.now();
}

function registerExecTask(taskId, command) {
  if (!taskId) {return;}
  taskRegistry.set(taskId, {
    taskId,
    kind: 'exec',
    status: 'running',
    backendHandle: terminalSessionId,
    command,
    visibleInUi: true,
    canDetach: true,
    canTerminate: true,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function updateExecTaskStatus(taskId, status, patch = {}) {
  const task = taskRegistry.get(taskId);
  if (!task) {return;}
  task.status = status;
  Object.assign(task, patch);
  task.updatedAt = Date.now();
}

function findLatestExecTask(status = 'running') {
  const items = [...taskRegistry.values()].filter(task => task.kind === 'exec' && (!status || task.status === status));
  items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return items[0] || null;
}

function syncTerminalTaskButtons() {
  const runningTask = findLatestExecTask('running');
  const terminableTask = findLatestExecTask('running') || findLatestExecTask('detached');
  if (terminalDetachBtnEl) {terminalDetachBtnEl.disabled = !runningTask;}
  if (terminalTerminateBtnEl) {terminalTerminateBtnEl.disabled = !terminableTask;}
}

function allocExecTaskId() {
  return `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveSessionUiState(sessionKey) {
  const isSelected = !!sessionKey && sessionKey === selectedSessionKey;
  const isMain = !!sessionKey && sessionKey === gatewayMainSessionKey;
  const runState = getSessionRunState(sessionKey);
  const messages = Array.isArray(sessionMessages.get(sessionKey)) ? sessionMessages.get(sessionKey) : [];
  const latestAssistant = [...messages].toReversed().find(item => item?.role === 'assistant') || null;
  const currentRunId = runState?.runId || null;
  const currentRunAssistant = currentRunId
    ? messages.find(item => item?.role === 'assistant' && (item?.runId === currentRunId || item?.id === currentRunId || item?.id === `assistant:${currentRunId}`)) || null
    : null;
  const authoritativeState = currentRunAssistant?.status === 'streaming'
    ? 'streaming'
    : currentRunAssistant?.status === 'final'
      ? 'final'
      : (!currentRunId && latestAssistant?.status === 'final' && runState?.state !== 'aborted' && runState?.state !== 'error')
        ? 'final'
        : (runState?.state || 'idle');

  const canStop = !!(currentRunId && (authoritativeState === 'streaming' || authoritativeState === 'aborting'));
  const showStopped = authoritativeState === 'aborted';
  const canContinue = (() => {
    const latest = getLatestSessionAssistantFinalMeta(sessionKey || null);
    if (!latest.text || latest.aborted) {return false;}
    if (authoritativeState === 'streaming' || authoritativeState === 'aborting' || authoritativeState === 'aborted') {return false;}
    return true;
  })();

  return {
    sessionKey: sessionKey || null,
    isSelected,
    isMain,
    runId: currentRunId,
    state: authoritativeState,
    latestAssistant,
    currentRunAssistant,
    canStop,
    canContinue,
    showStopped,
  };
}

function getSelectedSessionRunState() {
  if (!selectedSessionKey) {
    return { sessionKey: null, isMain: false, runId: null, state: 'idle', stoppable: false, canStop: false, canContinue: true, showStopped: false };
  }
  const uiState = deriveSessionUiState(selectedSessionKey);
  return {
    sessionKey: uiState.sessionKey,
    isMain: uiState.isMain,
    runId: uiState.runId,
    state: uiState.state,
    stoppable: uiState.canStop,
    canStop: uiState.canStop,
    canContinue: uiState.canContinue,
    showStopped: uiState.showStopped,
  };
}

function syncStopButton() {
  const selectedRun = getSelectedSessionRunState();
  if (stopBtnEl) {
    stopBtnEl.hidden = !selectedRun.canStop;
    stopBtnEl.textContent = selectedRun.state === 'aborting' ? 'Stopping...' : 'Stop';
    stopBtnEl.disabled = selectedRun.state === 'aborting';
  }
  if (stopStatusBadgeEl) {
    stopStatusBadgeEl.hidden = !selectedRun.showStopped;
    stopStatusBadgeEl.textContent = 'Stopped';
  }
}

function resetStoppedUiForNewRun() {
  clearStreamingMessageEl();
  lastStreamEventAt = 0;
  const runState = getSessionRunState(getActiveViewedSessionKey());
  if (runState.state === 'aborted' || runState.state === 'final' || runState.state === 'idle') {
    runState.state = 'idle';
  }
  syncStopButton();
  syncContinueButton();
}

function forceFinalizeFrontState(reason = 'unknown') {
  const sessionKey = getActiveViewedSessionKey();
  const runState = getSessionRunState(sessionKey);
  addDebugLine(`Force final state cleanup (${reason}) · run ${String(runState?.runId || '').slice(0, 8)}`, 'pink');
  clearStreamingMessageEl(runState?.runId || null);
  runState.state = 'final';
  runState.runId = null;
  runState.streamText = '';
  lastStreamEventAt = 0;
  syncStopButton();
  syncContinueButton();
}

function ignoreAbortedRunEvent(event) {
  if (event?.runId && abortedRunIds.has(event.runId)) {
    addDebugLine(`Ignored post-abort event for run ${String(event.runId).slice(0, 8)}`, 'pink');
    return true;
  }
  return false;
}

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(UI_PREFS_KEY) || '{}'); } catch { return {}; }
}
function savePrefs(prefs) { localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs)); }

function bindFoldPersistence(detailsEl, prefKey, defaultOpen = false) {
  if (!detailsEl) {return;}
  const prefs = loadPrefs();
  const value = prefs[prefKey];
  detailsEl.open = typeof value === 'boolean' ? value : defaultOpen;
  detailsEl.addEventListener('toggle', () => {
    const nextPrefs = loadPrefs();
    nextPrefs[prefKey] = !!detailsEl.open;
    savePrefs(nextPrefs);
  });
}

function applyLayoutPrefs() {
  const prefs = loadPrefs();
  const root = document.documentElement;
  if (prefs.sidebarWidth) {root.style.setProperty('--sidebar-w', `${prefs.sidebarWidth}px`);}
  if (prefs.rightbarWidth != null) {root.style.setProperty('--rightbar-w', `${prefs.rightbarWidth}px`);}
  if (prefs.workspaceLeft) {root.style.setProperty('--workspace-left', `${prefs.workspaceLeft}fr`);}
  if (prefs.workspaceRight) {root.style.setProperty('--workspace-right', `${prefs.workspaceRight}fr`);}
  if (prefs.editorTop) {root.style.setProperty('--editor-top', `${prefs.editorTop}fr`);}
  if (prefs.terminalBottom) {root.style.setProperty('--terminal-bottom', `${prefs.terminalBottom}fr`);}
}

function setupResizers() {
  const root = document.documentElement;
  document.querySelectorAll('.resizer').forEach(handle => {
    handle.addEventListener('pointerdown', event => {
      event.preventDefault();
      const kind = handle.dataset.resize;
      const startX = event.clientX;
      const startSidebar = parseFloat(getComputedStyle(root).getPropertyValue('--sidebar-w')) || 260;
      const startRight = parseFloat(getComputedStyle(root).getPropertyValue('--rightbar-w')) || 320;
      const startWorkspaceLeft = parseFloat(getComputedStyle(root).getPropertyValue('--workspace-left')) || 1.15;
      const startWorkspaceRight = parseFloat(getComputedStyle(root).getPropertyValue('--workspace-right')) || 1;
      const startEditorTop = parseFloat(getComputedStyle(root).getPropertyValue('--editor-top')) || 1.5;
      const startTerminalBottom = parseFloat(getComputedStyle(root).getPropertyValue('--terminal-bottom')) || 1;
      const rect = workspaceSplitEl?.getBoundingClientRect();
      const editorRect = editorStackEl?.getBoundingClientRect();

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        if (kind === 'sidebar') {
          const next = Math.max(220, Math.min(520, startSidebar + dx));
          root.style.setProperty('--sidebar-w', `${next}px`);
        } else if (kind === 'right') {
          const next = Math.max(260, Math.min(520, startRight - dx));
          root.style.setProperty('--rightbar-w', `${next}px`);
        } else if (kind === 'workspace' && rect) {
          const total = rect.width;
          const leftPx = Math.max(280, Math.min(total - 280, (total * (startWorkspaceLeft / (startWorkspaceLeft + startWorkspaceRight))) + dx));
          const rightPx = total - leftPx;
          root.style.setProperty('--workspace-left', `${(leftPx / total) * 2}fr`);
          root.style.setProperty('--workspace-right', `${(rightPx / total) * 2}fr`);
        } else if (kind === 'editor-terminal' && editorRect) {
          const total = editorRect.height;
          const dy = moveEvent.clientY - event.clientY;
          const topPx = Math.max(220, Math.min(total - 160, (total * (startEditorTop / (startEditorTop + startTerminalBottom))) + dy));
          const bottomPx = total - topPx;
          root.style.setProperty('--editor-top', `${(topPx / total) * 2}fr`);
          root.style.setProperty('--terminal-bottom', `${(bottomPx / total) * 2}fr`);
        }
      };

      const onUp = () => {
        const prefs = loadPrefs();
        prefs.sidebarWidth = parseFloat(getComputedStyle(root).getPropertyValue('--sidebar-w')) || 260;
        prefs.rightbarWidth = parseFloat(getComputedStyle(root).getPropertyValue('--rightbar-w')) || 320;
        prefs.workspaceLeft = parseFloat(getComputedStyle(root).getPropertyValue('--workspace-left')) || 1.15;
        prefs.workspaceRight = parseFloat(getComputedStyle(root).getPropertyValue('--workspace-right')) || 1;
        prefs.editorTop = parseFloat(getComputedStyle(root).getPropertyValue('--editor-top')) || 1.5;
        prefs.terminalBottom = parseFloat(getComputedStyle(root).getPropertyValue('--terminal-bottom')) || 1;
        savePrefs(prefs);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
    });
  });
}

function applyStateClass(el, state) {
  if (!el) {return;}
  el.classList.remove('state-idle', 'state-thinking', 'state-streaming', 'state-waiting', 'state-error');
  el.classList.add(`state-${state}`);
}

function applyDotState(el, prefix, state) {
  if (!el) {return;}
  el.className = `dot ${prefix}-${state}`;
}

function resizeComposer() {
  if (!inputEl) {return;}
  inputEl.style.height = 'auto';
  const minHeight = 132;
  const next = Math.max(minHeight, Math.min(inputEl.scrollHeight, window.innerHeight * 0.34));
  inputEl.style.height = `${next}px`;
}

function resizeClaudeComposer() {
  if (!claudeComposerInputEl) {return;}
  claudeComposerInputEl.style.height = 'auto';
  const minHeight = 56;
  const next = Math.max(minHeight, Math.min(claudeComposerInputEl.scrollHeight, window.innerHeight * 0.22));
  claudeComposerInputEl.style.height = `${next}px`;
}

function formatStamp(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function setVoiceInputStatus(message, tone = 'idle') {
  if (voiceInputStatusEl) {
    voiceInputStatusEl.textContent = message || 'Click Voice to record';
    voiceInputStatusEl.dataset.tone = tone;
  }
  if (voiceInputBtnEl) {
    voiceInputBtnEl.classList.remove('state-idle', 'state-thinking', 'state-streaming', 'state-error');
    voiceInputBtnEl.classList.add(
      tone === 'recording' ? 'state-streaming' : tone === 'working' ? 'state-thinking' : tone === 'error' ? 'state-error' : 'state-idle',
    );
    voiceInputBtnEl.setAttribute('aria-pressed', voiceInputState.recording ? 'true' : 'false');
    voiceInputBtnEl.disabled = !voiceInputState.recording && !!voiceInputState.transcribing;
    voiceInputBtnEl.textContent = voiceInputState.recording ? '⏹️ Stop' : '🎙️ Voice';
  }
}

function normalizeVoiceTranscript(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function mergeVoiceChunkTranscripts(chunks = []) {
  const merged = [];
  for (const rawChunk of chunks) {
    const chunk = normalizeVoiceTranscript(rawChunk);
    if (!chunk) {continue;}
    const previous = merged[merged.length - 1] || '';
    if (!previous) {
      merged.push(chunk);
      continue;
    }
    if (previous === chunk || previous.endsWith(chunk)) {continue;}
    const maxOverlap = Math.min(previous.length, chunk.length, 80);
    let overlap = 0;
    for (let size = maxOverlap; size >= 8; size -= 1) {
      if (previous.slice(-size).toLowerCase() === chunk.slice(0, size).toLowerCase()) {
        overlap = size;
        break;
      }
    }
    merged.push(overlap ? chunk.slice(overlap).trim() : chunk);
  }
  return merged.join(' ').replace(/\s+/g, ' ').trim();
}

function updateLiveTranscript() {
  if (!voiceLiveTranscriptEl) {return;}
  const text = mergeVoiceChunkTranscripts(voiceInputState.chunkTranscripts);
  if (!text && !voiceInputState.recording && voiceInputState.pendingChunks === 0) {
    voiceLiveTranscriptEl.hidden = true;
    voiceLiveTranscriptEl.textContent = '';
    voiceLiveTranscriptEl.dataset.tone = 'idle';
    return;
  }
  voiceLiveTranscriptEl.hidden = false;
  voiceLiveTranscriptEl.dataset.tone = voiceInputState.pendingChunks > 0 ? 'working' : voiceInputState.recording ? 'recording' : 'idle';
  voiceLiveTranscriptEl.textContent = text || (voiceInputState.recording ? 'Listening… waiting for the first chunk.' : 'Finishing transcript…');
}

function stopVoiceMediaStream() {
  const tracks = Array.isArray(voiceInputState.stream?.getTracks?.()) ? voiceInputState.stream.getTracks() : [];
  for (const track of tracks) {track.stop();}
  voiceInputState.stream = null;
}

function stopVoiceLevelMeter() {
  if (voiceInputState.levelRafId != null) {
    cancelAnimationFrame(voiceInputState.levelRafId);
    voiceInputState.levelRafId = null;
  }
  try { voiceInputState.sourceNode?.disconnect(); } catch {}
  voiceInputState.sourceNode = null;
  voiceInputState.analyser = null;
  if (voiceInputState.audioContext && voiceInputState.audioContext.state !== 'closed') {
    voiceInputState.audioContext.close().catch(() => {});
  }
  voiceInputState.audioContext = null;
  if (voiceLevelMeterEl) {voiceLevelMeterEl.hidden = true;}
  if (voiceLevelBarEl) {voiceLevelBarEl.style.width = '0%';}
  if (voiceInputDeviceEl) {voiceInputDeviceEl.hidden = true; voiceInputDeviceEl.textContent = '';}
}

function startVoiceLevelMeter(stream) {
  stopVoiceLevelMeter();
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    voiceInputState.audioContext = ctx;
    voiceInputState.analyser = analyser;
    voiceInputState.sourceNode = source;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    if (voiceLevelMeterEl) {voiceLevelMeterEl.hidden = false;}
    function tick() {
      if (!voiceInputState.analyser) {return;}
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {sum += buf[i];}
      const avg = sum / buf.length;
      const pct = Math.min(100, Math.round((avg / 180) * 100));
      if (voiceLevelBarEl) {voiceLevelBarEl.style.width = pct + '%';}
      voiceInputState.levelRafId = requestAnimationFrame(tick);
    }
    voiceInputState.levelRafId = requestAnimationFrame(tick);
  } catch (e) {
    console.warn('[voice] level meter init failed', e);
  }
}

function showVoiceInputDevice(stream) {
  if (!voiceInputDeviceEl) {return;}
  try {
    const audioTrack = stream.getAudioTracks()[0];
    const label = audioTrack?.label;
    if (label) {
      voiceInputDeviceEl.textContent = label;
      voiceInputDeviceEl.hidden = false;
    }
  } catch {}
}

function resetVoiceInputState() {
  stopVoiceLevelMeter();
  stopVoiceMediaStream();
  voiceInputState.stream = null;
  voiceInputState.recorder = null;
  voiceInputState.chunks = [];
  voiceInputState.recording = false;
  voiceInputState.transcribing = false;
  voiceInputState.mimeType = 'audio/webm';
  voiceInputState.chunkIndex = 0;
  voiceInputState.chunkTranscripts = [];
  voiceInputState.pendingChunks = 0;
  voiceInputState.runToken += 1;
  voiceInputState.finalizing = false;
  voiceInputState.stoppedAt = 0;
  voiceInputState.aborted = false;
  if (voiceLiveTranscriptEl) {
    voiceLiveTranscriptEl.hidden = true;
    voiceLiveTranscriptEl.textContent = '';
    voiceLiveTranscriptEl.dataset.tone = 'idle';
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const payload = result.includes(',') ? result.split(',')[1] : '';
      if (!payload) {
        reject(new Error('Recorded audio could not be encoded.'));
        return;
      }
      resolve(payload);
    });
    reader.addEventListener('error', () => reject(new Error('Failed to read recorded audio.')));
    reader.readAsDataURL(blob);
  });
}

async function transcribeBlob(blob, { mode = 'final' } = {}) {
  if (!blob.size) {return '';}
  const audioBase64 = await blobToBase64(blob);
  const res = await fetch('/api/voice/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64,
      mimeType: blob.type || voiceInputState.mimeType || 'audio/webm',
      mode: mode === 'preview' ? 'preview' : 'final',
    }),
  });
  const data = await res.json();
  if (!res.ok) {return '';}
  return normalizeVoiceTranscript(data?.transcript || '');
}

// Send a single audio chunk to the transcription endpoint; returns transcript text or ''.
async function transcribeChunk(blob) {
  return transcribeBlob(blob, { mode: 'preview' });
}

async function startVoiceRecording() {
  if (!voiceInputBtnEl || voiceInputState.recording || voiceInputState.transcribing) {return;}
  if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
    setVoiceInputStatus('This browser does not support microphone recording here.', 'error');
    return;
  }
  resetVoiceInputState();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const runToken = voiceInputState.runToken;
    voiceInputState.stream = stream;
    voiceInputState.recorder = recorder;
    voiceInputState.chunks = [];
    voiceInputState.recording = true;
    voiceInputState.transcribing = false;
    voiceInputState.mimeType = mimeType;
    voiceInputState.chunkIndex = 0;
    voiceInputState.chunkTranscripts = [];
    voiceInputState.pendingChunks = 0;
    voiceInputState.finalizing = false;
    voiceInputState.stoppedAt = 0;
    voiceInputState.aborted = false;

    startVoiceLevelMeter(stream);
    showVoiceInputDevice(stream);

    recorder.addEventListener('dataavailable', event => {
      if (!event.data || event.data.size === 0) {return;}
      voiceInputState.chunks.push(event.data);
      const idx = voiceInputState.chunkIndex++;
      const blob = new Blob([event.data], { type: mimeType });
      voiceInputState.pendingChunks += 1;
      updateLiveTranscript();
      if (voiceInputState.recording) {
        setVoiceInputStatus(`Listening… transcribing chunk ${idx + 1}.`, 'recording');
      }
      transcribeChunk(blob).then(text => {
        if (voiceInputState.aborted || runToken !== voiceInputState.runToken) {return;}
        voiceInputState.chunkTranscripts[idx] = text;
      }).catch(error => {
        if (!voiceInputState.aborted && runToken === voiceInputState.runToken) {
          console.warn('[voice] chunk transcription failed', error);
        }
      }).finally(() => {
        if (runToken !== voiceInputState.runToken) {return;}
        voiceInputState.pendingChunks = Math.max(0, voiceInputState.pendingChunks - 1);
        updateLiveTranscript();
        if (voiceInputState.recording) {
          const heard = mergeVoiceChunkTranscripts(voiceInputState.chunkTranscripts);
          setVoiceInputStatus(heard ? 'Listening… live transcript updating below.' : 'Recording… speak naturally.', 'recording');
        } else if (voiceInputState.finalizing && voiceInputState.pendingChunks === 0) {
          void finalizeVoiceTranscript(runToken);
        }
      });
    });

    recorder.addEventListener('stop', () => {
      if (runToken !== voiceInputState.runToken) {return;}
      voiceInputState.recording = false;
      voiceInputState.transcribing = true;
      voiceInputState.finalizing = true;
      voiceInputState.stoppedAt = Date.now();
      setVoiceInputStatus(voiceInputState.pendingChunks > 0 ? 'Finishing transcript from recent chunks…' : 'Merging transcript…', 'working');
      updateLiveTranscript();
      if (voiceInputState.pendingChunks === 0) {
        void finalizeVoiceTranscript(runToken);
      }
    }, { once: true });

    recorder.start(1000);
    setVoiceInputStatus('Recording… speak naturally; live transcript will appear below.', 'recording');
    updateLiveTranscript();
  } catch (error) {
    resetVoiceInputState();
    setVoiceInputStatus(error?.message || 'Microphone access failed.', 'error');
  }
}

async function finalizeVoiceTranscript(runToken = voiceInputState.runToken) {
  if (voiceInputState.aborted || runToken !== voiceInputState.runToken) {return;}

  let transcript = mergeVoiceChunkTranscripts(voiceInputState.chunkTranscripts);
  const shouldRunFinalPass = Array.isArray(voiceInputState.chunks) && voiceInputState.chunks.length > 0 && (!transcript || voiceInputState.chunks.length >= 2);
  if (shouldRunFinalPass) {
    try {
      setVoiceInputStatus('Running final full-pass transcription…', 'working');
      updateLiveTranscript();
      const fullBlob = new Blob(voiceInputState.chunks, { type: voiceInputState.mimeType || 'audio/webm' });
      const finalTranscript = await transcribeBlob(fullBlob, { mode: 'final' });
      if (finalTranscript && (!transcript || finalTranscript.length >= transcript.length * 0.7)) {
        transcript = finalTranscript;
      }
    } catch (error) {
      console.warn('[voice] final full-pass transcription failed', error);
    }
  }

  if (voiceInputState.aborted || runToken !== voiceInputState.runToken) {return;}

  if (transcript) {
    const prefix = inputEl.value && !/\s$/.test(inputEl.value) ? `${inputEl.value.trim()} ` : inputEl.value;
    inputEl.value = `${prefix || ''}${transcript}`;
    resizeComposer();
    inputEl.focus();
    setVoiceInputStatus('Transcript merged into the input box.', 'idle');
  } else {
    setVoiceInputStatus('No speech was detected from the recorded audio.', 'error');
  }
  voiceInputState.transcribing = false;
  voiceInputState.finalizing = false;
  resetVoiceInputState();
  setTimeout(() => {
    if (!voiceInputState.recording && !voiceInputState.transcribing) {
      setVoiceInputStatus('Click Voice to record', 'idle');
    }
  }, 2500);
}

function stopVoiceRecording() {
  const recorder = voiceInputState.recorder;
  if (!recorder || recorder.state === 'inactive') {return;}
  voiceInputState.recording = false;
  voiceInputState.transcribing = true;
  voiceInputState.finalizing = true;
  stopVoiceLevelMeter();
  setVoiceInputStatus('Stopping… waiting for the last chunk.', 'working');
  recorder.stop();
}

function avatarLabel(role) { return role === 'user' ? 'X' : 'V'; }
function avatarImageSrc(role) {
  if (role === 'user') {return '/avatars/Xin.JPEG';}
  if (role === 'assistant') {return '/avatars/vio.png';}
  return '';
}

function hasRoadmapBlock(text = '') {
  return /```vio-roadmap\s*[\r\n]/i.test(String(text || ''));
}

function stripRoadmapBlockForDisplay(text = '') {
  return String(text || '').replace(/\n?```vio-roadmap\s*\n[\s\S]*?\n```\s*$/i, '').trim();
}

function sanitizeDisplayedChatText(text = '') {
  let value = String(text || '').replace(/\r\n?/g, '\n');
  value = value.replace(/^\[\[\s*reply_to_current\s*\]\]\s*/i, '');
  value = value.replace(/^\[\[\s*reply_to\s*:\s*[^\]]+\]\]\s*/i, '');
  value = value.replace(/^Sender \(untrusted metadata\):\s*```json\s*[\s\S]*?```\s*/i, '');
  value = value.replace(/^Sender \(untrusted metadata\):\s*\{[\s\S]*?\}\s*/i, '');
  value = value.replace(/^\[[A-Za-z]{3}\s+\d{4}-\d{2}-\d{2}[^\n]*\]\s*/i, '');
  value = value.replace(/^\s+/, '');
  return value;
}

function warnRoadmapLeak(path, text = '') {
  if (!hasRoadmapBlock(text)) {return;}
  console.warn(`[wrapper-ui] roadmap block reached ${path}; stripping before conversational reuse.`);
}

function countIndent(line = '') {
  const match = String(line).match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function parseBullet(line = '') {
  const trimmed = String(line).trim();
  const match = trimmed.match(/^[-*•]\s+(.+)$/) || trimmed.match(/^\d+[.)]\s+(.+)$/);
  return match ? match[1].trim() : null;
}

function looksLikeSectionBoundary(line = '') {
  const trimmed = String(line).trim();
  if (!trimmed) {return false;}
  if (trimmed.startsWith('```')) {return true;}
  if (/^#{1,6}\s+/.test(trimmed)) {return true;}
  if (/^[A-Z][A-Z\s/&-]{2,}$/.test(trimmed)) {return true;}
  if (/^(summary|notes?|risks?|questions?|decisions?|context|implementation|progress|status)\s*:?$/i.test(trimmed)) {return true;}
  return false;
}

function extractProposedNextSteps(text = '') {
  const source = String(text || '').replace(/\r/g, '');
  const lines = source.split('\n');
  let headingIndex = lines.findIndex(line => /proposed next steps/i.test(line));
  if (headingIndex === -1) {headingIndex = lines.findIndex(line => /next steps/i.test(line));}
  if (headingIndex === -1) {return [];}

  const steps = [];
  let current = null;
  let sawBody = false;

  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    const line = lines[i] || '';
    const trimmed = line.trim();

    if (!trimmed) {
      if (current && sawBody) {current.description = current.description.trim();}
      continue;
    }

    if (looksLikeSectionBoundary(line) && steps.length) {break;}

    const bulletText = parseBullet(line);
    const indent = countIndent(line);

    if (bulletText) {
      if (!current || indent <= current.baseIndent) {
        current = {
          id: `roadmap-item-${steps.length + 1}`,
          title: bulletText,
          description: '',
          status: 'proposed',
          priority: 'normal',
          source: 'assistant',
          baseIndent: indent,
        };
        steps.push(current);
        sawBody = false;
        continue;
      }

      current.description += `${current.description ? '\n' : ''}• ${bulletText}`;
      sawBody = true;
      continue;
    }

    if (!current) {continue;}
    current.description += `${current.description ? '\n' : ''}${trimmed}`;
    sawBody = true;
  }

  return steps.map(({ baseIndent: _baseIndent, ...item }) => ({
    ...item,
    description: String(item.description || '').trim(),
  }));
}

function _persistLatestReplyRoadmap(text = '') {
  try {
    warnRoadmapLeak('persistLatestReplyRoadmap(input)', text);
    const normalizedText = stripRoadmapBlockForDisplay(text);
    const steps = extractProposedNextSteps(normalizedText);
    const now = new Date().toISOString();
    const legacyPayload = {
      id: `roadmap-${Date.now()}`,
      title: 'Latest proposed next steps',
      summary: 'Parsed from the latest Vio reply only.',
      replyText: normalizedText,
      steps,
      updatedAt: now,
    };
    localStorage.setItem(LAST_REPLY_ROADMAP_KEY, JSON.stringify(legacyPayload));

    const structuredPayload = {
      id: legacyPayload.id,
      title: 'Road Map',
      summary: 'Structured roadmap generated from the latest assistant reply. This is a transitional client-side JSON source until backend roadmap generation is added.',
      sourceType: 'structured-json',
      updatedAt: now,
      items: steps.map((step, index) => ({
        id: step.id || `roadmap-item-${index + 1}`,
        title: step.title,
        description: step.description || '',
        status: step.status || 'proposed',
        priority: step.priority || 'normal',
        source: step.source || 'assistant',
      })),
    };
    localStorage.setItem(STRUCTURED_ROADMAP_KEY, JSON.stringify(structuredPayload));
  } catch {}
}

function setMood(mode, detail = '', runtime = null) {
  if (runtime && typeof runtime === 'object') {latestWrapperRuntime = runtime;}
  const value = mode || runtime?.mood || runtime?.lightOutput || 'idle';
  const state = value === 'thinking' ? 'thinking' : value === 'waiting' ? 'waiting' : value === 'error' ? 'error' : value === 'streaming' ? 'streaming' : 'idle';
  if (moodEl) {moodEl.innerHTML = `<span class="semantic-label">mood:</span> <span class="semantic-value">${value}</span>`;}
  if (moodMiniEl) {moodMiniEl.innerHTML = `<span class="semantic-value state-text-${state}">${value}</span>`;}
  if (streamStateEl) {streamStateEl.innerHTML = `<span class="semantic-value">${value}</span>`;}
  if (moodEl) {applyStateClass(moodEl, state);}
  if (moodMiniEl) {applyStateClass(moodMiniEl, state);}
  if (streamStateEl) {applyStateClass(streamStateEl, state);}
  if (moodRouterDotEl) {applyDotState(moodRouterDotEl, 'mood', state);}
  if (currentMoodDotEl) {applyDotState(currentMoodDotEl, 'mood', state);}
}

function setRouting(summary, _detail = '') {
  if (routingEl) {routingEl.innerHTML = `<span class="semantic-label">routing:</span> <span class="semantic-value">${summary || 'n/a'}</span>`;}
}

function syncTopbarForSession(sessionKey) {
  const uiState = deriveSessionUiState(sessionKey);
  const mode = uiState.state === 'streaming'
    ? 'streaming'
    : uiState.state === 'aborting'
      ? 'thinking'
      : uiState.state === 'error'
        ? 'error'
        : uiState.state === 'aborted'
          ? 'idle'
          : uiState.state === 'final'
            ? 'idle'
            : 'idle';
  const routing = uiState.state === 'streaming'
    ? 'streaming'
    : uiState.state === 'aborting'
      ? 'stopping'
      : uiState.state === 'error'
        ? 'error'
        : uiState.state === 'aborted'
          ? 'aborted'
          : uiState.state === 'final'
            ? 'settled'
            : 'idle';
  setMood(mode, `ui session state: ${uiState.state}`, latestWrapperRuntime || null);
  setRouting(routing, `session=${sessionKey || 'none'} · state=${uiState.state}`);
}

function routingProxyLabel(mode, phase) {
  if (mode === 'error' || phase === 'error') {return 'error';}
  if (phase === 'queued') {return 'queued';}
  if (phase === 'streaming') {return 'streaming';}
  if (mode === 'waiting') {return 'awaiting user';}
  if (phase === 'aborted') {return 'aborted';}
  if (phase === 'final' && mode === 'idle') {return 'settled';}
  if (phase === 'final') {return `${mode} final`;}
  return mode || 'n/a';
}

function setCameraState(state = 'off', result = 'none', vision = 'none', gesture = 'none') {
  if (cameraDetailEl) {cameraDetailEl.innerHTML = `<span class="semantic-label">state</span> <span class="semantic-value">${state}</span><br><span class="semantic-label">result</span> <span class="semantic-value">${result}</span><br><span class="semantic-label">vision</span> <span class="semantic-value">${vision}</span><br><span class="semantic-label">gesture</span> <span class="semantic-value">${gesture}</span>`;}
  if (cameraTopbarEl) {cameraTopbarEl.innerHTML = `<span class="semantic-label">camera:</span> <span class="semantic-value">${state}</span> <span class="semantic-value">· ${gesture}</span>`;}
  if (cameraDotEl) {applyDotState(cameraDotEl, 'window', state === 'on' ? 'safe' : state === 'busy' ? 'mid' : state === 'error' ? 'danger' : 'safe');}
}

function setGestureRuntime(data = {}) {
  const watcherEnabled = !!data.watcherEnabled;
  const busy = !!data.watcherBusy;
  const provider = data.provider?.label || 'unknown provider';
  const interval = Math.round((data.watcherIntervalMs || 0) / 1000);
  const runtimeText = `${watcherEnabled ? 'watcher on' : 'watcher off'} · ${busy ? 'busy' : 'idle'} · ${interval || '?'}s · ${provider}`;
  const actionText = data.lastResult?.action?.action || data.lastAction || 'none';
  const debugBits = [];
  if (data.lastResult?.sampleCount) {debugBits.push(`samples ${data.lastResult.detectedCount || 0}/${data.lastResult.sampleCount}`);}
  if (data.lastResult?.stable === true) {debugBits.push('stable');}
  if (data.lastResult?.stable === false) {debugBits.push('unstable');}
  if (gestureRuntimeDetailEl) {gestureRuntimeDetailEl.innerHTML = `<span class="semantic-value">${runtimeText}</span>`;}
  if (gestureActionDetailEl) {gestureActionDetailEl.innerHTML = `<span class="semantic-value">${actionText}</span>`;}
  if (gestureDebugDetailEl) {gestureDebugDetailEl.innerHTML = `<span class="semantic-value">${debugBits.join(' · ') || 'no gesture runtime data yet'}</span>`;}
  if (gestureWatcherBtnEl) {
    gestureWatcherBtnEl.textContent = watcherEnabled ? 'watcher on' : 'watcher off';
    gestureWatcherBtnEl.className = `chip ${watcherEnabled ? 'state-thinking' : 'state-idle'}`;
  }
  if (gestureWatcherDotEl) {applyDotState(gestureWatcherDotEl, 'window', busy ? 'mid' : watcherEnabled ? 'safe' : 'danger');}
}

async function setGestureWatcher(enabled) {
  const res = await fetch('/api/gesture/watcher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled, intervalMs: 2500 }),
  });
  const data = await res.json();
  if (!res.ok) {throw new Error(data.error || 'watcher update failed');}
  setGestureRuntime(data.gestureRuntime || {});
}

function setEnvironmentTelemetry(_vioBody = {}) {
  if (environmentDetailEl) {environmentDetailEl.innerHTML = '<span class="semantic-value">disabled · pending redesign</span>';}
  if (nightLogicDetailEl) {nightLogicDetailEl.innerHTML = '<span class="semantic-value">disabled · pending redesign</span>';}
  if (bodyLinkValueEl) {bodyLinkValueEl.textContent = 'disabled';}
  if (bodyLinkDetailEl) {bodyLinkDetailEl.textContent = 'body/light telemetry disconnected';}
  if (environmentDotEl) {applyDotState(environmentDotEl, 'window', 'mid');}
  if (nightLogicDotEl) {applyDotState(nightLogicDotEl, 'window', 'mid');}
}

async function refreshVioBodyState() {
  setEnvironmentTelemetry();
}

function renderTokenSaverState(data = {}) {
  const enabled = data?.enabled === true || data?.disabled === false;
  const rules = data?.rules || {};
  const stats = data?.stats || {};
  const last = data?.lastSend?.stats || stats?.last || null;
  const totalSaved = Number(stats?.totalSavedChars || 0) || 0;
  const sendCount = Number(stats?.sendCount || 0) || 0;
  const savedLast = Number(last?.savedChars || 0) || 0;
  const contextChars = Number(last?.contextChars || 0) || 0;
  const savedPct = Number(last?.savedPct || 0) || 0;
  const totalSavedPct = Number(stats?.totalSavedPctWeighted || 0) || 0;
  const detail = enabled
    ? (sendCount
        ? `on · last ${savedLast} chars (${savedPct}%) · total ${totalSaved} (${totalSavedPct}%) · sends ${sendCount} · ctx ${contextChars}`
        : 'on · no savings recorded yet')
    : 'off · pass-through mode';
  if (tokenSaverDetailEl) {tokenSaverDetailEl.innerHTML = `<span class="semantic-value">${detail}</span>`;}
  if (tokenSaverToggleBtnEl) {
    tokenSaverToggleBtnEl.textContent = enabled ? 'on' : 'off';
    tokenSaverToggleBtnEl.className = `chip ${enabled ? 'state-thinking' : 'state-idle'} token-saver-toggle`;
    tokenSaverToggleBtnEl.dataset.enabled = enabled ? 'true' : 'false';
  }
  if (tokenSaverPhase1BtnEl) {
    const on = rules.phase1Summary !== false;
    tokenSaverPhase1BtnEl.textContent = `L1 ${on ? 'on' : 'off'}`;
    tokenSaverPhase1BtnEl.className = `chip ${on ? 'state-thinking' : 'state-idle'} token-saver-toggle`;
    tokenSaverPhase1BtnEl.dataset.enabled = on ? 'true' : 'false';
  }
  if (tokenSaverPhase2BtnEl) {
    const on = rules.phase2ToolCompression === true;
    tokenSaverPhase2BtnEl.textContent = `L2 ${on ? 'on' : 'off'}`;
    tokenSaverPhase2BtnEl.className = `chip ${on ? 'state-thinking' : 'state-idle'} token-saver-toggle`;
    tokenSaverPhase2BtnEl.dataset.enabled = on ? 'true' : 'false';
  }
  if (tokenSaverDotEl) {applyDotState(tokenSaverDotEl, 'window', enabled ? (totalSaved > 0 || savedLast > 0 ? 'safe' : sendCount > 0 ? 'mid' : 'safe') : 'danger');}
}

async function refreshTokenSaverStats() {
  try {
    const res = await fetch('/api/coms/token-saver');
    const data = await res.json();
    if (!res.ok) {throw new Error(data.error || 'token saver stats unavailable');}
    renderTokenSaverState(data?.tokenSaver || {});
  } catch (error) {
    if (tokenSaverDetailEl) {tokenSaverDetailEl.innerHTML = `<span class="semantic-value">${error.message || error}</span>`;}
    if (tokenSaverDotEl) {applyDotState(tokenSaverDotEl, 'window', 'danger');}
  }
}

function formatDistBuiltAt(value) {
  if (!value) {return 'unknown';}
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {return String(value);}
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

function formatDistShortPath(value) {
  if (!value) {return 'unknown';}
  return String(value).replace(/^\/Users\/visen24\//, '~/');
}

function formatDistSummary(info = {}, runtime = null) {
  const touched = info?.distMtime || info?.buildInfoMtime || runtime?.distMtime || runtime?.buildInfoMtime || null;
  return touched ? formatDistBuiltAt(touched) : 'unknown';
}

function formatDistSync(info = {}) {
  return info?.mismatch ? 'sync mismatch' : 'sync ok';
}

function formatDistDirectory(configured = null, runtime = null) {
  const normalized = configured?.distRoot || (runtime?.entry ? runtime.entry.replace(/\/index\.js$/, '') : null) || 'unknown';
  return formatDistShortPath(normalized);
}

async function refreshDistInfo() {
  try {
    const res = await fetch('/api/dist-info');
    const data = await res.json();
    if (!res.ok) {throw new Error(data?.error || 'dist info unavailable');}
    const info = data?.info || null;
    const configured = info?.configured || null;
    const runtime = info?.runtime || configured || null;
    if (distDetailEl) {
      if (!configured && !runtime) {
        distDetailEl.innerHTML = '<span class="semantic-value">build info unavailable</span>';
      } else {
        const tone = info?.mismatch ? 'var(--accent-warn,#ffd166)' : 'var(--text-system-soft,#6FE7D2)';
        distDetailEl.innerHTML = [
          `<span class="semantic-value">${formatDistSummary(configured || runtime || {}, runtime)}</span>`,
          `<span class="semantic-value" style="color:${tone}">${formatDistSync(info)}</span>`,
          `<span class="semantic-value">${formatDistDirectory(configured, runtime)}</span>`
        ].join('<br>');
      }
    }
    if (distDotEl) {applyDotState(distDotEl, 'link', info?.mismatch ? 'danger' : ((configured || runtime) ? 'online' : 'offline'));}
  } catch (error) {
    if (distDetailEl) {distDetailEl.innerHTML = `<span class="semantic-value">${error?.message || error}</span>`;}
    if (distDotEl) {applyDotState(distDotEl, 'link', 'offline');}
  }
}

async function waitForWrapperReady(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch('/api/run-mode', { cache: 'no-store' });
      if (res.ok) {return true;}
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  throw new Error(`wrapper timeout after ${timeoutMs}ms`);
}

async function waitForGatewayReady(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch('/api/telemetry', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.gateway_connected !== false) {return true;}
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`gateway timeout after ${timeoutMs}ms`);
}

async function runInfraAction(name, fn) {
  if (infraActionInFlight) {
    throw new Error(`Another infrastructure action is already running: ${infraActionInFlight}`);
  }
  infraActionInFlight = name;
  try {
    return await fn();
  } finally {
    infraActionInFlight = null;
  }
}

async function rebuildDist() {
  if (!distRebuildBtnEl || distRebuildBtnEl.disabled) {return;}
  const prevText = distRebuildBtnEl.textContent;
  distRebuildBtnEl.disabled = true;
  distRebuildBtnEl.textContent = 'Rebuilding…';
  addDebugLine('Dist rebuild requested.', 'cyan');
  try {
    await runInfraAction('dist-rebuild', async () => {
      const res = await fetch('/api/dist-rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {throw new Error(data?.error || 'Failed to rebuild dist');}
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refreshDistInfo().catch(() => {});
    });
  } catch (error) {
    addDebugLine(`Dist rebuild failed: ${error?.message || error}`, 'pink');
  } finally {
    distRebuildBtnEl.disabled = false;
    distRebuildBtnEl.textContent = prevText || 'Rebuild';
  }
}

async function updateTokenSaverConfig(patch = {}) {
  const res = await fetch('/api/coms/token-saver', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) {throw new Error(data.error || 'token saver toggle failed');}
  renderTokenSaverState(data?.tokenSaver || {});
}

async function setTokenSaverEnabled(enabled) {
  return updateTokenSaverConfig({ enabled });
}

async function refreshCameraTelemetry() {
  try {
    const res = await fetch('/api/camera');
    const data = await res.json();
    if (!res.ok) {throw new Error(data.error || 'camera telemetry failed');}
    const state = data.enabled ? 'on' : 'off';
    const result = data.latestCapture ? `${data.latestCapture.name} · ${Math.round((data.latestCapture.size || 0) / 1024)} KB` : 'no captures yet';
    const stable = data.vision?.stable;
    const sampleCount = data.vision?.sampleCount;
    const detectedCount = data.vision?.detectedCount;
    const visionBase = data.vision?.label || 'none';
    const vision = sampleCount ? `${visionBase} · ${detectedCount ?? 0}/${sampleCount}` : visionBase;
    const gestureBase = data.vision?.gesture || 'none';
    const gesture = stable === false ? `${gestureBase} · unstable` : stable === true ? `${gestureBase} · stable` : gestureBase;
    setCameraState(state, result, vision, gesture);
    if (cameraPreviewEl) {
      if (data.latestCapture?.url) {
        cameraPreviewEl.src = `${data.latestCapture.url}?t=${Date.now()}`;
        cameraPreviewEl.style.display = 'block';
      } else {
        cameraPreviewEl.removeAttribute('src');
        cameraPreviewEl.style.display = 'none';
      }
    }
    if (cameraVisionLabelEl) {cameraVisionLabelEl.textContent = data.vision?.label || 'none';}
    if (cameraGestureLabelEl) {cameraGestureLabelEl.textContent = data.vision?.gesture || 'none';}
    setGestureRuntime(data.gestureRuntime || {});
  } catch {
    setCameraState('error', 'telemetry unavailable', 'unknown', 'unknown');
  }
}

async function runCameraCapture() {
  if (cameraCaptureBtnEl) {
    cameraCaptureBtnEl.disabled = true;
    cameraCaptureBtnEl.textContent = 'capturing';
  }
  setCameraState('busy', 'warmup capture running', 'capturing', 'pending');
  try {
    const captureRes = await fetch('/api/camera/capture-step', { method: 'POST' });
    const captureData = await captureRes.json();
    if (!captureRes.ok) {throw new Error(captureData.error || 'capture failed');}
    await refreshCameraTelemetry();
    addDebugLine(`Camera capture ok: ${captureData.capture?.path || 'unknown'}`, 'cyan');
  } catch (error) {
    setCameraState('error', error.message || 'capture failed', 'error', 'error');
    addDebugLine(`Camera capture failed: ${error.message || error}`, 'pink');
  } finally {
    if (cameraCaptureBtnEl) {
      cameraCaptureBtnEl.disabled = false;
      cameraCaptureBtnEl.textContent = 'capture';
    }
  }
}

function appendTerminalOutput(text, tone = 'cyan') {
  if (!terminalOutputEl) {return;}
  const stamp = formatStamp();
  const block = document.createElement('div');
  block.className = `terminal-block ${tone}`;
  block.textContent = `[${stamp}] ${text}`;
  terminalOutputEl.appendChild(block);
  terminalOutputEl.scrollTop = terminalOutputEl.scrollHeight;
}

function summarizeSafeEditResult(safeEdit) {
  if (!safeEdit) {return 'direct write';}
  const smokeOk = safeEdit?.checks?.smoke?.ok;
  const smokeLabel = smokeOk === true ? 'smoke ok' : smokeOk === false ? 'smoke warn' : 'smoke n/a';
  return `${safeEdit.strategy || 'safe-edit'} · ${safeEdit.status || 'unknown'} · ${smokeLabel}`;
}

function renderSafeEditState(data = {}) {
  const transactions = Array.isArray(data?.transactions) ? data.transactions : [];
  const latest = transactions[0] || null;
  const smoke = latest?.checks?.smoke || data?.smoke || null;
  const smokeChecks = Array.isArray(smoke?.checks) ? smoke.checks : [];
  const smokeSummary = smokeChecks.length
    ? smokeChecks.map(item => `${item.name}:${item.ok ? 'ok' : 'warn'}`).join(' · ')
    : (smoke?.ok === true ? 'ok' : smoke?.ok === false ? 'warn' : 'n/a');
  if (safeEditSummaryEl) {safeEditSummaryEl.innerHTML = `<span class="semantic-value">${latest ? `${latest.strategy || 'safe-edit'} · ${latest.status || 'unknown'}` : 'no transaction yet'}</span>`;}
  if (safeEditTxnDetailEl) {safeEditTxnDetailEl.innerHTML = `<span class="semantic-value">${latest ? `${String(latest.id || '').slice(0, 16)} · phases b:${latest.phases?.backup || '-'} s:${latest.phases?.stage || '-'} v:${latest.phases?.validate || '-'} c:${latest.phases?.commit || '-'} f:${latest.phases?.finalize || '-'}` : 'n/a'}</span>`;}
  if (safeEditSmokeDetailEl) {safeEditSmokeDetailEl.innerHTML = `<span class="semantic-value">${smokeSummary}</span>`;}
  if (safeEditDotEl) {applyDotState(safeEditDotEl, 'window', latest?.failed ? 'danger' : smoke?.ok === false ? 'mid' : latest ? 'safe' : 'mid');}
}

async function refreshSafeEditState() {
  try {
    const res = await fetch('/api/safe-edit/state');
    const data = await res.json();
    if (!res.ok) {throw new Error(data.error || 'safe-edit state unavailable');}
    _lastSafeEditState = data;
    renderSafeEditState(data);
  } catch (error) {
    addDebugLine(`Safe-edit state refresh failed: ${error.message || error}`, 'pink');
    if (safeEditSummaryEl) {safeEditSummaryEl.innerHTML = `<span class="semantic-value">unavailable</span>`;}
    if (safeEditTxnDetailEl) {safeEditTxnDetailEl.innerHTML = `<span class="semantic-value">${error.message || error}</span>`;}
    if (safeEditSmokeDetailEl) {safeEditSmokeDetailEl.innerHTML = `<span class="semantic-value">n/a</span>`;}
    if (safeEditDotEl) {applyDotState(safeEditDotEl, 'window', 'danger');}
  }
}

async function openCurrentDirectoryInFinder() {
  const res = await fetch('/api/explorer/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir: currentDir || '.' }),
  });
  const data = await res.json();
  if (!res.ok) {throw new Error(data.error || 'open directory failed');}
  appendTerminalOutput(`Opened in Finder: ${data.dir || currentDir}`, 'cyan');
}

async function ensureTerminalSession() {
  const res = await fetch(`/api/terminal/session?cwd=${encodeURIComponent(currentDir || '.')}`);
  const data = await res.json();
  if (!res.ok) {throw new Error(data.error || 'terminal session failed');}
  terminalSessionId = data.sessionId || 'default';
  if (terminalOutputEl) {terminalOutputEl.textContent = data.output || '';}
}

function updateClaudeFocusState() {
  if (!claudeTerminalHostEl) {return;}
  claudeTerminalHostEl.classList.toggle('is-focused', !!claude.focused);
}

async function sendClaudeRawInput(text) {
  if (!text) {return;}
  await fetch('/api/claude/input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, cwd: claude.cwd, raw: true }),
  });
}

async function flushClaudeInputBuffer() {
  if (claude.inputFlushTimer) {
    clearTimeout(claude.inputFlushTimer);
    claude.inputFlushTimer = null;
  }
  const payload = claude.inputBuffer;
  if (!payload) {return;}
  claude.inputBuffer = '';
  try {
    await sendClaudeRawInput(payload);
  } catch {}
}

function scheduleClaudeInputFlush() {
  if (claude.inputFlushTimer) {return;}
  claude.inputFlushTimer = window.setTimeout(() => {
    void flushClaudeInputBuffer();
  }, claude.inputFlushDelayMs);
}

function shouldSendClaudeInputImmediately(data) {
  if (!data) {return false;}
  if (data === '\r' || data === '\n') {return true;}
  if (data === '\u001b') {return true;}
  if (data.startsWith('\u001b[')) {return true;}
  if (data.startsWith('\u001bO')) {return true;}
  if (data.length === 1) {
    const code = data.charCodeAt(0);
    if (code < 32 && data !== '\u007f') {return true;}
  }
  return false;
}

function ensureClaudeTerminal() {
  if (claude.terminalReady || !claudeTerminalHostEl || !window.Terminal || !window.FitAddon?.FitAddon) {return;}
  claude.term = new window.Terminal({
    convertEol: false,
    cursorBlink: true,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 17,
    theme: {
      background: '#0b1020',
      foreground: '#d7f8ff',
      cursor: '#8fffe0',
      selectionBackground: 'rgba(143,255,224,0.18)',
    },
    scrollback: 5000,
    windowsPty: {
      backend: 'conpty',
      buildNumber: 0,
    },
  });
  claude.fitAddon = new window.FitAddon.FitAddon();
  claude.term.loadAddon(claude.fitAddon);
  claude.term.open(claudeTerminalHostEl);
  claude.fitAddon.fit();
  claudeTerminalHostEl?.addEventListener('focusin', () => {
    claude.focused = true;
    updateClaudeFocusState();
  });
  claudeTerminalHostEl?.addEventListener('focusout', () => {
    claude.focused = false;
    updateClaudeFocusState();
  });
  claude.term.onData(data => {
    if (!claude.running) {return;}
    if (shouldSendClaudeInputImmediately(data)) {
      void flushClaudeInputBuffer().finally(() => {
        sendClaudeRawInput(data).catch(() => {});
      });
      return;
    }
    claude.inputBuffer += data;
    scheduleClaudeInputFlush();
  });
  claude.term.onFocus?.(() => {
    claude.focused = true;
    updateClaudeFocusState();
  });
  claude.term.onBlur?.(() => {
    claude.focused = false;
    updateClaudeFocusState();
  });
  claudeTerminalHostEl?.addEventListener('pointerdown', () => {
    requestAnimationFrame(() => claude.term?.focus());
  });
  claude.terminalReady = true;
}

function sanitizeClaudeTerminalChunk(text) {
  const esc = String.fromCharCode(27);
  const bel = String.fromCharCode(7);
  const oscPattern = new RegExp(`${esc}\\][^${bel}${esc}]*(?:${bel}|${esc}\\\\)`, 'g');
  return String(text || '')
    .replace(oscPattern, '')
    .replace(/\uFFFD+/g, '')
    .replace(/\r\r\n/g, '\r\n');
}

function syncClaudeTerminalOutput() {
  ensureClaudeTerminal();
  const text = claude.output || '';
  if (!claude.term) {
    claude.error = claude.error || CLAUDE_TERMINAL_INIT_ERROR;
    return;
  }
  const nextChunk = sanitizeClaudeTerminalChunk(text.slice(claude.renderedLength));
  if (!nextChunk) {
    claude.renderedLength = text.length;
    claude.lastOutputLength = text.length;
    return;
  }
  claude.term.write(nextChunk, () => {
    if (claude.autoScroll) {claude.term.scrollToBottom();}
  });
  claude.renderedLength = text.length;
  claude.lastOutputLength = text.length;
}

function resetClaudeTerminalOutput() {
  ensureClaudeTerminal();
  if (!claude.term) {
    claude.error = claude.error || CLAUDE_TERMINAL_INIT_ERROR;
    claude.renderedLength = 0;
    return;
  }
  claude.term.reset();
  claude.renderedLength = 0;
  if (claude.outputTruncated) {
    const notice = '\x1b[2m[... earlier output not shown — log exceeded 50 KB limit ...]\x1b[0m\r\n';
    claude.term.write(notice);
  }
}

function setClaudeComposerStatus(message, tone = 'hint') {
  claude.composerStatus = message || 'Enter 发送 · Shift+Enter 换行';
  claude.composerStatusTone = tone || 'hint';
  if (claudeComposerStatusEl) {
    claudeComposerStatusEl.textContent = claude.composerStatus;
    claudeComposerStatusEl.dataset.tone = claude.composerStatusTone;
  }
}

function getClaudeComposerMode() {
  return claude.running ? 'reply' : 'dispatch';
}

function getClaudeComposerHint(mode = getClaudeComposerMode()) {
  return mode === 'reply'
    ? 'Reply to running Claude session: Enter send · Shift+Enter newline'
    : 'Dispatch new task: Enter send · Shift+Enter newline';
}

function getClaudeComposerPlaceholder(mode = getClaudeComposerMode()) {
  return mode === 'reply'
    ? 'Reply to the running Claude session…'
    : 'Dispatch a new task to Claude…';
}

function renderClaudeComposer() {
  const mode = getClaudeComposerMode();
  if (claudeComposerInputEl && document.activeElement !== claudeComposerInputEl) {
    if (claudeComposerInputEl.value !== claude.composerDraft) {claudeComposerInputEl.value = claude.composerDraft;}
  }
  resizeClaudeComposer();
  const trimmed = (claude.composerDraft || '').trim();
  const disabled = claude.loading || claude.composerSending;
  if (claudeComposerInputEl) {
    claudeComposerInputEl.disabled = disabled;
    claudeComposerInputEl.placeholder = getClaudeComposerPlaceholder(mode);
  }
  if (claudeComposerSendBtnEl) {
    claudeComposerSendBtnEl.disabled = disabled || !trimmed.length;
    claudeComposerSendBtnEl.textContent = claude.composerSending ? 'Sending…' : (mode === 'reply' ? 'Reply' : 'Dispatch');
  }
  if (claude.composerStatusTone === 'hint') {
    claude.composerStatus = getClaudeComposerHint(mode);
  }
  setClaudeComposerStatus(claude.composerStatus, claude.composerStatusTone);
}

async function submitClaudeComposer() {
  const value = String(claude.composerDraft || '').trim();
  const mode = getClaudeComposerMode();
  if (!value || claude.composerSending || claude.loading) {return;}
  claude.composerSending = true;
  setClaudeComposerStatus(mode === 'reply' ? 'Sending reply to Claude…' : 'Dispatching task to Claude…', 'busy');
  renderClaudeComposer();
  setConsoleTab('claude');
  addDebugLine(`Claude composer ${mode} len=${value.length}`, 'cyan');
  try {
    await flushClaudeInputBuffer();
    const endpoint = mode === 'reply' ? '/api/claude/input' : '/api/agent-tasks/dispatch';
    const body = mode === 'reply'
      ? { text: value, cwd: claude.cwd, raw: false }
      : { text: value, cwd: claude.cwd };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {throw new Error(data?.error || `Failed to ${mode} Claude`);}
    if (data.session) {applyClaudeStateData(data.session);}
    else {applyClaudeStateData(data);}
    claude.composerDraft = '';
    if (claudeComposerInputEl) {claudeComposerInputEl.value = '';}
    resizeClaudeComposer();
    renderClaudeComposer();
    addDebugLine(`Claude composer ${mode} accepted.`, 'cyan');
    setClaudeComposerStatus(
      mode === 'reply'
        ? 'Reply sent to running Claude session. Waiting for PTY output…'
        : 'Task dispatched to Claude. Waiting for PTY output…',
      'success',
    );
    window.setTimeout(() => {
      fetchClaudeState().catch(error => {
        addDebugLine(`Claude post-${mode} refresh failed: ${error?.message || error}`, 'pink');
      });
    }, 120);
    window.setTimeout(() => {
      fetchClaudeState().catch(() => {});
    }, 600);
    window.setTimeout(() => {
      if (!claude.composerDraft && !claude.composerSending) {setClaudeComposerStatus(getClaudeComposerHint(), 'hint');}
    }, 2200);
    claude.term?.focus();
    claudeComposerInputEl?.focus();
  } catch (error) {
    claude.error = error?.message || String(error);
    addDebugLine(`Claude composer ${mode} failed: ${claude.error}`, 'pink');
    setClaudeComposerStatus(claude.error || `${mode} failed, retry`, 'error');
    renderClaudeChrome();
    claudeComposerInputEl?.focus();
  } finally {
    claude.composerSending = false;
    renderClaudeComposer();
  }
}

async function fetchServerConfig() {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) {throw new Error(data?.error || 'config fetch failed');}
    Object.assign(serverConfig, data?.config || {});
    renderSetupBanner();
    const nextDefaultCwd = getDefaultClaudeCwd();
    claude.cwd = nextDefaultCwd;
    if (fileBrowserRootEl && serverConfig.projectRoot) {fileBrowserRootEl.textContent = serverConfig.projectRoot;}
    renderClaudeChrome();
    fetchClaudeState().catch(error => {
      claude.error = error?.message || String(error);
      renderClaudeChrome();
    });
  } catch (error) {
    addDebugLine(`config fetch failed: ${error?.message || error}`, 'pink');
  }
}

function renderClaudeChrome() {
  if (claudeStatusBadgeEl) {
    const nextStatus = claude.status || 'idle';
    if (claudeStatusBadgeEl.textContent !== nextStatus) {claudeStatusBadgeEl.textContent = nextStatus;}
    if (claudeStatusBadgeEl.dataset.status !== nextStatus) {claudeStatusBadgeEl.dataset.status = nextStatus;}
  }
  if (claudeCwdInputEl && document.activeElement !== claudeCwdInputEl) {
    const nextCwd = claude.cwd || getDefaultClaudeCwd();
    if (claudeCwdInputEl.value !== nextCwd) {claudeCwdInputEl.value = nextCwd;}
  }
  if (claudeMetaEl) {
    const nextMeta = `<span class="claude-meta-chunk"><span class="semantic-label">session</span><span class="semantic-value">${claude.sessionId || 'claude-default'}</span></span><span class="claude-meta-sep">·</span><span class="claude-meta-chunk"><span class="semantic-label">running</span><span class="semantic-value">${claude.running ? 'yes' : 'no'}</span></span><span class="claude-meta-sep">·</span><span class="claude-meta-chunk"><span class="semantic-label">exit</span><span class="semantic-value">${claude.exitCode ?? '-'}</span></span><span class="claude-meta-sep">·</span><span class="claude-meta-chunk"><span class="semantic-label">status</span><span class="semantic-value">${claude.status || 'idle'}</span></span>`;
    if (claudeMetaEl.innerHTML !== nextMeta) {claudeMetaEl.innerHTML = nextMeta;}
  }
  if (claudeErrorEl) {
    const nextError = claude.error || '';
    if (claudeErrorEl.textContent !== nextError) {claudeErrorEl.textContent = nextError;}
  }
  if (claudeStartBtnEl) {claudeStartBtnEl.disabled = claude.loading || claude.running;}
  if (claudeStopBtnEl) {claudeStopBtnEl.disabled = claude.loading || !claude.running;}
  if (claudeRestartBtnEl) {claudeRestartBtnEl.disabled = claude.loading;}
  if (claudeAutoScrollEl) {claudeAutoScrollEl.checked = !!claude.autoScroll;}
}

function renderClaudePanel() {
  ensureClaudeTerminal();
  if (claudeOutputEl) {claudeOutputEl.hidden = true;}
  if (claudeTerminalHostEl) {claudeTerminalHostEl.hidden = !claude.term;}
  if (!claude.term) {
    claude.error = claude.error || CLAUDE_TERMINAL_INIT_ERROR;
  }
  renderClaudeChrome();
  renderClaudeComposer();
  syncClaudeTerminalOutput();
}

function maybeScrollClaudeOutput() {
  if (!claude.term || !claude.autoScroll) {return;}
  claude.term.scrollToBottom();
}

function measureClaudeTerminalGeometry() {
  const host = claudeTerminalHostEl;
  if (!host) {return null;}
  const helper = host.querySelector('.xterm-helper-textarea');
  const measure = host.querySelector('.xterm-char-measure-element');
  const screen = host.querySelector('.xterm-screen');
  const charWidth = helper?.getBoundingClientRect?.().width || (measure ? (measure.getBoundingClientRect().width / 32) : 0);
  const charHeight = helper?.getBoundingClientRect?.().height || measure?.getBoundingClientRect?.().height || 0;
  const screenWidth = screen?.getBoundingClientRect?.().width || 0;
  const screenHeight = screen?.getBoundingClientRect?.().height || 0;
  if (!charWidth || !charHeight || !screenWidth || !screenHeight) {return null;}
  return {
    cols: Math.max(2, Math.floor(screenWidth / charWidth)),
    rows: Math.max(2, Math.floor(screenHeight / charHeight)),
    charWidth,
    charHeight,
    screenWidth,
    screenHeight,
  };
}

async function resizeClaudeSession() {
  ensureClaudeTerminal();
  if (!claude.term) {return;}
  if (claude.fitAddon) {claude.fitAddon.fit();}
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const measured = measureClaudeTerminalGeometry();
  const hostWidth = claudeTerminalHostEl?.clientWidth || 0;
  const hostHeight = claudeTerminalHostEl?.clientHeight || 0;
  const fallbackCols = Math.max(40, Math.floor(hostWidth / 8));
  const fallbackRows = Math.max(12, Math.floor(hostHeight / 18));
  const cols = measured?.cols || claude.term.cols || fallbackCols;
  const rows = measured?.rows || claude.term.rows || fallbackRows;
  if (cols !== claude.term.cols || rows !== claude.term.rows) {
    claude.term.resize(cols, rows);
  }
  try {
    await fetch('/api/claude/resize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cols, rows }),
    });
  } catch {}
}

function applyClaudeStateData(data) {
  const prevOutput = claude.output || '';
  const prevStatus = claude.status;
  const prevRunning = claude.running;
  const prevExitCode = claude.exitCode;
  const prevSessionId = claude.sessionId;
  const prevOutputStart = Number.isFinite(claude.outputStart) ? claude.outputStart : 0;
  const prevOutputSize = Number.isFinite(claude.outputSize) ? claude.outputSize : 0;
  claude.sessionId = data.sessionId || 'claude-default';
  claude.cwd = data.cwd || claude.cwd;
  claude.status = data.status || (data.running ? 'running' : 'idle');
  claude.running = !!data.running;
  claude.started = !!data.started;
  claude.exited = !!data.exited;
  claude.exitCode = data.exitCode ?? null;
  claude.outputTruncated = !!data.outputTruncated;
  claude.outputStart = Number.isFinite(data.outputStart) ? data.outputStart : 0;
  claude.outputSize = Number.isFinite(data.outputSize) ? data.outputSize : 0;
  const nextOutput = data.output || '';
  const tailWindowShifted = claude.outputStart !== prevOutputStart;
  const logRewound = claude.outputSize < prevOutputSize;
  const sessionChanged = claude.sessionId !== prevSessionId;
  if (sessionChanged || logRewound || tailWindowShifted || !nextOutput.startsWith(prevOutput)) {resetClaudeTerminalOutput();}
  claude.output = nextOutput;
  claude.error = '';
  const chromeChanged = prevStatus !== claude.status || prevRunning !== claude.running || prevExitCode !== claude.exitCode || prevSessionId !== claude.sessionId;
  if (chromeChanged) {
    renderClaudeChrome();
    renderClaudeComposer();
  }
  if (nextOutput !== prevOutput) {syncClaudeTerminalOutput();}
  if (claude.running) {ensureClaudePolling();}
  else {stopClaudePolling();}
}

async function fetchClaudeState() {
  const res = await fetch(`/api/claude/state?cwd=${encodeURIComponent(claude.cwd || getDefaultClaudeCwd())}`, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) {throw new Error(data?.error || 'Failed to fetch Claude state');}
  applyClaudeStateData(data);
}

function ensureClaudePolling() {
  if (claude.pollTimer) {return;}
  claude.pollTimer = window.setInterval(async () => {
    if (claude.polling) {return;}
    claude.polling = true;
    try {
      await fetchClaudeState();
    } catch (error) {
      claude.error = error?.message || String(error);
      renderClaudeChrome();
    } finally {
      claude.polling = false;
    }
  }, claude.pollIntervalMs);
}

function stopClaudePolling() {
  if (claude.pollTimer) {
    clearInterval(claude.pollTimer);
    claude.pollTimer = null;
  }
}

function queueClaudeAutoStart() {
  return;
}

async function startClaude() {
  claude.inputBuffer = '';
  if (claude.inputFlushTimer) {
    clearTimeout(claude.inputFlushTimer);
    claude.inputFlushTimer = null;
  }
  claude.loading = true;
  claude.error = '';
  claude.status = 'starting';
  claude.cwd = (claudeCwdInputEl?.value || getDefaultClaudeCwd()).trim() || getDefaultClaudeCwd();
  renderClaudePanel();
  try {
    const res = await fetch('/api/claude/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd: claude.cwd }),
    });
    const data = await res.json();
    if (!res.ok) {throw new Error(data?.error || 'Failed to start Claude');}
    applyClaudeStateData(data);
    window.setTimeout(() => fetchClaudeState().catch(() => {}), 250);
  } catch (error) {
    claude.error = error?.message || String(error);
    claude.status = 'error';
  } finally {
    claude.loading = false;
    renderClaudePanel();
    claude.term?.focus();
  }
}

async function stopClaude() {
  flushClaudeInputBuffer().catch(() => {});
  syncClaudeCwdToExplorer({ force: true });
  claude.loading = true;
  claude.error = '';
  renderClaudePanel();
  try {
    const res = await fetch('/api/claude/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) {throw new Error(data?.error || 'Failed to stop Claude');}
    applyClaudeStateData(data);
  } catch (error) {
    claude.error = error?.message || String(error);
  } finally {
    claude.loading = false;
    renderClaudePanel();
  }
}

async function restartClaude() {
  claude.inputBuffer = '';
  if (claude.inputFlushTimer) {clearTimeout(claude.inputFlushTimer); claude.inputFlushTimer = null;}
  syncClaudeCwdToExplorer({ force: true });
  claude.loading = true;
  claude.error = '';
  claude.cwd = (claudeCwdInputEl?.value || getDefaultClaudeCwd()).trim() || getDefaultClaudeCwd();
  renderClaudePanel();
  try {
    const res = await fetch('/api/claude/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd: claude.cwd }),
    });
    const data = await res.json();
    if (!res.ok) {throw new Error(data?.error || 'Failed to restart Claude');}
    applyClaudeStateData(data);
  } catch (error) {
    claude.error = error?.message || String(error);
  } finally {
    claude.loading = false;
    renderClaudePanel();
  }
}

async function restartWrapper() {
  if (!wrapperRestartBtnEl || wrapperRestartBtnEl.disabled) {return;}
  const prevText = wrapperRestartBtnEl.textContent;
  wrapperRestartBtnEl.disabled = true;
  wrapperRestartBtnEl.textContent = 'Restarting…';
  addDebugLine('Wrapper restart requested.', 'cyan');
  try {
    await runInfraAction('wrapper-restart', async () => {
      const res = await fetch('/api/wrapper/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {throw new Error(data?.error || 'Failed to restart wrapper');}
      await waitForWrapperReady(20000);
    });
  } catch (error) {
    addDebugLine(`Wrapper restart failed: ${error?.message || error}`, 'pink');
  } finally {
    wrapperRestartBtnEl.disabled = false;
    wrapperRestartBtnEl.textContent = prevText || 'Restart';
  }
}

async function restartGateway() {
  if (!gatewayRestartBtnEl || gatewayRestartBtnEl.disabled) {return;}
  const prevText = gatewayRestartBtnEl.textContent;
  gatewayRestartBtnEl.disabled = true;
  gatewayRestartBtnEl.textContent = 'Restarting gateway…';
  addDebugLine('Gateway restart requested.', 'cyan');
  try {
    await runInfraAction('gateway-restart', async () => {
      const res = await fetch('/api/gateway/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {throw new Error(data?.error || 'Failed to restart gateway');}
      await waitForGatewayReady(30000);
    });
  } catch (error) {
    addDebugLine(`Gateway restart failed: ${error?.message || error}`, 'pink');
  } finally {
    gatewayRestartBtnEl.disabled = false;
    gatewayRestartBtnEl.textContent = prevText || 'Restart';
  }
}

async function compactContext() {
  if (!contextCompactBtnEl || contextCompactBtnEl.disabled) {return;}
  const prevText = contextCompactBtnEl.textContent;
  contextCompactBtnEl.disabled = true;
  contextCompactBtnEl.textContent = 'Compacting…';
  addDebugLine('Context compaction requested.', 'cyan');
  try {
    const res = await fetch('/api/context/compact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionKey: selectedSessionKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {throw new Error(data?.error || 'Failed to compact context');}
    const compacted = data?.result?.compacted;
    const reason = data?.result?.reason ? ` (${data.result.reason})` : '';
    addDebugLine(compacted === false ? `Context compaction skipped${reason}.` : 'Context compaction finished.', compacted === false ? 'pink' : 'cyan');
    contextCompactBtnEl.textContent = compacted === false ? 'Skipped' : 'Done';
    setTimeout(() => {
      if (contextCompactBtnEl) {
        contextCompactBtnEl.disabled = false;
        contextCompactBtnEl.textContent = prevText || 'Compact';
      }
    }, 2200);
  } catch (error) {
    addDebugLine(`Context compaction failed: ${error?.message || error}`, 'pink');
    contextCompactBtnEl.disabled = false;
    contextCompactBtnEl.textContent = prevText || 'Compact';
  }
}

function buildMockReplies() {
  return [
    {
      id: 'reply_mock_1',
      source: 'chatgpt-web',
      provider: 'openai',
      title: 'Summarize the current dashboard bug',
      promptText: 'Please summarize the likely causes of the session switching bug.',
      replyText: 'The most likely cause is a stale client-side render path combined with session history refresh races.',
      sourceUrl: 'https://chatgpt.com/c/mock-1',
      capturedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      status: 'new',
    },
    {
      id: 'reply_mock_2',
      source: 'chatgpt-web',
      provider: 'openai',
      title: 'Implementation plan for replies inbox',
      promptText: 'Design an MVP external replies inbox inside VioDashboard.',
      replyText: 'Build a dedicated Replies pane with summary list, detail card, inbox persistence, ingest API, and simple actions.',
      sourceUrl: 'https://chatgpt.com/c/mock-2',
      capturedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      status: 'done',
    },
  ];
}

function formatReplyTime(value) {
  if (!value) {return 'unknown time';}
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return String(value);
  }
}

function getSelectedReply() {
  return repliesState.items.find(item => item.id === repliesState.selectedId) || null;
}

function renderRepliesList() {
  if (!repliesListEl) {return;}
  repliesListEl.innerHTML = '';

  if (!repliesState.items.length) {
    repliesListEl.innerHTML = '<div class="reply-empty">No replies yet.</div>';
    return;
  }

  for (const item of repliesState.items) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `reply-list-item ${item.id === repliesState.selectedId ? 'is-selected' : ''}`.trim();
    el.innerHTML = `
      <div class="reply-list-title">${escapeHtml(item.title || item.source || item.id)}</div>
      <div class="reply-list-meta">${escapeHtml(item.source || 'unknown')} · ${escapeHtml(formatReplyTime(item.capturedAt))}</div>
      <div class="reply-list-preview">${escapeHtml(String(item.replyText || '').slice(0, 140))}</div>
    `;
    el.addEventListener('click', () => selectReply(item.id));
    repliesListEl.appendChild(el);
  }
}

function renderReplyDetail() {
  if (!replyDetailEl || !replyEmptyEl) {return;}
  const item = getSelectedReply();

  if (!item) {
    replyEmptyEl.hidden = false;
    replyDetailEl.hidden = true;
    replyDetailEl.innerHTML = '';
    return;
  }

  replyEmptyEl.hidden = true;
  replyDetailEl.hidden = false;

  const statusClass = item.status === 'done' ? 'reply-status-done' : 'reply-status-new';
  replyDetailEl.innerHTML = `
    <article class="reply-card">
      <div class="reply-card-header">
        <div>
          <div class="reply-card-title">${escapeHtml(item.title || item.id)}</div>
          <div class="reply-card-meta">${escapeHtml(item.provider || 'unknown')} · ${escapeHtml(formatReplyTime(item.capturedAt))}</div>
        </div>
        <span class="reply-badge ${statusClass}">${escapeHtml(item.status || 'new')}</span>
      </div>

      <div class="reply-card-body">
        <div class="reply-section">
          <div class="reply-section-label">Source</div>
          <div class="reply-section-content">${escapeHtml(item.sourceUrl || item.source || 'unknown')}</div>
        </div>

        <div class="reply-section">
          <div class="reply-section-label">Prompt</div>
          <div class="reply-section-content">${escapeHtml(item.promptText || '')}</div>
        </div>

        <div class="reply-section">
          <div class="reply-section-label">Reply</div>
          <div class="reply-section-content">${escapeHtml(item.replyText || '')}</div>
        </div>
      </div>
    </article>
  `;
}

function selectReply(id) {
  repliesState.selectedId = id;
  renderRepliesList();
  renderReplyDetail();
}

async function fetchRepliesList() {
  repliesState.loading = true;
  repliesState.error = '';
  try {
    const res = await fetch('/api/external-replies/inbox', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to fetch external replies');
    }
    repliesState.items = Array.isArray(data?.items) ? data.items : [];
    if (!repliesState.selectedId || !repliesState.items.some(item => item.id === repliesState.selectedId)) {
      repliesState.selectedId = repliesState.items[0]?.id || null;
    }
  } catch (error) {
    repliesState.error = error?.message || String(error);
    repliesState.items = buildMockReplies();
    if (!repliesState.selectedId || !repliesState.items.some(item => item.id === repliesState.selectedId)) {
      repliesState.selectedId = repliesState.items[0]?.id || null;
    }
    addDebugLine(`Replies fallback to mock data: ${repliesState.error}`, 'pink');
  } finally {
    repliesState.loading = false;
    renderRepliesList();
    renderReplyDetail();
  }
}

async function ingestTestReply() {
  const payload = {
    source: 'chatgpt-web',
    provider: 'openai',
    title: 'Test ingested reply',
    promptText: 'This is a mock prompt injected from the Replies pane.',
    replyText: 'This is a mock reply used to validate the Replies pane UI before backend wiring.',
    sourceUrl: 'https://chatgpt.com/c/test-ingest',
    capturedAt: new Date().toISOString(),
    status: 'new',
  };

  const res = await fetch('/api/external-replies/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to ingest test reply');
  }

  await fetchRepliesList();
  if (data?.item?.id) {
    repliesState.selectedId = data.item.id;
    renderRepliesList();
    renderReplyDetail();
  }
}

async function sendReplyToVio(id) {
  const item = repliesState.items.find(entry => entry.id === id);
  if (!item) {return;}
  if (!selectedSessionKey) {
    addDebugLine('Send to Vio skipped: no active dashboard session selected.', 'pink');
    return;
  }
  const outboundText = [
    `External reply handoff: ${item.title || item.id}`,
    item.sourceUrl ? `Source: ${item.sourceUrl}` : null,
    item.promptText ? `Original prompt:\n${item.promptText}` : null,
    `Reply:\n${item.replyText || ''}`,
  ].filter(Boolean).join('\n\n');
  const result = await sendToSelectedSession(outboundText, {
    userText: outboundText,
    attachments: [],
  });
  if (!result?.ok) {
    addDebugLine(`Send to Vio failed: ${result?.error || 'unknown error'}`, 'pink');
    return;
  }
  addDebugLine(`Reply handed to Vio session ${result.sessionKey || selectedSessionKey}`, 'cyan');
}

async function openReplyCaptureSetup() {
  await loadFile('tools/chatgpt-reply-capture.user.js');
  setWorkspaceTab('code');
  addDebugLine('Opened ChatGPT capture script. Install/update it in Tampermonkey from the code view.', 'cyan');
}

async function saveReplyToWorkspace(id) {
  const res = await fetch(`/api/external-replies/${encodeURIComponent(id)}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to save reply to workspace');
  }
  addDebugLine(`Reply saved to workspace: ${data?.path || id}`, 'cyan');
  if (typeof data?.path === 'string') {
    try {
      await loadFile(data.path);
      setWorkspaceTab('code');
    } catch (error) {
      addDebugLine(`Saved reply file open skipped: ${error?.message || error}`, 'pink');
    }
  }
}

async function markReplyDone(id) {
  const item = repliesState.items.find(entry => entry.id === id);
  if (!item) {return;}
  const res = await fetch(`/api/external-replies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'done' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to mark reply done');
  }
  const next = data?.item || { ...item, status: 'done' };
  repliesState.items = repliesState.items.map(entry => entry.id === id ? next : entry);
  renderRepliesList();
  renderReplyDetail();
  addDebugLine(`Reply marked done: ${id}`, 'cyan');
}

async function deleteReply(id) {
  const item = repliesState.items.find(entry => entry.id === id);
  if (!item) {return;}
  const ok = window.confirm(`Delete reply "${item.title || id}"?`);
  if (!ok) {return;}

  const res = await fetch(`/api/external-replies/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMessage = String(data?.error || 'Failed to delete reply');
    const normalized = errorMessage.toLowerCase();
    if (!(res.status === 404 || normalized.includes('reply not found') || normalized.includes('not found'))) {
      throw new Error(errorMessage);
    }
    addDebugLine(`Reply already gone on server: ${id}`, 'pink');
  } else {
    addDebugLine(`Reply deleted: ${id}`, 'cyan');
  }

  const nextItems = repliesState.items.filter(entry => entry.id !== id);
  repliesState.items = nextItems;
  if (repliesState.selectedId === id) {
    repliesState.selectedId = nextItems[0]?.id || null;
  }
  renderRepliesList();
  renderReplyDetail();
  await fetchRepliesList();
}

function openReplySource(id) {
  const item = repliesState.items.find(entry => entry.id === id);
  if (!item?.sourceUrl) {return;}
  window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
}

function setWorkspaceTab(tab) {
  workspaceTabs.active = tab === 'replies' ? 'replies' : 'code';
  const isCode = workspaceTabs.active === 'code';
  const isReplies = workspaceTabs.active === 'replies';
  workspaceTabCodeEl?.classList.toggle('is-active', isCode);
  workspaceTabRepliesEl?.classList.toggle('is-active', isReplies);
  workspaceTabCodeEl?.setAttribute('aria-selected', isCode ? 'true' : 'false');
  workspaceTabRepliesEl?.setAttribute('aria-selected', isReplies ? 'true' : 'false');
  workspacePaneCodeEl?.classList.toggle('is-active', isCode);
  workspacePaneRepliesEl?.classList.toggle('is-active', isReplies);
  if (activeFilePathEl) {
    activeFilePathEl.hidden = isReplies;
  }
  if (workspaceCodeActionsEl) {
    workspaceCodeActionsEl.hidden = isReplies;
  }
  if (workspaceRepliesToolbarEl) {
    workspaceRepliesToolbarEl.hidden = isCode;
  }
  if (isReplies) {
    renderRepliesList();
    renderReplyDetail();
  }
}

function setConsoleTab(tab) {
  consoleTabs.active = tab === 'claude' ? 'claude' : 'terminal';
  const isTerminal = consoleTabs.active === 'terminal';
  const isClaude = consoleTabs.active === 'claude';
  consoleTabTerminalEl?.classList.toggle('is-active', isTerminal);
  consoleTabClaudeEl?.classList.toggle('is-active', isClaude);
  consolePaneTerminalEl?.classList.toggle('is-active', isTerminal);
  consolePaneClaudeEl?.classList.toggle('is-active', isClaude);
  if (isClaude) {
    renderClaudePanel();
    if (claude.running) {ensureClaudePolling();}
    queueClaudeAutoStart();
    requestAnimationFrame(() => {
      maybeScrollClaudeOutput();
      void resizeClaudeSession();
      claude.term?.focus();
      if (!claude.term && claudeComposerInputEl) {claudeComposerInputEl.focus();}
    });
  }
}

function bindConsoleTabEvents() {
  consoleTabTerminalEl?.addEventListener('click', () => setConsoleTab('terminal'));
  consoleTabClaudeEl?.addEventListener('click', () => setConsoleTab('claude'));
  workspaceTabCodeEl?.addEventListener('click', () => setWorkspaceTab('code'));
  workspaceTabRepliesEl?.addEventListener('click', () => setWorkspaceTab('replies'));
}

function bindClaudeEvents() {
  if (claudeStartBtnEl) {
    claudeStartBtnEl.addEventListener('click', startClaude);
    claudeStartBtnEl.dataset.bound = '1';
  }
  if (claudeStopBtnEl) {claudeStopBtnEl.addEventListener('click', stopClaude);}
  if (claudeRestartBtnEl) {claudeRestartBtnEl.addEventListener('click', restartClaude);}
  claudeCwdInputEl?.addEventListener('change', event => {
    claude.cwd = String(event.target.value || '').trim() || getDefaultClaudeCwd();
  });
  claudeAutoScrollEl?.addEventListener('change', event => {
    claude.autoScroll = !!event.target.checked;
  });
  claudeTerminalHostEl?.addEventListener('click', () => claude.term?.focus());
  claudeComposerInputEl?.addEventListener('input', event => {
    claude.composerDraft = event.target.value || '';
    if (claude.composerStatusTone === 'error' || claude.composerStatusTone === 'success') {
      setClaudeComposerStatus(getClaudeComposerHint(), 'hint');
    }
    renderClaudeComposer();
  });
  claudeComposerInputEl?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') {return;}
    if (event.shiftKey || event.isComposing) {return;}
    event.preventDefault();
    submitClaudeComposer().catch(() => {});
  });
  claudeComposerFormEl?.addEventListener('submit', event => {
    event.preventDefault();
    submitClaudeComposer().catch(() => {});
  });
  window.__CLAUDE_PANEL_BOUND__ = true;
}

function initClaudePanel() {
  bindConsoleTabEvents();
  bindClaudeEvents();
  setWorkspaceTab('code');
  renderClaudePanel();
  let claudeResizeScheduled = false;
  let claudeResizeSettledTimer = null;
  const scheduleClaudeResize = () => {
    if (consoleTabs.active !== 'claude') {return;}
    if (!claudeResizeScheduled) {
      claudeResizeScheduled = true;
      requestAnimationFrame(() => {
        claudeResizeScheduled = false;
        void resizeClaudeSession();
      });
    }
    if (claudeResizeSettledTimer) {clearTimeout(claudeResizeSettledTimer);}
    claudeResizeSettledTimer = window.setTimeout(() => {
      claudeResizeSettledTimer = null;
      void resizeClaudeSession();
    }, 96);
  };
  if (window.ResizeObserver && claudeTerminalHostEl) {
    const ro = new ResizeObserver(() => {
      scheduleClaudeResize();
      resizeClaudeComposer();
    });
    ro.observe(claudeTerminalHostEl);
    if (consolePaneClaudeEl) {ro.observe(consolePaneClaudeEl);}
    if (claudeComposerInputEl) {ro.observe(claudeComposerInputEl);}
  }
  window.addEventListener('resize', () => {
    scheduleClaudeResize();
  });
  setConsoleTab('claude');
  fetchClaudeState().catch(error => {
    claude.error = error?.message || String(error);
    renderClaudePanel();
  });
}

async function runTerminalCommand(command) {
  const res = await fetch('/api/terminal/input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: terminalSessionId, cwd: currentDir || '.', text: `${command}
` }),
  });
  const data = await res.json();
  if (!res.ok) {throw new Error(data.error || 'terminal input failed');}
  if (terminalOutputEl) {terminalOutputEl.textContent = data.output || '';}
  terminalOutputEl.scrollTop = terminalOutputEl.scrollHeight;
}

function renderFileTree(entries) {
  if (!fileTreeEl) {return;}
  fileTreeEl.innerHTML = '';
  for (const entry of entries) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `file-tree-item ${entry.type}`;
    item.textContent = entry.name || entry.path;
    if (entry.type === 'file') {item.addEventListener('click', () => loadFile(entry.path));}
    else {item.addEventListener('click', () => openDirectory(entry.path));}
    fileTreeEl.appendChild(item);
  }
}

function syncFileNavButtons() {
  if (fileBackBtnEl) {fileBackBtnEl.disabled = currentDir === '.';}
  if (fileForwardBtnEl) {fileForwardBtnEl.disabled = lastVisitedDirs.length === 0;}
}

function escapeHtml(text) { return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function renderInlineChatMarkdown(text = '') {
  return escapeHtml(String(text || ''))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a class="chat-link" href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderChatMarkdown(text = '') {
  const source = String(text || '').replace(/\r\n?/g, '\n');
  const parts = [];
  const fencedRe = /```([a-zA-Z0-9_-]+)?[ \t]*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = fencedRe.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: source.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'code',
      lang: String(match[1] || '').trim(),
      value: String(match[2] || ''),
    });
    lastIndex = fencedRe.lastIndex;
  }

  if (lastIndex < source.length) {
    parts.push({ type: 'text', value: source.slice(lastIndex) });
  }

  const out = [];
  for (const part of parts) {
    if (part.type === 'code') {
      const langAttr = part.lang ? ` data-lang="${escapeHtml(part.lang)}"` : '';
      out.push(`<pre class="chat-code-block"${langAttr}><code>${escapeHtml(part.value)}</code></pre>`);
      continue;
    }

    const lines = String(part.value || '').split('\n');
    let listType = null;

    const closeList = () => {
      if (!listType) {return;}
      out.push(listType === 'ol' ? '</ol>' : '</ul>');
      listType = null;
    };

    for (const rawLine of lines) {
      const line = String(rawLine || '');
      const trimmed = line.trim();
      const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);

      if (bullet || numbered) {
        const nextListType = numbered ? 'ol' : 'ul';
        if (listType !== nextListType) {
          closeList();
          out.push(nextListType === 'ol' ? '<ol class="chat-md-list">' : '<ul class="chat-md-list">');
          listType = nextListType;
        }
        out.push(`<li>${renderInlineChatMarkdown((bullet || numbered)[1])}</li>`);
        continue;
      }

      closeList();

      if (!trimmed) {
        out.push('<div class="chat-md-space"></div>');
      } else {
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = Math.min(3, headingMatch[1].length);
          out.push(`<div class="chat-md-h${level}">${renderInlineChatMarkdown(headingMatch[2])}</div>`);
        } else if (/^>\s+/.test(trimmed)) {
          out.push(`<div class="chat-md-quote">${renderInlineChatMarkdown(trimmed.replace(/^>\s+/, ''))}</div>`);
        } else {
          out.push(`<div class="chat-md-p">${renderInlineChatMarkdown(line)}</div>`);
        }
      }
    }

    closeList();
  }

  return out.join('');
}

function renderMarkdownHighlight(text, filePath = '') {
  const escaped = escapeHtml(text);
  const isMarkdown = /\.md$/i.test(filePath || '');
  if (!isMarkdown) {
    if (fileModeBadgeEl) {fileModeBadgeEl.textContent = 'plain';}
    return escaped;
  }
  if (fileModeBadgeEl) {fileModeBadgeEl.textContent = 'markdown';}
  return escaped
    .replace(/^(#{1,6}\s.*)$/gm, '<span class="md-h1">$1</span>')
    .replace(/^(\s*[-*+]\s.*)$/gm, '<span class="md-list">$1</span>')
    .replace(/^(>\s.*)$/gm, '<span class="md-quote">$1</span>')
    .replace(/(```[\s\S]*?```)/g, '<span class="md-codefence">$1</span>')
    .replace(/(`[^`]+`)/g, '<span class="md-inline-code">$1</span>')
    .replace(/(\*\*[^*]+\*\*)/g, '<span class="md-strong">$1</span>')
    .replace(/(\*[^*]+\*)/g, '<span class="md-emph">$1</span>')
    .replace(/(\[[^\]]+\]\([^)]+\))/g, '<span class="md-link-text">$1</span>');
}
function syncEditorHighlight() {
  if (!fileEditorEl || !fileHighlightEl) {return;}
  fileHighlightEl.innerHTML = renderMarkdownHighlight(fileEditorEl.value, currentFilePath || '');
  fileHighlightEl.scrollTop = fileEditorEl.scrollTop;
  fileHighlightEl.scrollLeft = fileEditorEl.scrollLeft;
}

async function loadFile(relPath) {
  if (!fileEditorEl || !activeFilePathEl) {return;}
  const dir = relPath.includes('/') ? relPath.split('/').slice(0, -1).join('/') : '.';
  if (dir !== currentDir) {await loadFileTree(dir || '.');}
  currentFilePath = relPath;
  activeFilePathEl.innerHTML = `<span class="semantic-label">file</span> <span class="semantic-value">${relPath}</span>`;
  fileEditorEl.value = 'Loading…';
  syncEditorHighlight();
  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(relPath)}`);
    const data = await res.json();
    if (!res.ok) {throw new Error(data.error || 'file load failed');}
    currentFileOriginal = data.content;
    fileEditorEl.value = data.content;
    syncEditorHighlight();
    addDebugLine(`Loaded file preview: ${relPath}`, 'cyan');
  } catch (error) {
    fileEditorEl.value = `Failed to load file:\n${error.message || error}`;
    syncEditorHighlight();
  }
}

async function loadFileTree(dir = currentDir) {
  if (!fileTreeEl) {return;}
  fileTreeEl.innerHTML = '<div class="event-sub"><span class="semantic-value">Loading files…</span></div>';
  try {
    const res = await fetch(`/api/files?dir=${encodeURIComponent(dir)}`);
    const data = await res.json();
    if (!res.ok) {throw new Error(data.error || 'file list failed');}
    currentDir = data.currentDir || '.';
    if (fileBrowserRootEl) {fileBrowserRootEl.textContent = currentDir;}
    if (terminalCwdEl) {terminalCwdEl.textContent = currentDir;}
    syncClaudeCwdToExplorer();
    renderFileTree(data.entries || []);
    syncFileNavButtons();
  } catch (error) {
    fileTreeEl.innerHTML = `<div class="event-sub"><span class="semantic-value">${error.message || error}</span></div>`;
  }
}

function syncClaudeCwdToExplorer({ force = false } = {}) {
  const explorerDir = String(currentDir || '.').trim() || '.';
  const currentClaudeCwd = String(claude.cwd || '').trim();
  const inputValue = String(claudeCwdInputEl?.value || '').trim();
  const shouldAdopt = force || isPlaceholderClaudeCwd(currentClaudeCwd) || currentClaudeCwd === inputValue;
  if (!shouldAdopt) {return false;}
  claude.cwd = explorerDir;
  if (claudeCwdInputEl && document.activeElement !== claudeCwdInputEl) {
    claudeCwdInputEl.value = explorerDir;
  }
  renderClaudeChrome();
  return true;
}

function openDirectory(dirPath) {
  if (currentDir && currentDir !== dirPath) {lastVisitedDirs.push(currentDir);}
  void loadFileTree(dirPath);
}

function markLatestAssistantReplyAborted(runId = null, sessionKey = null) {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST_ASSISTANT_REPLY_KEY) || 'null') || {};
    const next = {
      ...raw,
      runId: runId || raw.runId || null,
      aborted: true,
      sessionKey: sessionKey || raw.sessionKey || selectedSessionKey || null,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(LAST_ASSISTANT_REPLY_KEY, JSON.stringify(next));
    const bySession = JSON.parse(localStorage.getItem(LAST_ASSISTANT_REPLY_BY_SESSION_KEY) || '{}') || {};
    if (next.sessionKey) {
      bySession[next.sessionKey] = next;
      localStorage.setItem(LAST_ASSISTANT_REPLY_BY_SESSION_KEY, JSON.stringify(bySession));
    }
  } catch {}
}

function getPersistedLatestAssistantReplyMeta(sessionKey = null) {
  try {
    const targetSessionKey = sessionKey || selectedSessionKey || null;
    const bySession = JSON.parse(localStorage.getItem(LAST_ASSISTANT_REPLY_BY_SESSION_KEY) || '{}') || {};
    const sessionScoped = targetSessionKey ? bySession[targetSessionKey] : null;
    const globalFallback = targetSessionKey ? null : JSON.parse(localStorage.getItem(LAST_ASSISTANT_REPLY_KEY) || 'null');
    const raw = sessionScoped || globalFallback || {};
    return {
      text: String(raw?.text || '').trim(),
      runId: raw?.runId || null,
      aborted: raw?.aborted === true,
      sessionKey: raw?.sessionKey || targetSessionKey || null,
    };
  } catch {
    return { text: '', runId: null, aborted: false, sessionKey: sessionKey || selectedSessionKey || null };
  }
}

function _getPersistedLatestAssistantReply(sessionKey = null) {
  return getPersistedLatestAssistantReplyMeta(sessionKey).text;
}

function tailSnippet(text = '', maxChars = 1200) {
  const normalized = String(text || '').replace(/\r/g, '').trim();
  if (!normalized) {return '';}
  if (normalized.length <= maxChars) {return normalized;}
  return `…\n${normalized.slice(-maxChars).trim()}`;
}

function isContinueAnchorWrappedText(text = '') {
  const source = String(text || '');
  return (
    /继续上一条 assistant 回复里最后明确提出的事情。/u.test(source) ||
    /上一条 assistant 回复（尾段，作为继续锚点）：/u.test(source) ||
    /要求：默认延续上一条回复最后明确提出的具体动作，不要重开话题。/u.test(source)
  );
}

function getLatestSessionAssistantFinalMeta(sessionKey = null) {
  const targetSessionKey = sessionKey || selectedSessionKey || null;
  const messages = Array.isArray(sessionMessages.get(targetSessionKey)) ? sessionMessages.get(targetSessionKey) : [];
  const latestAssistantFinal = [...messages].toReversed().find(item => item?.role === 'assistant' && item?.status === 'final') || null;
  if (!latestAssistantFinal) {
    return { text: '', runId: null, aborted: false, sessionKey: targetSessionKey };
  }
  const text = String(latestAssistantFinal?.text || '').trim();
  if (!text || isContinueAnchorWrappedText(text)) {
    return { text: '', runId: null, aborted: false, sessionKey: targetSessionKey };
  }
  return {
    text,
    runId: latestAssistantFinal?.runId || latestAssistantFinal?.id || null,
    aborted: false,
    sessionKey: targetSessionKey,
  };
}

function buildContinuePayload() {
  const latest = getLatestSessionAssistantFinalMeta(selectedSessionKey || null);
  const lastAssistantReply = latest.text;
  const selectedRun = getSelectedSessionRunState();
  warnRoadmapLeak('buildContinuePayload(source)', lastAssistantReply);
  if (!lastAssistantReply || latest.aborted || selectedRun.state === 'streaming' || selectedRun.state === 'aborting') {return '继续';}
  const replyTail = tailSnippet(stripRoadmapBlockForDisplay(lastAssistantReply), 1200);
  return [
    '继续上一条 assistant 回复里最后明确提出的事情。',
    '',
    '上一条 assistant 回复（尾段，作为继续锚点）：',
    replyTail,
    '',
    '要求：默认延续上一条回复最后提出的具体动作，不要重开话题。',
  ].join('\n');
}

function generateAttachmentId() {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isSupportedChatAttachmentMimeType(mimeType = '') {
  return typeof mimeType === 'string' && mimeType.length > 0;
}

function isImageAttachmentMimeType(mimeType = '') {
  return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

function dataUrlToBase64(dataUrl = '') {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {return null;}
  return { mimeType: match[1], content: match[2] };
}

function formatAttachmentSize(size = 0) {
  const bytes = Number(size || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) {return '';}
  if (bytes < 1024) {return `${bytes} B`;}
  if (bytes < 1024 * 1024) {return `${(bytes / 1024).toFixed(1)} KB`;}
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;}

function syncChatAttachmentsPreview() {
  if (!chatAttachmentsPreviewEl) {return;}
  if (!Array.isArray(chatAttachments) || chatAttachments.length === 0) {
    chatAttachmentsPreviewEl.innerHTML = '';
    chatAttachmentsPreviewEl.hidden = true;
    return;
  }
  chatAttachmentsPreviewEl.hidden = false;
  chatAttachmentsPreviewEl.innerHTML = '';
  for (const att of chatAttachments) {
    const thumb = document.createElement('div');
    thumb.className = `chat-attachment-thumb ${isImageAttachmentMimeType(att.mimeType) ? 'is-image' : 'is-file'}`;

    if (isImageAttachmentMimeType(att.mimeType) && att.dataUrl) {
      const img = document.createElement('img');
      img.src = att.dataUrl;
      img.alt = att.name || 'Attachment preview';
      thumb.appendChild(img);
    } else {
      const fileCard = document.createElement('div');
      fileCard.className = 'chat-attachment-file';
      const ext = document.createElement('div');
      ext.className = 'chat-attachment-ext';
      ext.textContent = String((att.name || att.mimeType || 'file').split('.').pop() || 'file').slice(0, 6).toUpperCase();
      const meta = document.createElement('div');
      meta.className = 'chat-attachment-meta';
      const nameEl = document.createElement('div');
      nameEl.className = 'chat-attachment-name';
      nameEl.textContent = att.name || 'attachment';
      const subEl = document.createElement('div');
      subEl.className = 'chat-attachment-sub';
      subEl.textContent = [att.mimeType || 'file', formatAttachmentSize(att.size)].filter(Boolean).join(' · ');
      meta.append(nameEl, subEl);
      fileCard.append(ext, meta);
      thumb.appendChild(fileCard);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chat-attachment-remove';
    removeBtn.setAttribute('aria-label', 'Remove attachment');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      chatAttachments = chatAttachments.filter(item => item.id !== att.id);
      syncChatAttachmentsPreview();
    });
    thumb.appendChild(removeBtn);
    chatAttachmentsPreviewEl.appendChild(thumb);
  }
}

function clearChatAttachments() {
  chatAttachments = [];
  if (chatAttachmentInputEl) {chatAttachmentInputEl.value = '';}
  syncChatAttachmentsPreview();
}

function buildApiAttachments() {
  return chatAttachments
    .map(att => {
      const parsed = dataUrlToBase64(att.dataUrl);
      if (!parsed) {return null;}
      return {
        type: isImageAttachmentMimeType(att.mimeType) ? 'image' : 'file',
        mimeType: att.mimeType || parsed.mimeType,
        fileName: att.name || null,
        content: parsed.content,
      };
    })
    .filter(Boolean);
}

function handleChatAttachmentFiles(fileList) {
  const files = Array.from(fileList || []).filter(file => isSupportedChatAttachmentMimeType(file?.type || '') || file?.name);
  if (!files.length) {return;}
  const additions = [];
  let pending = files.length;
  for (const file of files) {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      additions.push({
        id: generateAttachmentId(),
        dataUrl: typeof reader.result === 'string' ? reader.result : '',
        mimeType: file.type || 'application/octet-stream',
        name: file.name || 'attachment',
        size: file.size || 0,
      });
      pending -= 1;
      if (pending === 0) {
        chatAttachments = [...chatAttachments, ...additions];
        syncChatAttachmentsPreview();
      }
    });
    reader.readAsDataURL(file);
  }
}

async function submitChatText(text = '', options = {}) {
  const value = String(text || '').trim();
  const outboundText = String(options?.outboundText ?? value).trim();
  const attachments = Array.isArray(options?.attachments) ? options.attachments : buildApiAttachments();
  const wsState = !ws ? 'no-ws' : ws.readyState;
  addDebugLine(`submitChatText: len=${outboundText.length} attachments=${attachments.length} ws=${wsState} session=${selectedSessionKey || 'none'}`, ws && ws.readyState === WebSocket.OPEN ? 'cyan' : 'pink');
  if ((!value && attachments.length === 0) || (!outboundText && attachments.length === 0) || !selectedSessionKey) {return;}

  const sendResult = await sendToSelectedSession(outboundText, {
    userText: value,
    attachments,
  });
  if (!sendResult?.ok) {
    throw new Error(sendResult?.error || 'session send failed');
  }
}

function getActiveViewedSessionKey() {
  return selectedSessionKey || gatewayMainSessionKey || null;
}

function clearChat() {
  if (chatEl) {chatEl.innerHTML = '';}
  streamingEl = null;
  streamingRunId = null;
}

async function sendToSelectedSession(outboundText, { userText = '', attachments = [] } = {}) {
  const targetSessionKey = selectedSessionKey;
  if (!targetSessionKey) {
    return { ok: false, error: 'sessionKey is required' };
  }

  addDebugLine(`sendToSelectedSession: unified send queued for ${targetSessionKey}; attachments=${attachments.length}; event-driven update armed`, 'cyan');
  const res = await fetch(`/api/sessions/${encodeURIComponent(targetSessionKey)}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: outboundText, attachments }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { ok: false, error: data?.error || 'session send failed', sessionKey: targetSessionKey };
  }
  applyPostSendUiState(targetSessionKey, {
    userText,
    runId: data?.runId || null,
    optimistic: true,
    debugLabel: 'Unified session send accepted',
    moodDetail: 'Session message sent; waiting for live session events.',
    routingSummary: 'session live',
    routingDetail: targetSessionKey,
    refreshDelay: 0,
  });
  if (data?.view) {
    try {
      applyProjectionViewToSession(targetSessionKey, data.view);
    } catch (error) {
      addDebugLine(`sendToSelectedSession: immediate projection apply failed: ${error?.message || error}`, 'pink');
    }
  }
  return { ok: true, mode: 'http', sessionKey: targetSessionKey, runId: data?.runId || null };
}

function applyPostSendUiState(sessionKey, {
  userText: _userText = '',
  runId = null,
  optimistic: _optimistic = false,
  debugLabel = 'send accepted',
  refreshDelay = 2000,
} = {}) {
  if (!sessionKey) {return;}
  try {
    inputEl.value = '';
    clearChatAttachments();
    resizeComposer();
  } catch (error) {
    addDebugLine(`applyPostSendUiState: composer reset threw ${error?.message || error}`, 'pink');
  }
  streamingEl = null;
  streamingRunId = null;
  const meta = getSessionMeta(sessionKey);
  meta.pending = true;
  meta.dirty = true;
  meta.lastUpdatedAt = Date.now();
  meta.lastReason = 'send-accepted';
  const runState = getSessionRunState(sessionKey);
  runState.runId = runId || runState.runId || null;
  runState.streamText = '';
  runState.state = 'streaming';
  addDebugLine(`${debugLabel}: ${sessionKey} run=${String(runState.runId || '').slice(0, 8) || '-'} `, 'cyan');
  setMood('thinking', moodDetail);
  setRouting(routingSummary, routingDetail || sessionKey);
  scheduleSessionRefresh(sessionKey, 'send-history-reconcile', refreshDelay);
  syncStopButton();
  syncContinueButton();
}

function getSessionRunState(sessionKey) {
  if (!sessionKey) {return { runId: null, streamText: '', state: 'idle' };}
  if (!sessionRunState.has(sessionKey)) {
    sessionRunState.set(sessionKey, {
      runId: null,
      streamText: '',
      state: 'idle',
    });
  }
  return sessionRunState.get(sessionKey);
}

function normalizeDashboardMessageRole(message = {}) {
  const role = typeof message?.role === 'string' ? message.role : '';
  const lowered = role.toLowerCase();
  if (lowered === 'user') {return 'user';}
  if (lowered === 'assistant') {return 'assistant';}
  if (lowered === 'system') {return 'system';}
  if (lowered === 'toolresult' || lowered === 'tool_result' || lowered === 'tool' || lowered === 'function') {return 'tool';}
  if (message?.toolCallId || message?.tool_call_id || message?.toolName || message?.tool_name) {return 'tool';}
  return role || 'unknown';
}

function roleForChatBubble(message = {}) {
  const normalized = normalizeDashboardMessageRole(message);
  if (normalized === 'user') {return 'user';}
  if (normalized === 'assistant') {return 'assistant';}
  if (normalized === 'system') {return 'system';}
  if (normalized === 'tool') {return 'tool';}
  return 'system';
}

function shouldDisplayChatMessage(message = {}) {
  return normalizeDashboardMessageRole(message) !== 'tool';
}

function appendSessionMessage(sessionKey, message) {
  if (!sessionKey || !message || typeof message !== 'object') {return;}
  if (!shouldDisplayChatMessage(message)) {return;}
  const cached = sessionMessages.get(sessionKey) || [];
  const nextId = message.id || null;
  const runId = message.runId || nextId || null;
  let deduped = nextId ? cached.filter(item => item?.id !== nextId) : [...cached];
  if (runId && message.role === 'assistant') {
    deduped = deduped.filter(item => !(item?.role === 'assistant' && (item?.runId === runId || item?.id === runId)));
  }
  deduped.push(message);
  sessionMessages.set(sessionKey, deduped);
  reconcileRunStateFromMessages(sessionKey, deduped, 'append-session-message');
  if (selectedSessionKey === sessionKey) {
    renderSessionMessages(sessionKey, deduped);
  }
}

function reconcileRunStateFromMessages(sessionKey, messages = [], source = 'messages') {
  if (!sessionKey) {return;}
  const runState = getSessionRunState(sessionKey);
  if (!runState) {return;}
  const list = Array.isArray(messages) ? messages : [];
  if (!list.length) {
    if (!runState.runId && runState.state !== 'aborted' && runState.state !== 'error') {
      runState.state = 'idle';
    }
    return;
  }

  const currentRunId = runState.runId || null;
  const assistantForCurrentRun = currentRunId
    ? list.find(item => item?.role === 'assistant' && (item?.runId === currentRunId || item?.id === currentRunId || item?.id === `assistant:${currentRunId}`))
    : null;

  if (assistantForCurrentRun?.status === 'final') {
    addDebugLine(`Finalized from ${source} · run ${String(currentRunId || '').slice(0, 8) || '-'} `, 'cyan');
    clearStreamingMessageEl(currentRunId || null);
    runState.runId = null;
    runState.streamText = '';
    runState.state = 'final';
    lastStreamEventAt = 0;
    syncStopButton();
    syncContinueButton();
    return;
  }

  if (assistantForCurrentRun?.status === 'streaming') {
    runState.state = 'streaming';
    return;
  }

  const latestAssistant = [...list].toReversed().find(item => item?.role === 'assistant');
  if (!currentRunId && latestAssistant?.status === 'final' && runState.state !== 'aborted' && runState.state !== 'error') {
    runState.state = 'final';
    syncStopButton();
    syncContinueButton();
  }
}

function pruneSupersededStreamingMessages(messages = []) {
  const list = Array.isArray(messages) ? messages : [];
  return list.filter((message, index) => {
    if (message?.role !== 'assistant' || message?.status !== 'streaming') {return true;}
    const messageText = String(message?.text || '').trim();
    const messageRunId = message?.runId || (String(message?.id || '').startsWith('assistant:') ? String(message.id).slice('assistant:'.length) : null);
    return !list.some((other, otherIndex) => {
      if (otherIndex === index) {return false;}
      if (other?.role !== 'assistant' || other?.status !== 'final') {return false;}
      const otherText = String(other?.text || '').trim();
      const otherRunId = other?.runId || (String(other?.id || '').startsWith('assistant:') ? String(other.id).slice('assistant:'.length) : null);
      if (messageRunId && otherRunId && messageRunId === otherRunId) {return true;}
      if (!messageText || !otherText) {return false;}
      return otherText.length >= messageText.length && otherText.startsWith(messageText);
    });
  });
}

function applyProjectionViewToSession(sessionKey, view = null, options = {}) {
  if (!sessionKey || !view || !Array.isArray(view.messages)) {return;}
  const normalized = pruneSupersededStreamingMessages(view.messages
    .map(message => ({
      id: message.id || null,
      runId: message.id && String(message.id).startsWith('assistant:') ? String(message.id).slice('assistant:'.length) : null,
      role: message.role || 'assistant',
      text: typeof message.text === 'string' ? message.text : '',
      status: message.status || 'final',
    }))
    .filter(message => shouldDisplayChatMessage(message)));

  const runState = getSessionRunState(sessionKey);
  const hasStreamingAssistantForActiveRun =
    !!runState?.runId &&
    normalized.some(message =>
      message?.role === 'assistant' &&
      message?.status === 'streaming' &&
      (message?.runId === runState.runId || message?.id === runState.runId || message?.id === `assistant:${runState.runId}`),
    );
  if (runState?.runId && runState?.streamText && !hasStreamingAssistantForActiveRun) {
    normalized.push({
      id: `assistant:${runState.runId}`,
      runId: runState.runId,
      role: 'assistant',
      text: runState.streamText,
      status: 'streaming',
    });
  }

  sessionMessages.set(sessionKey, normalized);
  reconcileRunStateFromMessages(sessionKey, normalized, view?.runs ? 'projection-view' : 'transcript-view');
  if (selectedSessionKey === sessionKey && options.render !== false) {
    renderSessionMessages(sessionKey, normalized);
  }
}

function applyKernelRunViewPacket(msg = {}) {
  const event = msg?.event || {};
  const sessionKey = event?.sessionKey || null;
  if (!sessionKey) {return;}

  const runState = getSessionRunState(sessionKey);
  const runId = event?.runId || runState.runId || null;
  if (runId) {
    runState.runId = runId;
  }

  const isSelectedSession = selectedSessionKey === sessionKey;
  const isDelta = event?.type === 'run.delta';

  if (isDelta) {
    runState.state = 'streaming';
    runState.streamText = sanitizeDisplayedChatText(String(event?.accumulatedText || event?.textDelta || ''));
  } else if (event?.type === 'run.final') {
    runState.streamText = '';
    runState.state = 'final';
  } else if (event?.type === 'run.aborted') {
    runState.streamText = '';
    runState.state = 'aborted';
  } else if (event?.type === 'run.error') {
    runState.streamText = '';
    runState.state = 'error';
  }

  if (msg?.view) {
    applyProjectionViewToSession(sessionKey, msg.view, { render: !(isSelectedSession && isDelta) });
    if (isSelectedSession && isDelta) {
      const patched = patchStreamingMessageInPlace(sessionKey, runId, runState.streamText);
      if (!patched) {
        renderSessionMessages(sessionKey, sessionMessages.get(sessionKey) || []);
      }
    }
    return;
  }

  if (isSelectedSession) {
    if (isDelta) {
      const patched = patchStreamingMessageInPlace(sessionKey, runId, runState.streamText);
      if (!patched) {
        renderSessionMessages(sessionKey, sessionMessages.get(sessionKey) || []);
      }
      return;
    }
    renderSessionMessages(sessionKey, sessionMessages.get(sessionKey) || []);
  }
}

function hasStreamingRowMounted(sessionKey, runId = null) {
  if (!chatEl || selectedSessionKey !== sessionKey) {return false;}
  if (runId) {
    return !!chatEl.querySelector(`.msg-row.assistant[data-run-id="${CSS.escape(String(runId))}"][data-status="streaming"]`);
  }
  return !!chatEl.querySelector('.msg-row.assistant[data-status="streaming"]');
}

function applyProjectionTranscriptPacket(msg = {}) {
  const sessionKey = msg?.sessionKey || null;
  if (!sessionKey) {return;}
  const runState = getSessionRunState(sessionKey);
  const suppressRender =
    selectedSessionKey === sessionKey &&
    runState?.state === 'streaming' &&
    hasStreamingRowMounted(sessionKey, runState?.runId || null);
  if (msg?.view) {
    applyProjectionViewToSession(sessionKey, msg.view, { render: !suppressRender });
  }
}

function patchStreamingMessageInPlace(sessionKey, runId, text = '') {
  if (!chatEl || selectedSessionKey !== sessionKey || !runId) {return false;}
  const row = chatEl.querySelector(`.msg-row.assistant[data-run-id="${CSS.escape(String(runId))}"][data-status="streaming"]`);
  const msgEl = row?.querySelector('.msg.assistant');
  if (!msgEl) {return false;}
  msgEl.innerHTML = renderChatMarkdown(text || '');
  return true;
}

function renderSessionMessages(sessionKey, messages = []) {
  if (!chatEl) {return;}
  const sourceMessages = Array.isArray(messages) ? messages : [];
  const visibleMessages = sourceMessages;
  const uiState = deriveSessionUiState(sessionKey);
  const lastMessage = sourceMessages.length ? sourceMessages[sourceMessages.length - 1] : null;
  const lastPreview = String(lastMessage?.text || '').replace(/\s+/g, ' ').slice(0, 120);
  addDebugLine(`renderSessionMessages active=${selectedSessionKey || 'none'} target=${sessionKey || 'none'} len=${sourceMessages.length} visible=${visibleMessages.length} state=${uiState.state} last=${lastPreview || '<empty>'}`, 'cyan');
  clearChat();
  for (const message of visibleMessages) {
    if (!shouldDisplayChatMessage(message)) {continue;}
    const bubbleRole = roleForChatBubble(message);
    const extraClass = message?.role === 'assistant' && message?.status === 'streaming' ? 'stream' : '';
    addMessage(bubbleRole, message.text || '', extraClass, {
      messageRole: normalizeDashboardMessageRole(message),
      runId: message.runId || message.id || null,
      status: message?.status || null,
    });
  }
  clearStreamingMessageEl();
  if (activeFilePathEl) {
    activeFilePathEl.innerHTML = `<span class="semantic-label">session</span> <span class="semantic-value">${sessionKey || 'unknown'}</span>`;
  }
  if (sessionKey === getActiveViewedSessionKey()) {
    syncTopbarForSession(sessionKey);
  }
  syncStopButton();
  syncContinueButton();
}

function addMessage(role, text, extraClass = '', options = {}) {
  const row = document.createElement('div');
  row.className = `msg-row ${role}`.trim();
  if (options.runId) {row.dataset.runId = String(options.runId);}
  if (options.messageRole) {row.dataset.messageRole = String(options.messageRole);}
  if (options.status) {row.dataset.status = String(options.status);}
  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`.trim();
  const avatarSrc = (role === 'user' || role === 'assistant') ? avatarImageSrc(role) : null;
  if (avatarSrc) {
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.alt = role === 'user' ? 'Xin avatar' : 'avatar';
    img.addEventListener('error', () => {
      img.remove();
      avatar.textContent = avatarLabel(role);
    });
    img.src = `${avatarSrc}?v=1`;
    avatar.appendChild(img);
  } else {avatar.textContent = avatarLabel(role);}
  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-wrap';
  const meta = document.createElement('div');
  meta.className = `msg-meta ${role}`.trim();
  const speaker = role === 'user' ? 'Xin' : role === 'assistant' ? 'Vio' : role === 'tool' ? 'Tool' : 'System';
  meta.textContent = `${speaker} · ${formatStamp()}`;
  const el = document.createElement('div');
  el.className = `msg ${role} ${extraClass}`.trim();
  el.innerHTML = renderChatMarkdown(text);
  bubbleWrap.appendChild(meta);
  bubbleWrap.appendChild(el);
  row.appendChild(avatar);
  row.appendChild(bubbleWrap);
  chatEl.appendChild(row);
  requestAnimationFrame(() => { chatEl.scrollTop = chatEl.scrollHeight; });
  return el;
}

function clearStreamingMessageEl(runId = null) {
  const selector = runId
    ? `.msg-row.assistant[data-message-role="stream"][data-run-id="${CSS.escape(String(runId))}"]`
    : '.msg-row.assistant[data-message-role="stream"]';
  const rows = chatEl ? [...chatEl.querySelectorAll(selector)] : [];
  for (const row of rows) {
    row.remove();
  }
  if (!runId || streamingRunId === runId) {
    streamingEl = null;
    streamingRunId = null;
  }
}

function getStreamingMessageEl(runId = null) {
  if (streamingEl && streamingEl.isConnected && (!runId || streamingRunId === runId)) {return streamingEl;}
  if (!runId) {return null;}
  const row = chatEl?.querySelector(`.msg-row.assistant[data-message-role="stream"][data-run-id="${CSS.escape(String(runId))}"]`);
  const msgEl = row?.querySelector('.msg.assistant.stream') || row?.querySelector('.msg.assistant');
  if (msgEl) {
    streamingEl = msgEl;
    streamingRunId = runId;
    return msgEl;
  }
  return null;
}

function ensureStreamingMessageEl(runId = null, text = '') {
  const existing = getStreamingMessageEl(runId);
  if (existing) {return existing;}
  clearStreamingMessageEl(runId || null);
  const el = addMessage('assistant', text, 'stream', { runId, messageRole: 'stream' });
  streamingEl = el;
  streamingRunId = runId || null;
  return el;
}

function sessionDisplayTitle(session = {}) {
  const raw = String(session?.label || session?.key || 'session').trim();
  if (raw === gatewayMainSessionKey) {return 'main';}
  if (raw.startsWith('agent:claude:acp:')) {return `acp · ${raw.slice(-6)}`;}
  if (raw.startsWith('agent:')) {
    const parts = raw.split(':').filter(Boolean);
    return parts.slice(-2).join(' · ') || raw;
  }
  return raw;
}

function renderSessionsList() {
  if (!sessionsListEl) {return;}
  sessionsListEl.innerHTML = '';
  for (const session of dashboardSessions) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `session-item ${session.key === selectedSessionKey ? 'is-selected' : ''}`.trim();
    const title = sessionDisplayTitle(session);
    const tags = [];
    if (session.key === gatewayMainSessionKey) {tags.push('main');}
    else if (String(session.key || '').includes(':acp:')) {tags.push('acp');}
    if (session.model) {tags.push(session.model);}
    item.innerHTML = `
      <span class="session-item-title">${escapeHtml(title)}</span>
      <span class="session-item-meta">${escapeHtml(tags.join(' · ') || (session.kind || 'session'))}</span>
    `;
    item.title = session.key || title;
    item.addEventListener('click', () => {
      selectDashboardSession(session.key).catch(error => {
        addDebugLine(`Session switch failed: ${error?.message || error}`, 'pink');
      });
    });
    sessionsListEl.appendChild(item);
  }
}

async function fetchDashboardSessions() {
  const res = await fetch('/api/sessions', { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) {throw new Error(data?.error || 'sessions fetch failed');}
  dashboardSessions = Array.isArray(data?.items) ? data.items : [];
  if (!selectedSessionKey) {selectedSessionKey = data?.currentSessionKey || dashboardSessions[0]?.key || null;}
  if (selectedSessionKey && !dashboardSessions.some(item => item.key === selectedSessionKey)) {
    selectedSessionKey = data?.currentSessionKey || dashboardSessions[0]?.key || null;
  }
  renderSessionsList();
  return data;
}

function getSessionMeta(sessionKey) {
  if (!sessionKey) {return { dirty: false, pending: false, lastUpdatedAt: 0, lastReason: null };}
  if (!sessionMeta.has(sessionKey)) {
    sessionMeta.set(sessionKey, {
      dirty: false,
      pending: false,
      lastUpdatedAt: 0,
      lastReason: null,
    });
  }
  return sessionMeta.get(sessionKey);
}

function setSessionLoading(sessionKey, loading) {
  if (!sessionKey) {return;}
  if (loading) {sessionLoadingState.set(sessionKey, true);}
  else {sessionLoadingState.delete(sessionKey);}
}

function renderSessionLoadingPlaceholder(sessionKey) {
  if (!chatEl) {return;}
  chatEl.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'msg-row system';
  row.dataset.messageRole = 'loading';
  const avatar = document.createElement('div');
  avatar.className = 'avatar system';
  avatar.textContent = '…';
  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-wrap';
  const meta = document.createElement('div');
  meta.className = 'msg-meta system';
  meta.textContent = `Loading · ${formatStamp()}`;
  const el = document.createElement('div');
  el.className = 'msg system session-loading';
  el.textContent = `Loading session ${sessionKey || 'unknown'}…`;
  bubbleWrap.appendChild(meta);
  bubbleWrap.appendChild(el);
  row.appendChild(avatar);
  row.appendChild(bubbleWrap);
  chatEl.appendChild(row);
}

function renderSessionIdlePlaceholder(sessionKey) {
  if (!chatEl) {return;}
  chatEl.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'msg-row system';
  row.dataset.messageRole = 'idle';
  const avatar = document.createElement('div');
  avatar.className = 'avatar system';
  avatar.textContent = '○';
  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-wrap';
  const meta = document.createElement('div');
  meta.className = 'msg-meta system';
  meta.textContent = `Ready · ${formatStamp()}`;
  const el = document.createElement('div');
  el.className = 'msg system session-loading';
  el.textContent = sessionKey ? `Session ${sessionKey} ready. Click it to load history.` : 'Sessions ready. Select a session to load history.';
  bubbleWrap.appendChild(meta);
  bubbleWrap.appendChild(el);
  row.appendChild(avatar);
  row.appendChild(bubbleWrap);
  chatEl.appendChild(row);
}

async function loadSessionHistory(sessionKey, { force = false, selectionSeq = null } = {}) {
  if (!sessionKey) {return [];}
  if (!force && sessionMessages.has(sessionKey)) {
    const cached = sessionMessages.get(sessionKey) || [];
    const cachedLast = cached.length ? String(cached[cached.length - 1]?.text || '').replace(/\s+/g, ' ').slice(0, 120) : '';
    addDebugLine(`loadSessionHistory cache seq=${selectionSeq ?? '-'} active=${selectedSessionKey || 'none'} target=${sessionKey} len=${cached.length} last=${cachedLast || '<empty>'}`, 'cyan');
    return cached;
  }
  const requestSeq = ++sessionHistoryRequestSeq;
  sessionHistoryInflight.set(sessionKey, requestSeq);
  setSessionLoading(sessionKey, true);
  addDebugLine(`loadSessionHistory start seq=${selectionSeq ?? '-'} req=${requestSeq} active=${selectedSessionKey || 'none'} target=${sessionKey} force=${force ? 'yes' : 'no'}`, 'cyan');
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionKey)}/history?limit=40`, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) {
    if (sessionHistoryInflight.get(sessionKey) === requestSeq) {sessionHistoryInflight.delete(sessionKey);}
    setSessionLoading(sessionKey, false);
    throw new Error(data?.error || 'session history fetch failed');
  }
  let messages = Array.isArray(data?.messages)
    ? data.messages
        .map(message => ({
          ...message,
          role: normalizeDashboardMessageRole(message),
          runId: message?.runId || message?.id || null,
          text: typeof message?.text === 'string' ? sanitizeDisplayedChatText(message.text) : '',
        }))
        .filter(shouldDisplayChatMessage)
    : [];
  const currentInflightSeq = sessionHistoryInflight.get(sessionKey);
  const lastPreview = messages.length ? String(messages[messages.length - 1]?.text || '').replace(/\s+/g, ' ').slice(0, 120) : '';
  if (currentInflightSeq !== requestSeq) {
    setSessionLoading(sessionKey, false);
    addDebugLine(`loadSessionHistory stale-response seq=${selectionSeq ?? '-'} req=${requestSeq} currentReq=${currentInflightSeq ?? '-'} active=${selectedSessionKey || 'none'} target=${sessionKey} len=${messages.length} last=${lastPreview || '<empty>'}`, 'pink');
    return sessionMessages.get(sessionKey) || messages;
  }
  sessionHistoryInflight.delete(sessionKey);
  setSessionLoading(sessionKey, false);
  const runState = getSessionRunState(sessionKey);
  if (runState?.runId) {
    const existing = sessionMessages.get(sessionKey) || [];
    const existingAssistantForRun = existing.find(item => item?.role === 'assistant' && (item?.runId === runState.runId || item?.id === runState.runId));
    const historyHasAssistantForRun = messages.some(item => item?.role === 'assistant' && (item?.runId === runState.runId || item?.id === runState.runId));
    const optimisticUsers = existing.filter(item => String(item?.id || '').startsWith('optimistic-'));
    if (optimisticUsers.length) {
      const seenOptimisticText = new Set(messages.filter(item => item?.role === 'user').map(item => String(item?.text || '')));
      for (const optimistic of optimisticUsers) {
        const optimisticText = String(optimistic?.text || '');
        if (optimisticText && !seenOptimisticText.has(optimisticText)) {
          messages.push(optimistic);
          seenOptimisticText.add(optimisticText);
        }
      }
    }
    const shouldCarryForwardAssistant =
      existingAssistantForRun &&
      !historyHasAssistantForRun &&
      (runState.state === 'streaming' || existingAssistantForRun?.status === 'streaming');
    if (shouldCarryForwardAssistant) {
      messages.push(existingAssistantForRun);
    }
  }
  messages = pruneSupersededStreamingMessages(messages);
  sessionMessages.set(sessionKey, messages);
  reconcileRunStateFromMessages(sessionKey, messages, 'session-history');
  const uiState = deriveSessionUiState(sessionKey);
  if (!runState?.runId && uiState.state !== 'final' && uiState.state !== 'aborted' && uiState.state !== 'error' && uiState.state !== 'streaming') {
    runState.runId = null;
    runState.streamText = '';
    runState.state = 'idle';
  }
  const meta = getSessionMeta(sessionKey);
  meta.dirty = false;
  meta.pending = false;
  meta.lastUpdatedAt = Date.now();
  addDebugLine(`loadSessionHistory resolved seq=${selectionSeq ?? '-'} req=${requestSeq} active=${selectedSessionKey || 'none'} target=${sessionKey} len=${messages.length} last=${lastPreview || '<empty>'}`, 'cyan');
  return messages;
}

async function refreshSelectedSessionContext(sessionKey) {
  if (!sessionKey) {return;}
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionKey)}/context`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) {throw new Error(data?.error || 'session context fetch failed');}
    renderContextTelemetry({
      contextSnapshot: data?.contextSnapshot || null,
      diagnosticContext: data?.diagnosticContext || null,
    });
  } catch (error) {
    if (contextDetailEl) {contextDetailEl.textContent = `ctx: ${error?.message || error}`;}
    applyDotState(contextDotEl, 'window', 'danger');
  }
}

async function selectDashboardSession(sessionKey, { force = false } = {}) {
  if (!sessionKey) {return;}
  const previousSessionKey = selectedSessionKey;
  const selectionSeq = ++sessionSelectionSeq;
  const meta = getSessionMeta(sessionKey);
  const switchedSession = !!previousSessionKey && previousSessionKey !== sessionKey;
  const hasCachedMessages = sessionMessages.has(sessionKey);
  const selectedRun = getSessionRunState(sessionKey);
  const shouldForce = !!force || switchedSession || !!meta.dirty || !!meta.pending || selectedRun.state === 'streaming';
  addDebugLine(`selectDashboardSession enter seq=${selectionSeq} from=${previousSessionKey || 'none'} to=${sessionKey} force=${shouldForce ? 'yes' : 'no'} switched=${switchedSession ? 'yes' : 'no'} cached=${hasCachedMessages ? 'yes' : 'no'}`, 'cyan');
  selectedSessionKey = sessionKey;
  clearChat();
  if (activeFilePathEl) {
    activeFilePathEl.innerHTML = `<span class="semantic-label">session</span> <span class="semantic-value">${sessionKey || 'unknown'}</span>`;
  }
  renderSessionsList();
  syncTopbarForSession(sessionKey);
  syncStopButton();
  syncContinueButton();

  const cachedMessages = hasCachedMessages ? (sessionMessages.get(sessionKey) || []) : null;
  if (cachedMessages) {
    setSessionLoading(sessionKey, false);
    renderSessionMessages(sessionKey, cachedMessages);
  } else if (shouldForce) {
    setSessionLoading(sessionKey, true);
    renderSessionLoadingPlaceholder(sessionKey);
  } else {
    setSessionLoading(sessionKey, false);
    renderSessionIdlePlaceholder(sessionKey);
  }

  refreshSelectedSessionContext(sessionKey).catch(error => {
    addDebugLine(`Session context refresh failed (${sessionKey}): ${error?.message || error}`, 'pink');
  });

  if (!hasCachedMessages || shouldForce) {
    loadSessionHistory(sessionKey, { force: shouldForce, selectionSeq })
      .then(messages => {
        if (selectedSessionKey !== sessionKey || selectionSeq !== sessionSelectionSeq) {
          addDebugLine(`selectDashboardSession stale seq=${selectionSeq} current=${sessionSelectionSeq} active=${selectedSessionKey || 'none'} target=${sessionKey}; render skipped`, 'pink');
          return;
        }
        renderSessionMessages(sessionKey, messages);
        syncStopButton();
        syncContinueButton();
        if (sessionKey === (dashboardSessions.find(item => item.key === sessionKey)?.key || sessionKey)) {
          addDebugLine(`Session selected: ${sessionKey} seq=${selectionSeq}`, 'cyan');
        }
      })
      .catch(error => {
        if (selectedSessionKey === sessionKey && selectionSeq === sessionSelectionSeq) {
          renderSessionIdlePlaceholder(sessionKey);
        }
        addDebugLine(`Session history load failed (${sessionKey}): ${error?.message || error}`, 'pink');
      });
  } else if (sessionKey === (dashboardSessions.find(item => item.key === sessionKey)?.key || sessionKey)) {
    addDebugLine(`Session selected from cache: ${sessionKey} seq=${selectionSeq}`, 'cyan');
  }
}

async function refreshSessionHistory(sessionKey, reason = 'manual') {
  if (!sessionKey) {return [];}
  const refreshSeq = sessionSelectionSeq;
  const messages = await loadSessionHistory(sessionKey, { force: true, selectionSeq: refreshSeq });
  const meta = getSessionMeta(sessionKey);
  meta.dirty = false;
  meta.pending = false;
  meta.lastUpdatedAt = Date.now();
  meta.lastReason = reason;
  const lastPreview = messages.length ? String(messages[messages.length - 1]?.text || '').replace(/\s+/g, ' ').slice(0, 120) : '';
  addDebugLine(`refreshSessionHistory seq=${refreshSeq} active=${selectedSessionKey || 'none'} target=${sessionKey} reason=${reason} len=${messages.length} last=${lastPreview || '<empty>'}`, 'cyan');
  const runState = getSessionRunState(sessionKey);
  const shouldSuppressStreamingRerender =
    sessionKey === selectedSessionKey &&
    refreshSeq === sessionSelectionSeq &&
    runState?.state === 'streaming' &&
    hasStreamingRowMounted(sessionKey, runState?.runId || null);
  if (sessionKey === selectedSessionKey && refreshSeq === sessionSelectionSeq && !shouldSuppressStreamingRerender) {
    renderSessionMessages(sessionKey, messages);
  } else {
    addDebugLine(`refreshSessionHistory render skipped seq=${refreshSeq} current=${sessionSelectionSeq} active=${selectedSessionKey || 'none'} target=${sessionKey} streamingSuppress=${shouldSuppressStreamingRerender ? 'yes' : 'no'}`, 'cyan');
  }
  return messages;
}

function scheduleSessionRefresh(sessionKey, reason = 'session-update', delay = 120) {
  if (!sessionKey) {return;}
  const meta = getSessionMeta(sessionKey);
  meta.dirty = true;
  meta.lastReason = reason;
  meta.lastUpdatedAt = Date.now();
  if (sessionKey === selectedSessionKey) {
    meta.pending = true;
  }
  const existing = sessionRefreshTimers.get(sessionKey);
  addDebugLine(`scheduleSessionRefresh active=${selectedSessionKey || 'none'} target=${sessionKey} reason=${reason} delay=${delay} existing=${existing ? 'yes' : 'no'} selectedMatch=${sessionKey === selectedSessionKey ? 'yes' : 'no'}`, 'cyan');
  if (existing) {clearTimeout(existing);}
  const timer = setTimeout(() => {
    sessionRefreshTimers.delete(sessionKey);
    addDebugLine(`sessionRefreshTimerFired active=${selectedSessionKey || 'none'} target=${sessionKey} reason=${reason}`, 'cyan');
    refreshSessionHistory(sessionKey, reason).catch(error => {
      addDebugLine(`Session refresh failed (${sessionKey}, ${reason}): ${error?.message || error}`, 'pink');
    });
  }, delay);
  sessionRefreshTimers.set(sessionKey, timer);
}

function connect() {
  ws = new WebSocket(`ws://${location.host}/ws`);
  ws.addEventListener('open', () => {
    statusEl.textContent = 'wrapper connected';
    applyDotState(wrapperDotEl, 'link', 'online');
    addDebugLine('Wrapper websocket connected.', 'cyan');
  });
  ws.addEventListener('message', ev => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'status') {
      statusEl.textContent = msg.connected ? `gateway connected · ${msg.sessionKey}` : 'gateway connecting…';
      applyDotState(wrapperDotEl, 'link', 'online');
      applyDotState(gatewayDotEl, 'link', msg.connected ? 'online' : 'offline');
      gatewayMainSessionKey = msg.sessionKey || gatewayMainSessionKey;
      sessionKeyEl.innerHTML = `<span class="semantic-label">session:</span> <span class="semantic-value">${msg.sessionKey || 'unknown'}</span>`;
      if (gatewayMainSessionKey && !sessionHistoryInflight.has(gatewayMainSessionKey)) {
        const shouldHydrateDefaultSession = !selectedSessionKey || selectedSessionKey === gatewayMainSessionKey;
        if (shouldHydrateDefaultSession && !sessionMessages.has(gatewayMainSessionKey)) {
          selectedSessionKey = gatewayMainSessionKey;
          selectDashboardSession(gatewayMainSessionKey, { force: true }).catch(error => {
            addDebugLine(`default session hydrate failed: ${error?.message || error}`, 'pink');
          });
        }
      }
      return;
    }
    if (msg.type === 'ack') {
      resetStoppedUiForNewRun();
      const sessionKey = getActiveViewedSessionKey();
      const runState = getSessionRunState(sessionKey);
      runState.runId = msg.runId || runState.runId || null;
      runState.state = 'streaming';
      stopRequestedAt = null;
      if (msg.runId) {registerChatRun(msg.runId);}
      syncStopButton();
      syncContinueButton();
      addDebugLine(`Session send acknowledged · session=${sessionKey || 'none'} run=${String(msg.runId || '').slice(0, 8)}`, 'cyan');
      fetch('/api/coms/token-saver')
        .then(res => res.json())
        .then(data => {
          const tokenSaver = data?.tokenSaver;
          if (tokenSaver?.enabled && tokenSaver?.stats?.last) {addDebugLine(`Token saver: saved ~${tokenSaver.stats.last.savedChars} chars this send`, 'cyan');}
        })
        .catch(() => {});
      return;
    }
    if (msg.type === 'error') {
      const errorText = msg.error || 'wrapper error';
      const sessionKey = getActiveViewedSessionKey();
      const runState = getSessionRunState(sessionKey);
      runState.state = 'error';
      runState.streamText = '';
      if (sessionKey) {
        try {
          appendSessionMessage(sessionKey, {
            id: `error:${Date.now()}`,
            role: 'assistant',
            text: `Error: ${errorText}`,
            status: 'error',
          });
        } catch (error) {
          addDebugLine(`ws error session append failed: ${error?.message || error}`, 'pink');
        }
      } else {
        addDebugLine(`Ignored wrapper error without session target: ${errorText}`, 'pink');
      }
      addDebugLine(`Wrapper error routed to session=${sessionKey || 'none'}: ${errorText}`, 'pink');
      const fallbackMode = latestWrapperRuntime?.mood || latestWrapperRuntime?.lightOutput || 'idle';
      try {
        setMood(fallbackMode, `send failed: ${errorText}`, latestWrapperRuntime || null);
      } catch (error) {
        addDebugLine(`ws error setMood failed: ${error?.message || error}`, 'pink');
      }
      try {
        setRouting('send failed', errorText);
      } catch (error) {
        addDebugLine(`ws error setRouting failed: ${error?.message || error}`, 'pink');
      }
      streamingEl = null;
      syncStopButton();
      syncContinueButton();
      return;
    }
    if (msg.type === 'tokens') {
      const last = msg.last;
      if (lastTokensDetailEl) {lastTokensDetailEl.innerHTML = last ? `<span class="semantic-label">in</span> <span class="semantic-value">${last.input}</span><br><span class="semantic-label">out</span> <span class="semantic-value">${last.output}</span><br><span class="semantic-label">total</span> <span class="semantic-value">${last.total}</span>` : '<span class="semantic-value">n/a</span>';}
      if (totalTokensDetailEl) {totalTokensDetailEl.innerHTML = `<span class="semantic-label">in</span> <span class="semantic-value">${msg.totalInput}</span><br><span class="semantic-label">out</span> <span class="semantic-value">${msg.totalOutput}</span><br><span class="semantic-label">total</span> <span class="semantic-value">${msg.total}</span>`;}
      if (modelWindowDetailEl) {modelWindowDetailEl.innerHTML = msg.modelLimit ? `<span class="semantic-value">${msg.modelName || 'model'}</span>` : `<span class="semantic-value">${msg.modelName || 'n/a'}</span>`;}
      const pct = Number(msg.modelUsagePercent ?? 0);
      const windowState = !msg.modelLimit ? 'safe' : pct >= 90 ? 'danger' : pct >= 75 ? 'high' : pct >= 50 ? 'mid' : 'safe';
      applyDotState(modelWindowDotEl, 'window', windowState);
      renderContextTelemetry(msg);
      return;
    }
    if (msg.type === 'mood') {
      const mode = msg.mode || 'unknown';
      const _state = msg.state || {};
      const runtime = msg.runtime || null;
      const phase = msg.detail?.phase || runtime?.phase || null;
      try {
        if (runtime && typeof runtime === 'object') {latestWrapperRuntime = runtime;}
      } catch (error) {
        addDebugLine(`ws mood runtime cache failed: ${error?.message || error}`, 'pink');
      }
      try {
        syncTopbarForSession(getActiveViewedSessionKey());
      } catch (error) {
        addDebugLine(`ws mood topbar sync failed: ${error?.message || error}`, 'pink');
      }
      try {
        if (bodyLinkValueEl) {bodyLinkValueEl.textContent = 'disabled';}
        if (bodyLinkDetailEl) {bodyLinkDetailEl.textContent = 'body/light telemetry disconnected';}
      } catch (error) {
        addDebugLine(`ws mood telemetry render failed: ${error?.message || error}`, 'pink');
      }
      addDebugLine(`ws mood observed mode=${mode} phase=${phase || 'n/a'} selected=${getActiveViewedSessionKey() || 'none'}`, 'cyan');
      return;
    }
    if (msg.type === 'token-saver') {
      renderTokenSaverState(msg.tokenSaver || {});
      addDebugLine(`Token saver ${msg.tokenSaver?.enabled ? 'enabled' : 'disabled'}.`, 'cyan');
      return;
    }
    if (msg.type === 'claude-state') {
      try {applyClaudeStateData(msg);} catch (error) {addDebugLine(`ws claude-state apply failed: ${error?.message || error}`, 'pink');}
      return;
    }
    if (msg.type === 'session.updated') {
      const sessionKey = typeof msg.sessionKey === 'string' ? msg.sessionKey : null;
      addDebugLine(`ws session.updated active=${selectedSessionKey || 'none'} target=${sessionKey || 'none'} reason=${msg.reason || 'session-updated'}`, 'cyan');
      if (!sessionKey) {return;}
      const delay = sessionKey === selectedSessionKey ? 0 : 1200;
      scheduleSessionRefresh(sessionKey, msg.reason || 'session-updated', delay);
      return;
    }
    if (msg.type === 'kernel.run') {
      try {applyKernelRunViewPacket(msg);} catch (error) {addDebugLine(`ws kernel.run apply failed: ${error?.message || error}`, 'pink');}
      return;
    }
    if (msg.type === 'projection.transcript') {
      try {applyProjectionTranscriptPacket(msg);} catch (error) {addDebugLine(`ws projection.transcript apply failed: ${error?.message || error}`, 'pink');}
      return;
    }
  } catch (error) {
      addDebugLine(`ws message handler failed: ${error?.message || error}`, 'pink');
    }
  });
  ws.addEventListener('close', () => {
    statusEl.textContent = 'wrapper disconnected; retrying…';
    applyDotState(wrapperDotEl, 'link', 'offline');
    applyDotState(gatewayDotEl, 'link', 'offline');
    if (wrapperRestartBtnEl) {
      wrapperRestartBtnEl.disabled = false;
      if (String(wrapperRestartBtnEl.textContent || '').startsWith('Restarting')) {wrapperRestartBtnEl.textContent = 'Restart';}
    }
    if (gatewayRestartBtnEl) {
      gatewayRestartBtnEl.disabled = false;
      if (String(gatewayRestartBtnEl.textContent || '').startsWith('Restarting')) {gatewayRestartBtnEl.textContent = 'Restart';}
    }
    addDebugLine('Wrapper websocket disconnected; retrying…', 'pink');
    setTimeout(connect, 1000);
  });
}

formEl?.addEventListener('submit', ev => {
  ev.preventDefault();
  submitChatText(inputEl.value).catch(error => {
    addDebugLine(`submit failed: ${error?.message || error}`, 'pink');
  });
});

chatAttachBtnEl?.addEventListener('click', () => {
  chatAttachmentInputEl?.click();
});

voiceInputBtnEl?.addEventListener('click', async () => {
  if (voiceInputState.transcribing) {return;}
  if (voiceInputState.recording) {
    stopVoiceRecording();
    return;
  }
  await startVoiceRecording();
});

chatAttachmentInputEl?.addEventListener('change', event => {
  handleChatAttachmentFiles(event.target?.files || []);
});

function syncContinueButton() {
  if (!continueBtnEl) {return;}
  const selectedRun = getSelectedSessionRunState();
  continueBtnEl.disabled = !selectedRun.canContinue;
}

continueBtnEl?.addEventListener('click', () => {
  if (continueBtnEl?.disabled) {return;}
  submitChatText('继续', { outboundText: buildContinuePayload() }).catch(error => {
    addDebugLine(`continue failed: ${error?.message || error}`, 'pink');
  });
});

stopBtnEl?.addEventListener('click', () => {
  const sessionKey = selectedSessionKey || gatewayMainSessionKey || null;
  const runState = getSessionRunState(sessionKey);
  if (!runState.runId || runState.state !== 'streaming') {return;}
  runState.state = 'aborting';
  syncStopButton();
  _stopRequestedAt = Date.now();
  abortedRunIds.add(runState.runId);
  if (abortedRunIds.size > 200) {abortedRunIds.clear();}
  updateChatRunStatus(runState.runId, 'aborted');
  const stoppedRunId = runState.runId;
  streamingEl = null;
  streamingRunId = null;
  runState.runId = null;
  runState.streamText = '';
  runState.state = 'aborted';
  addDebugLine(`User stopped run ${String(stoppedRunId).slice(0, 8)}`, 'pink');
  markLatestAssistantReplyAborted(stoppedRunId, sessionKey);
  scheduleSessionRefresh(sessionKey, 'user-stop', 0);
  syncStopButton();
  syncContinueButton();
});

inputEl?.addEventListener('input', resizeComposer);
inputEl?.addEventListener('keydown', event => {
  if (event.key !== 'Enter') {return;}
  if (event.metaKey || event.ctrlKey) {
    event.preventDefault();
    submitChatText(inputEl.value).catch(error => {
      addDebugLine(`submit failed: ${error?.message || error}`, 'pink');
    });
    return;
  }
  if (event.shiftKey) {
    event.preventDefault();
    submitChatText('继续', { outboundText: buildContinuePayload() }).catch(error => {
      addDebugLine(`continue failed: ${error?.message || error}`, 'pink');
    });
    return;
  }
});
window.addEventListener('resize', resizeComposer);
window.addEventListener('resize', resizeClaudeComposer);
fileBackBtnEl?.addEventListener('click', () => {
  if (currentDir === '.') {return;}
  const parent = currentDir.includes('/') ? currentDir.split('/').slice(0, -1).join('/') : '.';
  if (currentDir) {lastVisitedDirs.push(currentDir);}
  void loadFileTree(parent || '.');
});
fileForwardBtnEl?.addEventListener('click', () => {
  const prev = lastVisitedDirs.pop();
  if (!prev) {return;}
  void loadFileTree(prev);
});
fileRefreshBtnEl?.addEventListener('click', () => loadFileTree(currentDir));
openDirBtnEl?.addEventListener('click', async () => {
  try {
    await openCurrentDirectoryInFinder();
  } catch (error) {
    appendTerminalOutput(error.message || String(error), 'pink');
  }
});
terminalFormEl?.addEventListener('submit', async ev => {
  ev.preventDefault();
  const command = String(terminalInputEl?.value || '').trim();
  if (!command) {return;}
  const execTaskId = allocExecTaskId();
  registerExecTask(execTaskId, command);
  syncTerminalTaskButtons();
  addDebugLine(`Exec task started ${execTaskId} · ${command}`, 'cyan');
  if (terminalInputEl) {terminalInputEl.value = '';}
  try {
    await runTerminalCommand(command);
    updateExecTaskStatus(execTaskId, 'completed');
    syncTerminalTaskButtons();
    addDebugLine(`Exec task completed ${execTaskId}`, 'cyan');
  } catch (error) {
    updateExecTaskStatus(execTaskId, 'failed');
    syncTerminalTaskButtons();
    appendTerminalOutput(error.message || String(error), 'pink');
    addDebugLine(`Exec task failed ${execTaskId}: ${error.message || error}`, 'pink');
  }
});

terminalDetachBtnEl?.addEventListener('click', () => {
  const task = findLatestExecTask('running');
  if (!task) {return;}
  updateExecTaskStatus(task.taskId, 'detached', {
    visibleInUi: false,
    detachedAt: Date.now(),
  });
  syncTerminalTaskButtons();
  addDebugLine(`Exec task detached ${task.taskId} (still running)`, 'pink');
});

terminalTerminateBtnEl?.addEventListener('click', async () => {
  const task = findLatestExecTask('running') || findLatestExecTask('detached');
  if (!task || !terminalSessionId) {return;}
  updateExecTaskStatus(task.taskId, 'terminating', {
    terminationRequestedAt: Date.now(),
    terminationError: null,
  });
  syncTerminalTaskButtons();
  addDebugLine(`Exec task terminating ${task.taskId}`, 'pink');
  try {
    const res = await fetch('/api/terminal/terminate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: terminalSessionId }),
    });
    const data = await res.json();
    if (!res.ok) {throw new Error(data.error || 'terminal terminate failed');}
    if (data.status === 'terminated' || data.status === 'exited') {
      updateExecTaskStatus(task.taskId, 'terminated', {
        terminatedAt: Date.now(),
        terminationError: data.terminationError || null,
      });
      addDebugLine(`Exec task terminated ${task.taskId}`, 'pink');
    } else if (data.status === 'failed') {
      updateExecTaskStatus(task.taskId, 'failed', {
        terminationError: data.terminationError || 'terminate failed',
      });
      addDebugLine(`Exec task terminate failed ${task.taskId}: ${data.terminationError || 'unknown error'}`, 'pink');
    }
  } catch (error) {
    updateExecTaskStatus(task.taskId, 'failed', {
      terminationError: error.message || String(error),
    });
    addDebugLine(`Exec task terminate failed ${task.taskId}: ${error.message || error}`, 'pink');
  } finally {
    syncTerminalTaskButtons();
  }
});
cameraCaptureBtnEl?.addEventListener('click', () => runCameraCapture());
gestureWatcherBtnEl?.addEventListener('click', async () => {
  try {
    const turnOn = !String(gestureWatcherBtnEl.textContent || '').includes('on');
    await setGestureWatcher(turnOn);
    await refreshCameraTelemetry();
  } catch (error) {
    addDebugLine(`Watcher toggle failed: ${error.message || error}`, 'pink');
  }
});

tokenSaverToggleBtnEl?.addEventListener('click', async () => {
  const nextEnabled = String(tokenSaverToggleBtnEl.dataset.enabled || 'false') !== 'true';
  tokenSaverToggleBtnEl.disabled = true;
  try {
    await setTokenSaverEnabled(nextEnabled);
  } catch (error) {
    addDebugLine(`Token saver toggle failed: ${error.message || error}`, 'pink');
  } finally {
    tokenSaverToggleBtnEl.disabled = false;
  }
});

tokenSaverPhase1BtnEl?.addEventListener('click', async () => {
  const nextEnabled = String(tokenSaverPhase1BtnEl.dataset.enabled || 'false') !== 'true';
  tokenSaverPhase1BtnEl.disabled = true;
  try {
    await updateTokenSaverConfig({ phase1Summary: nextEnabled });
  } catch (error) {
    addDebugLine(`Token saver L1 toggle failed: ${error.message || error}`, 'pink');
  } finally {
    tokenSaverPhase1BtnEl.disabled = false;
  }
});

tokenSaverPhase2BtnEl?.addEventListener('click', async () => {
  const nextEnabled = String(tokenSaverPhase2BtnEl.dataset.enabled || 'false') !== 'true';
  tokenSaverPhase2BtnEl.disabled = true;
  try {
    await updateTokenSaverConfig({ phase2ToolCompression: nextEnabled });
  } catch (error) {
    addDebugLine(`Token saver L2 toggle failed: ${error.message || error}`, 'pink');
  } finally {
    tokenSaverPhase2BtnEl.disabled = false;
  }
});
replyRefreshBtnEl?.addEventListener('click', () => {
  fetchRepliesList().catch(error => {
    addDebugLine(`Replies refresh failed: ${error?.message || error}`, 'pink');
  });
});
replyIngestTestBtnEl?.addEventListener('click', () => {
  ingestTestReply().catch?.(() => {});
});
replyCaptureSetupBtnEl?.addEventListener('click', () => {
  openReplyCaptureSetup().catch(error => {
    addDebugLine(`Capture setup open failed: ${error?.message || error}`, 'pink');
  });
});
replySendToVioBtnEl?.addEventListener('click', () => {
  if (repliesState.selectedId) {
    sendReplyToVio(repliesState.selectedId).catch(error => {
      addDebugLine(`Send to Vio failed: ${error?.message || error}`, 'pink');
    });
  }
});
replySaveBtnEl?.addEventListener('click', () => {
  if (repliesState.selectedId) {
    saveReplyToWorkspace(repliesState.selectedId).catch(error => {
      addDebugLine(`Save to workspace failed: ${error?.message || error}`, 'pink');
    });
  }
});
replyDoneBtnEl?.addEventListener('click', () => {
  if (repliesState.selectedId) {
    markReplyDone(repliesState.selectedId).catch(error => {
      addDebugLine(`Mark done failed: ${error?.message || error}`, 'pink');
    });
  }
});
replyDeleteBtnEl?.addEventListener('click', () => {
  if (repliesState.selectedId) {
    deleteReply(repliesState.selectedId).catch(error => {
      addDebugLine(`Delete reply failed: ${error?.message || error}`, 'pink');
    });
  }
});
replyOpenSourceBtnEl?.addEventListener('click', () => {
  if (repliesState.selectedId) {openReplySource(repliesState.selectedId);}
});
fileUndoBtnEl?.addEventListener('click', () => {
  if (!fileEditorEl) {return;}
  fileEditorEl.value = currentFileOriginal || '';
  syncEditorHighlight();
});
fileSaveBtnEl?.addEventListener('click', async () => {
  if (!currentFilePath || !fileEditorEl) {return;}
  try {
    const res = await fetch('/api/file', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentFilePath, content: fileEditorEl.value }),
    });
    const data = await res.json();
    if (!res.ok) {throw new Error(data.error || 'save failed');}
    currentFileOriginal = fileEditorEl.value;
    if (data?.safeEdit) {
      addDebugLine(`Saved file: ${currentFilePath} · ${summarizeSafeEditResult(data.safeEdit)} · ${String(data.safeEdit.id || '').slice(0, 12)}`, 'cyan');
      const smokeChecks = Array.isArray(data.safeEdit?.checks?.smoke?.checks) ? data.safeEdit.checks.smoke.checks : [];
      for (const check of smokeChecks) {
        addDebugLine(`safe-edit smoke ${check.ok ? 'ok' : 'warn'} · ${check.name}`, check.ok ? 'cyan' : 'pink');
      }
    } else {
      addDebugLine(`Saved file: ${currentFilePath}`, 'cyan');
    }
    await refreshSafeEditState();
  } catch {
    addDebugLine(`Save failed: ${currentFilePath}`, 'pink');
  }
});
fileEditorEl?.addEventListener('input', syncEditorHighlight);
fileEditorEl?.addEventListener('scroll', syncEditorHighlight);

resizeComposer();
resizeClaudeComposer();
setVoiceInputStatus('Click Voice to record', 'idle');
applyLayoutPrefs();
fetchServerConfig().catch(() => {});
bindFoldPersistence(cameraFoldEl, 'cameraFoldOpen', false);
bindFoldPersistence(gestureFoldEl, 'gestureFoldOpen', false);
setupResizers();
void refreshCameraTelemetry();
void refreshVioBodyState();
void refreshTokenSaverStats();
void refreshDistInfo();
void refreshSafeEditState();
syncTerminalTaskButtons();
syncContinueButton();
setInterval(() => {
  const viewedRunState = getSessionRunState(getActiveViewedSessionKey());
  if (viewedRunState.state === 'streaming' && lastStreamEventAt && (Date.now() - lastStreamEventAt) > 10000) {
    forceFinalizeFrontState('stream-watchdog-timeout');
  }
}, 2000);
setInterval(refreshCameraTelemetry, 2500);
setInterval(refreshVioBodyState, 5000);
setInterval(refreshTokenSaverStats, 4000);
setInterval(refreshDistInfo, 15000);
setInterval(refreshSafeEditState, 5000);
syncFileNavButtons();
void loadFileTree();
ensureTerminalSession().catch(() => {});
sessionsRefreshBtnEl?.addEventListener('click', () => {
  fetchDashboardSessions()
    .then(() => {
      if (selectedSessionKey && sessionMessages.has(selectedSessionKey)) {
        return selectDashboardSession(selectedSessionKey, { force: false });
      }
      return null;
    })
    .catch(error => addDebugLine(`sessions refresh failed: ${error?.message || error}`, 'pink'));
});

fetchDashboardSessions()
  .then(() => {
    if (selectedSessionKey && sessionMessages.has(selectedSessionKey)) {
      return selectDashboardSession(selectedSessionKey, { force: false });
    }
    renderSessionIdlePlaceholder(getActiveViewedSessionKey());
    addDebugLine(`sessions init loaded list only; deferred history for ${selectedSessionKey || 'none'}`, 'cyan');
    return null;
  })
  .catch(error => addDebugLine(`sessions init failed: ${error?.message || error}`, 'pink'));

fetchRepliesList().catch(error => {
  addDebugLine(`Replies init failed: ${error?.message || error}`, 'pink');
});
try { initClaudePanel(); } catch (error) { addDebugLine(`initClaudePanel failed: ${error?.message || error}`, 'pink'); }
try { renderRunModeChip(); } catch (error) { addDebugLine(`renderRunModeChip failed: ${error?.message || error}`, 'pink'); }
try { fetchRunMode().catch(() => renderRunModeChip()); } catch (error) { addDebugLine(`fetchRunMode failed: ${error?.message || error}`, 'pink'); }
try { runModeChipEl?.addEventListener('click', toggleRunMode); } catch (error) { addDebugLine(`runModeChip bind failed: ${error?.message || error}`, 'pink'); }
distRebuildBtnEl?.addEventListener('click', rebuildDist);
wrapperRestartBtnEl?.addEventListener('click', restartWrapper);
gatewayRestartBtnEl?.addEventListener('click', restartGateway);
contextCompactBtnEl?.addEventListener('click', compactContext);
window.__VIO_APP_LOADED__ = true;
try { connect(); } catch (error) { addDebugLine(`connect failed: ${error?.message || error}`, 'pink'); }
