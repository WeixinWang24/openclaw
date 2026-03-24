// Main local wrapper server: serves the UI, bridges gateway chat, and exposes
// local helper endpoints for project files, camera telemetry, and gesture control.
//
// This file now stays intentionally small: route wiring and lifecycle live here,
// while file access, gesture/camera logic, static serving, and gateway RPC are
// split into focused helper modules under src/server/.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { WebSocketServer } from 'ws';
import { APP_DISPLAY_NAME, CLIENT_CONFIG, DATA_DIR, DEBUG_DIR, DEFAULT_CLAUDE_CWD, GATEWAY_PROFILE, LAUNCHD_LABEL, OPENCLAW_BIN, OPENCLAW_DIST_BUILD_INFO, OPENCLAW_REPO_ROOT, PNPM_BIN, ROADMAP_DATA_PATH, ROADMAP_HISTORY_DATA_PATH, ROOT, wrapperPort } from './config.mjs';
import { onAssistantFinal, onAssistantError } from './moodBridge.mjs';
import { sendJson } from './server/httpUtils.mjs';
import { listProjectFiles, readProjectFile, writeProjectFile, safeProjectPath } from './server/filesystem.mjs';
import { getSafeEditState, performStartupRecovery, runSafeEditSmokeSummary } from './server/safeEdit.mjs';
import { getCameraTelemetry, getGestureRuntimeState, runCameraCapture, runGestureCycle, runGesturePipeline, updateGestureWatcher } from './server/gesture.mjs';
import { serveCameraAsset, servePublicFile } from './server/static.mjs';
import { GatewayBridge, gatewayCall, warmGatewayCaller } from './server/gatewayBridge.mjs';
import { readJsonRequest } from './server/httpUtils.mjs';
import { createKernelEventBus } from './server/kernel/kernelEventBus.mjs';
import { createRuntimeDiagnostics } from './server/kernel/runtimeDiagnostics.mjs';
import { createGatewayRpcClient } from './server/kernel/gatewayRpcClient.mjs';
import { createSessionRegistry } from './server/kernel/sessionRegistry.mjs';
import { createChatRuntime } from './server/kernel/chatRuntime.mjs';
import { createTranscriptService } from './server/kernel/transcriptService.mjs';
import { createChatProjection } from './server/projection/chatProjection.mjs';
import { handleChatRoutes } from './server/routes/chatRoutes.mjs';
import { handleSessionRoutes } from './server/routes/sessionRoutes.mjs';
import { handleDiagnosticsRoutes } from './server/routes/diagnosticsRoutes.mjs';
import { createBroadcastHub } from './server/ws/broadcastHub.mjs';
import { attachWsConnectionHandler } from './server/ws/connectionHandler.mjs';
import { getClaudeState, resizeClaudeSession, restartClaudeSession, sendClaudeInput, startClaudeSession, stopClaudeSession } from './server/claudeTerminal.mjs';
import { evaluateSetupState } from './server/setupState.mjs';
import { handleSetupAction } from './server/setupActions.mjs';
import { getGuidelinesDir, listGuidelines } from './server/memorySystem.mjs';
import { handleAgentTaskRoutes } from './server/routes/agentTasks.mjs';
import { handleExternalRepliesRoutes } from './server/routes/externalReplies.mjs';
import { syncRealTaskFromClaudeState, onClaudeOutput, getCurrentTask } from './server/agentTasks/index.mjs';
import { notifyAssistantFinal, getNotificationPrefs, setNotificationPrefs } from './server/notifications.mjs';
import { createChatEventCoordinator } from './server/runtime/chatEventCoordinator.mjs';
import { createRuntimeSessionState } from './server/runtime/runtimeSessionState.mjs';
import { createTokenUsageService } from './server/runtime/tokenUsageService.mjs';
import { createFinalReplyService } from './server/runtime/finalReplyService.mjs';
import { createRunLifecycleService } from './server/runtime/runLifecycleService.mjs';
import { createRoadmapStateService } from './server/runtime/roadmapStateService.mjs';
import { createRuntimeMoodStateService } from './server/runtime/runtimeMoodStateService.mjs';

const terminalSessions = new Map();
const MAX_TERMINAL_SESSIONS = 5;

function resolveInteractiveShell() {
  const candidates = ['/bin/bash', '/bin/sh', process.env.SHELL, '/bin/zsh'].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {return candidate;}
    } catch {}
  }
  return '/bin/sh';
}

function getOrCreateTerminalSession(sessionId = 'default', cwdRel = '.') {
  const existing = terminalSessions.get(sessionId);
  if (existing && !existing.exited) {return existing;}
  if (!terminalSessions.has(sessionId) && terminalSessions.size >= MAX_TERMINAL_SESSIONS) {
    throw new Error(`Max terminal sessions (${MAX_TERMINAL_SESSIONS}) reached`);
  }
  const cwd = safeProjectPath(cwdRel);
  const shellPath = resolveInteractiveShell();
  const shellArgs = shellPath.endsWith('/sh') ? ['-i'] : ['-i'];
  const child = spawn(shellPath, shellArgs, { cwd, env: process.env, stdio: 'pipe' });
  const state = {
    id: sessionId,
    cwdRel,
    child,
    shellPath,
    output: '',
    exited: false,
    exitCode: null,
    status: 'running',
    terminationRequestedAt: null,
    terminatedAt: null,
    terminationError: null,
  };
  const append = chunk => {
    state.output += String(chunk || '');
    if (state.output.length > 20000) {state.output = state.output.slice(-20000);}
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('error', error => {
    state.output += `\n[terminal spawn error] ${error?.message || String(error)}\n`;
    state.exited = true;
    state.exitCode = null;
    state.status = 'failed';
    state.terminationError = error?.message || String(error);
    state.terminatedAt = state.terminatedAt || new Date().toISOString();
  });
  child.on('exit', code => {
    state.exited = true;
    state.exitCode = code;
    if (state.status === 'terminating') {
      state.status = 'terminated';
      state.terminatedAt = state.terminatedAt || new Date().toISOString();
    } else if (state.status !== 'failed') {
      state.status = 'exited';
    }
  });
  terminalSessions.set(sessionId, state);
  return state;
}


function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function fileMtimeIso(filePath) {
  const stat = safeStat(filePath);
  return stat?.mtime?.toISOString?.() || null;
}

function readJsonFile(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {return null;}
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getNewestDistMtime(distRoot) {
  try {
    if (!distRoot || !fs.existsSync(distRoot)) {return null;}
    const stack = [distRoot];
    let newest = 0;
    while (stack.length) {
      const current = stack.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        const stat = safeStat(fullPath);
        const mtimeMs = stat?.mtimeMs || 0;
        if (mtimeMs > newest) {newest = mtimeMs;}
      }
    }
    return newest ? new Date(newest).toISOString() : null;
  } catch {
    return null;
  }
}

function loadLaunchAgentProgramArguments(plistPath) {
  try {
    if (!fs.existsSync(plistPath)) {return null;}
    const raw = execFileSync('plutil', ['-convert', 'json', '-o', '-', plistPath], { encoding: 'utf8' });
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.ProgramArguments) ? parsed.ProgramArguments.map(String) : null;
  } catch {
    return null;
  }
}

function resolveGatewayRuntimeInfo() {
  try {
    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'ai.openclaw.gateway.plist');
    const programArguments = loadLaunchAgentProgramArguments(plistPath);
    const entry = Array.isArray(programArguments) ? programArguments.find(arg => arg.endsWith('/dist/index.js')) || null : null;
    const packageRoot = entry ? path.dirname(path.dirname(entry)) : null;
    const pkg = readJsonFile(packageRoot ? path.join(packageRoot, 'package.json') : null);
    const buildInfoPath = packageRoot ? path.join(packageRoot, 'dist', 'build-info.json') : null;
    const buildInfo = readJsonFile(buildInfoPath);
    return {
      plistPath,
      programArguments,
      entry,
      packageRoot,
      version: buildInfo?.version || pkg?.version || null,
      commit: buildInfo?.commit || null,
      builtAt: buildInfo?.builtAt || null,
      buildInfoPath,
      buildInfoMtime: fileMtimeIso(buildInfoPath),
      source: entry?.startsWith(OPENCLAW_REPO_ROOT) ? 'repo' : (entry ? 'external' : 'unknown'),
    };
  } catch {
    return null;
  }
}

function loadDistBuildInfo() {
  const configuredBuildInfo = readJsonFile(OPENCLAW_DIST_BUILD_INFO);
  const configuredDistRoot = path.dirname(OPENCLAW_DIST_BUILD_INFO);
  const runtime = resolveGatewayRuntimeInfo();
  return {
    configured: configuredBuildInfo ? {
      ...configuredBuildInfo,
      buildInfoPath: OPENCLAW_DIST_BUILD_INFO,
      buildInfoMtime: fileMtimeIso(OPENCLAW_DIST_BUILD_INFO),
      distRoot: configuredDistRoot,
      distMtime: getNewestDistMtime(configuredDistRoot),
    } : null,
    runtime,
    mismatch: Boolean(runtime?.entry && !runtime.entry.startsWith(OPENCLAW_REPO_ROOT)),
  };
}

const broadcastHub = createBroadcastHub();
const roadmapStateService = createRoadmapStateService({
  dataDir: DATA_DIR,
  roadmapDataPath: ROADMAP_DATA_PATH,
  roadmapHistoryDataPath: ROADMAP_HISTORY_DATA_PATH,
});
const runtimeSessionState = createRuntimeSessionState();
const { tokenStats, seenFinalRunIds, activeRunSeq } = runtimeSessionState;
const runtimeMoodStateService = createRuntimeMoodStateService({ activeRunSeq });
let runSequence = 0;
let runtimeGatewayReadPrewarmStarted = false;

function broadcast(packet) {
  broadcastHub.broadcast(packet);
}

async function prewarmGatewayReadPaths() {
  if (runtimeGatewayReadPrewarmStarted) {return;}
  runtimeGatewayReadPrewarmStarted = true;
  const startedAtIso = new Date().toISOString();
  const startedAtMs = Date.now();
  runtimeDiagnostics.recordPrewarm('readPaths', {
    status: 'running',
    startedAt: startedAtIso,
    finishedAt: null,
    durationMs: null,
    error: null,
  });
  try {
    await bridge.listSessions({ limit: 20 });
    await bridge.fetchSessionUsage();
    await bridge.fetchSessionContextSnapshot();
    await bridge.fetchModelCatalog();
    runtimeDiagnostics.recordPrewarm('readPaths', {
      status: 'ok',
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      error: null,
    });
  } catch (error) {
    runtimeDiagnostics.recordPrewarm('readPaths', {
      status: 'error',
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      error: error?.message || String(error),
    });
    console.warn('[wrapper] gateway read-path prewarm failed', error?.message || String(error));
  }
}

function buildTokensPacket() {
  return {
    type: 'tokens',
    last: tokenStats.last,
    totalInput: tokenStats.totalInput,
    totalOutput: tokenStats.totalOutput,
    totalCacheRead: tokenStats.totalCacheRead,
    totalCacheWrite: tokenStats.totalCacheWrite,
    total: tokenStats.total,
    modelName: tokenStats.modelName,
    modelProvider: tokenStats.modelProvider,
    modelLimit: tokenStats.modelLimit,
    modelUsagePercent: tokenStats.modelUsagePercent,
    contextSnapshot: tokenStats.contextSnapshot,
    diagnosticContext: tokenStats.diagnosticContext,
  };
}

const startupRecovery = performStartupRecovery();
if (startupRecovery.recovered.length || startupRecovery.warnings.length) {
  console.log('[wrapper] startup recovery', JSON.stringify(startupRecovery));
}

const kernelEventBus = createKernelEventBus();
const runtimeDiagnostics = createRuntimeDiagnostics();
runtimeDiagnostics.recordPrewarm('gatewayHelper', {
  status: 'running',
  startedAt: new Date().toISOString(),
  finishedAt: null,
  durationMs: null,
  error: null,
});
const gatewayHelperPrewarmStartedAt = Date.now();
warmGatewayCaller()
  .then(() => {
    runtimeDiagnostics.recordPrewarm('gatewayHelper', {
      status: 'ok',
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - gatewayHelperPrewarmStartedAt,
      error: null,
    });
  })
  .catch(error => {
    runtimeDiagnostics.recordPrewarm('gatewayHelper', {
      status: 'error',
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - gatewayHelperPrewarmStartedAt,
      error: error?.message || String(error),
    });
    console.warn('[wrapper] gateway helper prewarm failed', error?.message || String(error));
  });
const sessionRegistry = createSessionRegistry();
let bridge;
const rpcClient = createGatewayRpcClient({
  gatewayCall,
  bridgeRequest: async (method, params) => await bridge.request(method, params),
  eventBus: kernelEventBus,
  diagnostics: runtimeDiagnostics,
  stateRef: { get connected() { return bridge?.connected === true; } },
});
const chatRuntime = createChatRuntime({
  rpcClient,
  eventBus: kernelEventBus,
  sessionRegistry,
  diagnostics: runtimeDiagnostics,
});
const transcriptService = createTranscriptService({
  rpcClient,
  eventBus: kernelEventBus,
  diagnostics: runtimeDiagnostics,
});
const chatProjection = createChatProjection({ eventBus: kernelEventBus });
const tokenUsageService = createTokenUsageService({
  bridge: { fetchSessionUsage: (...args) => bridge.fetchSessionUsage(...args), fetchModelCatalog: (...args) => bridge.fetchModelCatalog(...args), fetchSessionContextSnapshot: (...args) => bridge.fetchSessionContextSnapshot(...args) },
  tokenStats,
  broadcast,
  buildTokensPacket,
});
const runLifecycleService = createRunLifecycleService({
  state: {
    activeRunSeq,
    runSequenceRef: {
      get: () => runSequence,
      increment: () => {
        runSequence += 1;
        return runSequence;
      },
    },
  },
  routing: {
    getLastRouting: () => runtimeSessionState.getLastRouting(),
    setLastRouting: value => {
      runtimeSessionState.setLastRouting(value);
    },
  },
  getRuntimeState: () => runtimeMoodStateService.getRuntimeState(),
  syncRuntimeState: runtimeMoodStateService.syncRuntimeState,
  buildMoodPacket: runtimeMoodStateService.buildMoodPacket,
  broadcast,
  sideEffects: {
    onAssistantError,
  },
});
const finalReplyService = createFinalReplyService({
  state: {
    activeRunSeq,
    runSequenceRef: { get: () => runSequence },
    lastAssistantFinalNotifiedRunIdRef: {
      get: () => runtimeSessionState.getLastAssistantFinalNotifiedRunId(),
      set: value => {
        runtimeSessionState.setLastAssistantFinalNotifiedRunId(value);
      },
    },
  },
  roadmap: roadmapStateService,
  routing: {
    getLastRouting: () => runtimeSessionState.getLastRouting(),
    setLastRouting: value => {
      runtimeSessionState.setLastRouting(value);
    },
  },
  sideEffects: {
    onAssistantFinal,
    notifyAssistantFinal,
  },
  broadcast,
  buildMoodPacket: runtimeMoodStateService.buildMoodPacket,
  getRuntimeState: () => runtimeMoodStateService.getRuntimeState(),
  syncRuntimeState: runtimeMoodStateService.syncRuntimeState,
  wrapperPort,
});
const handleChatEvent = createChatEventCoordinator({
  bridge: { get sessionKey() { return bridge.sessionKey; } },
  broadcast,
  state: {
    tokenStats,
    seenFinalRunIds,
    activeRunSeq,
    runSequenceRef: { get: () => runSequence },
    lastAssistantFinalNotifiedRunIdRef: {
      get: () => runtimeSessionState.getLastAssistantFinalNotifiedRunId(),
      set: value => {
        runtimeSessionState.setLastAssistantFinalNotifiedRunId(value);
      },
    },
  },
  tokenUsageService,
  finalReplyService,
  runLifecycleService,
});

bridge = new GatewayBridge({
  onStatus: payload => {
    broadcast({ type: 'status', ...payload });
    if (payload?.connected) {
      setTimeout(() => {
        prewarmGatewayReadPaths().catch(() => {});
      }, 0);
    }
  },
  onSessionUpdated: payload => {
    broadcast({ type: 'session.updated', ...payload });
  },
  onDiagnosticEvent: event => {
    const used = typeof event?.context?.used === 'number' ? event.context.used : null;
    const limit = typeof event?.context?.limit === 'number' ? event.context.limit : null;
    tokenStats.diagnosticContext = {
      used,
      limit,
      pct: used != null && limit ? Math.min(100, Math.round((used / limit) * 1000) / 10) : null,
      sessionKey: event?.sessionKey || null,
      model: event?.model || null,
      provider: event?.provider || null,
      ts: typeof event?.ts === 'number' ? event.ts : Date.now(),
    };
    broadcast(buildTokensPacket());
  },
  onQueuedMood: (runId, sidecarResult = null) => {
    runLifecycleService.handleQueued(runId, sidecarResult);
  },
  onChatEvent: handleChatEvent,
});
bridge.setRuntimeAdapters({
  rpcClient,
  chatRuntime,
  transcriptService,
  chatProjection,
  sessionRegistry,
});
kernelEventBus.subscribe('raw.gateway', rawEvent => {
  chatRuntime.ingestRawEvent(rawEvent);
});
kernelEventBus.subscribe('kernel.run', event => {
  broadcast({
    type: 'kernel.run',
    event,
    view: event?.sessionKey ? chatProjection.getSessionView(event.sessionKey) : null,
  });
});
kernelEventBus.subscribe('kernel.transcript', event => {
  if (event?.type === 'transcript.refreshed') {
    broadcast({
      type: 'projection.transcript',
      sessionKey: event.sessionKey,
      view: chatProjection.getSessionView(event.sessionKey),
      source: 'kernel.transcript',
    });
  }
});
bridge.connect();

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${wrapperPort}`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (requestUrl.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      service: APP_DISPLAY_NAME,
      port: wrapperPort,
      gatewayConnected: bridge.connected,
      startupRecovery: {
        recovered: startupRecovery.recovered.length,
        warnings: startupRecovery.warnings.length,
      },
    });
    return;
  }

  if (requestUrl.pathname === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, config: CLIENT_CONFIG });
    return;
  }

  if (handleSessionRoutes({
    req,
    res,
    requestUrl,
    bridge,
    sessionRegistry,
  })) {
    return;
  }

  if (handleChatRoutes({
    req,
    res,
    requestUrl,
    chatRuntime,
    transcriptService,
    chatProjection,
  })) {
    return;
  }

  if (handleDiagnosticsRoutes({
    req,
    res,
    requestUrl,
    bridge,
    runtimeDiagnostics,
    sessionRegistry,
    chatProjection,
    broadcastHub,
  })) {
    return;
  }

  if (requestUrl.pathname === '/api/setup/state' && req.method === 'GET') {
    const claudeState = getClaudeState();
    sendJson(res, 200, evaluateSetupState({ bridgeConnected: bridge.connected, claudeState }));
    return;
  }

  if (requestUrl.pathname === '/api/setup/action' && req.method === 'POST') {
    readJsonRequest(req)
      .then(async body => {
        const action = body && typeof body.action === 'string' ? body.action.trim() : '';
        if (!action) {
          sendJson(res, 400, { ok: false, error: 'missing "action" field' });
          return;
        }
        const result = await handleSetupAction({
          action,
          bridgeConnected: bridge.connected,
          claudeState: getClaudeState(),
        });
        // dashboard-service-restart: send response first, then schedule the restart.
        const shouldReload = result._reload === true;
        const { _reload: _, ...safeResult } = result;
        sendJson(res, shouldReload ? 202 : 200, safeResult);
        if (shouldReload) {
          setTimeout(() => {
            // Setup wizard reload only needs a service restart, not a full
            // bootout/bootstrap cycle. Running reload.sh from inside the
            // launchd-managed wrapper can unload the current job before the
            // helper finishes, leaving the dashboard down. `kickstart -k`
            // restarts the existing job in place and is safe to trigger here.
            execFile('launchctl', ['kickstart', '-k', `gui/${process.getuid()}/${LAUNCHD_LABEL}`], { cwd: ROOT }, () => {});
          }, 120);
        }
      })
      .catch(error => sendJson(res, 400, { ok: false, error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/dist-info' && req.method === 'GET') {
    const info = loadDistBuildInfo();
    sendJson(res, 200, { ok: true, info });
    return;
  }

  if (requestUrl.pathname === '/api/dist-rebuild' && req.method === 'POST') {
    readJsonRequest(req)
      .then(() => {
        sendJson(res, 202, { ok: true, rebuilding: true });
        setTimeout(() => {
          execFile(PNPM_BIN, ['build'], { cwd: OPENCLAW_REPO_ROOT, env: process.env }, () => {});
        }, 120);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/safe-edit/state' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      ...getSafeEditState(),
      startupRecovery,
      smoke: runSafeEditSmokeSummary(),
    });
    return;
  }

  if (requestUrl.pathname === '/api/roadmap' && req.method === 'GET') {
    const roadmap = roadmapStateService.loadRoadmapData();
    sendJson(res, 200, { ok: true, roadmap });
    return;
  }

  if (requestUrl.pathname === '/api/coms/token-saver' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, tokenSaver: bridge.getTokenSaverSnapshot() });
    return;
  }

  if (requestUrl.pathname === '/api/coms/token-saver' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const tokenSaver = bridge.setTokenSaverConfig({
          ...(typeof payload?.enabled === 'boolean' ? { enabled: payload.enabled } : {}),
          ...(typeof payload?.phase1Summary === 'boolean' ? { phase1Summary: payload.phase1Summary } : {}),
          ...(typeof payload?.phase2ToolCompression === 'boolean' ? { phase2ToolCompression: payload.phase2ToolCompression } : {}),
        });
        broadcast({ type: 'token-saver', tokenSaver });
        sendJson(res, 200, { ok: true, tokenSaver });
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/coms/token-saver/stats' && req.method === 'GET') {
    const snapshot = bridge.getTokenSaverSnapshot();
    sendJson(res, 200, {
      ok: true,
      stats: snapshot?.stats || null,
      lastSend: snapshot?.lastSend || null,
      memory: snapshot?.memory || { summary: '', turnCount: 0, recentTurns: [] },
      lastAssistantFinal: snapshot?.lastAssistantFinal || null,
    });
    return;
  }

  if (requestUrl.pathname === '/api/coms/token-saver/runs' && req.method === 'GET') {
    try {
      const debugDir = DEBUG_DIR;
      const indexPath = `${debugDir}/run-index.json`;
      const items = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
      sendJson(res, 200, { ok: true, items: Array.isArray(items) ? items : [] });
    } catch (error) {
      sendJson(res, 500, { error: error?.message || String(error) });
    }
    return;
  }

  if (requestUrl.pathname === '/api/coms/token-saver/run' && req.method === 'GET') {
    try {
      const runId = String(requestUrl.searchParams.get('runId') || '').trim();
      if (!runId) {throw new Error('runId is required');}
      const debugDir = DEBUG_DIR;
      const runDir = `${debugDir}/${runId}`;
      const readJson = name => {
        const p = `${runDir}/${name}.json`;
        return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
      };
      sendJson(res, 200, {
        ok: true,
        runId,
        before: readJson('before'),
        after: readJson('after'),
        diffSummary: readJson('diff-summary'),
      });
    } catch (error) {
      sendJson(res, 400, { error: error?.message || String(error) });
    }
    return;
  }

  if (requestUrl.pathname === '/api/roadmap/history' && req.method === 'GET') {
    const items = roadmapStateService.loadRoadmapHistory();
    sendJson(res, 200, { ok: true, items });
    return;
  }

  if (requestUrl.pathname === '/api/roadmap/history/clear' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        if (payload?.confirm !== true) {throw new Error('confirm=true is required to clear roadmap history');}
        roadmapStateService.saveRoadmapHistory([]);
        broadcast({ type: 'roadmap.history.cleared' });
        sendJson(res, 200, { ok: true, cleared: true, count: 0 });
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/tasks/deploy' && req.method === 'POST') {
    readJsonRequest(req)
      .then(async payload => {
        const task = payload?.task && typeof payload.task === 'object' ? payload.task : {};
        const title = String(task.title || task.text || '').trim();
        if (!title) {throw new Error('task title is required');}
        const description = String(task.description || '').trim();
        const priority = String(task.priority || 'normal');
        const status = String(task.status || 'todo');
        const source = String(task.source || 'task-board');
        const lines = [
          'Deployed task from telemetry Task Board:',
          `Title: ${title}`,
          `Priority: ${priority}`,
          `Status: ${status}`,
          `Source: ${source}`,
        ];
        if (description) {lines.push(`Description: ${description}`);}
        lines.push('', 'Please continue by working on this task or proposing the immediate next concrete action.');
        const message = lines.join('\n');
        const dryRun = !!payload?.dryRun;
        if (dryRun) {
          sendJson(res, 200, { ok: true, dryRun: true, runId: null, message });
          return;
        }
        const runId = await bridge.sendChat(message);
        broadcast({ type: 'task.deploy', task: { ...task, title, description, priority, status, source }, runId });
        sendJson(res, 200, { ok: true, dryRun: false, runId, message });
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }


  if (requestUrl.pathname === '/api/tasks/deploy-batch' && req.method === 'POST') {
    readJsonRequest(req)
      .then(async payload => {
        const tasks = Array.isArray(payload?.tasks) ? payload.tasks.filter(task => task && typeof task === 'object') : [];
        if (tasks.length < 2) {throw new Error('at least two tasks are required for batch deploy');}
        const normalizedTasks = tasks.map((task, index) => {
          const title = String(task.title || task.text || '').trim();
          if (!title) {throw new Error(`task ${index + 1} title is required`);}
          return {
            ...task,
            title,
            description: String(task.description || '').trim(),
            priority: String(task.priority || 'normal'),
            status: String(task.status || 'todo'),
            source: String(task.source || 'task-board'),
          };
        });
        const batchId = String(payload?.batchId || `batch-${Date.now()}`);
        const deployedAt = new Date().toISOString();
        const lines = [
          'Batch deployed tasks from telemetry Task Board:',
          `Batch ID: ${batchId}`,
          `Task Count: ${normalizedTasks.length}`,
          '',
          'Treat each task as a separate entity. Do not merge them. Work through them as a coordinated batch and call out immediate next actions per task.',
          '',
          'Tasks:',
        ];
        for (const [index, task] of normalizedTasks.entries()) {
          lines.push(`${index + 1}. Title: ${task.title}`);
          lines.push(`   Priority: ${task.priority}`);
          lines.push(`   Status: ${task.status}`);
          lines.push(`   Source: ${task.source}`);
          if (task.description) {lines.push(`   Description: ${task.description}`);}
          if (task.roadmapItemId) {lines.push(`   Roadmap Item ID: ${task.roadmapItemId}`);}
          if (task.id) {lines.push(`   Task ID: ${task.id}`);}
        }
        lines.push('', 'Please continue by working on this batch while preserving separate task identities, reporting progress per task, and proposing the immediate next concrete action for the batch.');
        const message = lines.join('\n');
        const dryRun = !!payload?.dryRun;
        if (dryRun) {
          sendJson(res, 200, { ok: true, dryRun: true, runId: null, batchId, deployedAt, message, tasks: normalizedTasks });
          return;
        }
        const runId = await bridge.sendChat(message);
        broadcast({ type: 'task.batch_deploy', batchId, deployedAt, tasks: normalizedTasks, runId });
        sendJson(res, 200, { ok: true, dryRun: false, runId, batchId, deployedAt, message, tasks: normalizedTasks });
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/files' && req.method === 'GET') {
    try {
      sendJson(res, 200, listProjectFiles(requestUrl.searchParams.get('dir') || '.'));
    } catch (error) {
      sendJson(res, 500, { error: error?.message || String(error) });
    }
    return;
  }

  if (requestUrl.pathname === '/api/file' && req.method === 'GET') {
    try {
      sendJson(res, 200, readProjectFile(requestUrl.searchParams.get('path') || ''));
    } catch (error) {
      sendJson(res, 400, { error: error?.message || String(error) });
    }
    return;
  }

  if (requestUrl.pathname === '/api/file' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => sendJson(res, 200, writeProjectFile(payload.path || '', typeof payload.content === 'string' ? payload.content : '')))
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/explorer/open' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const targetDir = safeProjectPath(typeof payload.dir === 'string' && payload.dir ? payload.dir : '.');
        execFile('open', [targetDir], error => {
          if (error) {sendJson(res, 500, { error: error?.message || error?.code || 'open failed' });}
          else {sendJson(res, 200, { ok: true, dir: targetDir });}
        });
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/run-mode' && req.method === 'GET') {
    try {
      const modeFile = path.join(ROOT, 'launchd', '.run-mode');
      const mode = fs.existsSync(modeFile) ? fs.readFileSync(modeFile, 'utf8').trim() || 'source' : 'source';
      sendJson(res, 200, { ok: true, mode });
    } catch (error) {
      sendJson(res, 500, { error: error?.message || String(error) });
    }
    return;
  }

  if (requestUrl.pathname === '/api/run-mode' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const mode = payload?.mode === 'runtime' ? 'runtime' : 'source';
        const script = path.join(ROOT, 'launchd', 'set-mode.sh');
        sendJson(res, 202, { ok: true, mode, switching: true });
        setTimeout(() => {
          execFile('/bin/bash', [script, mode], { cwd: ROOT }, () => {});
        }, 120);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/wrapper/restart' && req.method === 'POST') {
    readJsonRequest(req)
      .then(() => {
        sendJson(res, 202, { ok: true, restarting: true, target: 'wrapper' });
        setTimeout(() => {
          // Restart the existing launchd job in place. Do not call reload.sh from
          // inside the launchd-managed wrapper process or it can unload itself
          // before the replacement job is fully running.
          execFile('launchctl', ['kickstart', '-k', `gui/${process.getuid()}/${LAUNCHD_LABEL}`], { cwd: ROOT }, () => {});
        }, 120);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/context/compact' && req.method === 'POST') {
    readJsonRequest(req)
      .then(async payload => {
        const sessionKey = typeof payload?.sessionKey === 'string' ? payload.sessionKey : bridge.sessionKey;
        const result = await bridge.compactSession(sessionKey);
        broadcast({ type: 'context.compacted', sessionKey, result });
        sendJson(res, 200, { ok: true, sessionKey, result });
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/debug/ws-tail' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, items: broadcastHub.getTail(100) });
    return;
  }

  if (requestUrl.pathname === '/api/memory/guidelines' && req.method === 'GET') {
    try {
      const limit = Number(requestUrl.searchParams.get('limit') || 100);
      const items = listGuidelines({ limit });
      sendJson(res, 200, {
        ok: true,
        source: 'workspace-directory',
        dir: getGuidelinesDir(),
        items,
        count: items.length,
      });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error?.message || String(error) });
    }
    return;
  }

  if (requestUrl.pathname === '/api/memory/guidelines' && req.method === 'POST') {
    sendJson(res, 405, {
      ok: false,
      error: 'guideline writes are not enabled yet; edit files under memory/permanent/guidelines directly',
      dir: getGuidelinesDir(),
    });
    return;
  }

  if (requestUrl.pathname === '/api/gateway/restart' && req.method === 'POST') {
    readJsonRequest(req)
      .then(() => {
        sendJson(res, 202, { ok: true, restarting: true, target: 'gateway', profile: GATEWAY_PROFILE });
        setTimeout(() => {
          execFile(OPENCLAW_BIN, ['--profile', GATEWAY_PROFILE, 'gateway', 'restart'], { cwd: ROOT, env: process.env }, () => {});
        }, 120);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/claude/state' && req.method === 'GET') {
    try {
      const cwdRel = requestUrl.searchParams.get('cwd') || DEFAULT_CLAUDE_CWD;
      sendJson(res, 200, getClaudeState({ cwdRel }));
    } catch (error) {
      sendJson(res, 400, { error: error?.message || String(error) });
    }
    return;
  }


  if (requestUrl.pathname === '/api/claude/start' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const cwdRel = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : DEFAULT_CLAUDE_CWD;
        const state = startClaudeSession({ cwdRel });
        sendJson(res, 200, state);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/claude/input' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const text = String(payload?.text || '');
        if (!text.length) {throw new Error('text is required');}
        const cwdRel = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : DEFAULT_CLAUDE_CWD;
        const state = sendClaudeInput({ text, cwdRel, raw: !!payload?.raw });
        sendJson(res, 200, state);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/claude/stop' && req.method === 'POST') {
    readJsonRequest(req)
      .then(() => {
        sendJson(res, 200, stopClaudeSession());
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/claude/restart' && req.method === 'POST') {
    readJsonRequest(req)
      .then(async payload => {
        const cwdRel = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : DEFAULT_CLAUDE_CWD;
        const state = await restartClaudeSession({ cwdRel });
        sendJson(res, 200, state);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/claude/resize' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const state = resizeClaudeSession({ cols: payload?.cols, rows: payload?.rows });
        sendJson(res, 200, state);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/terminal/session' && req.method === 'GET') {
    const session = getOrCreateTerminalSession('default', requestUrl.searchParams.get('cwd') || '.');
    sendJson(res, 200, { ok: true, sessionId: session.id, cwd: session.cwdRel, output: session.output, exited: session.exited, exitCode: session.exitCode });
    return;
  }

  if (requestUrl.pathname === '/api/terminal/input' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const session = getOrCreateTerminalSession(String(payload.sessionId || 'default'), typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : '.');
        const text = String(payload.text || '');
        session.child.stdin.write(text);
        setTimeout(() => {
          const toolLabel = `terminal ${session.cwdRel || '.'} $ ${text.trim() || '<empty>'}`;
          bridge.ingestToolResult(toolLabel, session.output || '', { sessionId: session.id, cwdRel: session.cwdRel });
          sendJson(res, 200, {
            ok: true,
            sessionId: session.id,
            output: session.output,
            exited: session.exited,
            exitCode: session.exitCode,
            status: session.status,
            terminationRequestedAt: session.terminationRequestedAt,
            terminatedAt: session.terminatedAt,
            terminationError: session.terminationError,
          });
        }, 120);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/terminal/terminate' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const sessionId = String(payload?.sessionId || 'default');
        const session = terminalSessions.get(sessionId);
        if (!session) {throw new Error(`terminal session not found: ${sessionId}`);}
        if (session.exited || !session.child || session.child.killed) {
          session.status = session.status === 'terminated' ? 'terminated' : 'exited';
          sendJson(res, 200, {
            ok: true,
            sessionId: session.id,
            status: session.status,
            exited: session.exited,
            exitCode: session.exitCode,
            terminationRequestedAt: session.terminationRequestedAt,
            terminatedAt: session.terminatedAt,
            terminationError: session.terminationError,
          });
          return;
        }
        session.status = 'terminating';
        session.terminationRequestedAt = new Date().toISOString();
        session.terminationError = null;
        try {
          session.child.kill('SIGTERM');
        } catch (error) {
          session.status = 'failed';
          session.terminationError = error?.message || String(error);
        }
        setTimeout(() => {
          if (!session.exited && session.child && !session.child.killed) {
            try {
              session.child.kill('SIGKILL');
            } catch (error) {
              session.status = 'failed';
              session.terminationError = error?.message || String(error);
            }
          }
          if (session.exited && session.status === 'terminating') {
            session.status = 'terminated';
            session.terminatedAt = session.terminatedAt || new Date().toISOString();
          }
          sendJson(res, 200, {
            ok: !session.terminationError,
            sessionId: session.id,
            status: session.status,
            exited: session.exited,
            exitCode: session.exitCode,
            terminationRequestedAt: session.terminationRequestedAt,
            terminatedAt: session.terminatedAt,
            terminationError: session.terminationError,
          });
        }, 120);
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/camera' && req.method === 'GET') {
    try {
      sendJson(res, 200, getCameraTelemetry());
    } catch (error) {
      sendJson(res, 500, { error: error?.message || String(error) });
    }
    return;
  }

  if (requestUrl.pathname === '/api/vio-body-state' && req.method === 'GET') {
    fetch('http://127.0.0.1:8787/api/state')
      .then(async upstream => {
        const data = await upstream.json();
        if (!upstream.ok) {
          sendJson(res, upstream.status || 500, data);
          return;
        }
        const nextRuntimeState = runtimeMoodStateService.syncRuntimeState({ bodyState: data, source: 'vio-body-poll' });
        sendJson(res, 200, {
          ...data,
          effective_light_output: nextRuntimeState.lightOutput,
          wrapper_runtime: nextRuntimeState,
        });
      })
      .catch(error => sendJson(res, 500, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/camera/capture' && req.method === 'POST') {
    runGesturePipeline()
      .then(result => sendJson(res, 200, { ...result, telemetry: getCameraTelemetry() }))
      .catch(error => sendJson(res, 500, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/camera/capture-step' && req.method === 'POST') {
    runCameraCapture()
      .then(result => sendJson(res, 200, { ok: true, capture: result, telemetry: getCameraTelemetry() }))
      .catch(error => sendJson(res, 500, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/camera/recognize-step' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => {
        const frameNames = Array.isArray(payload.frameNames) ? payload.frameNames.filter(name => typeof name === 'string') : [];
        return runGestureCycle(Math.max(3, frameNames.length || 3), frameNames)
          .then(({ gesture, action }) => sendJson(res, 200, { ok: true, gesture, action, telemetry: getCameraTelemetry() }));
      })
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  if (requestUrl.pathname === '/api/gesture/state' && req.method === 'GET') {
    sendJson(res, 200, getGestureRuntimeState());
    return;
  }

  if (requestUrl.pathname === '/api/gesture/watcher' && req.method === 'POST') {
    readJsonRequest(req)
      .then(payload => sendJson(res, 200, { ok: true, gestureRuntime: updateGestureWatcher(payload) }))
      .catch(error => sendJson(res, 400, { error: error?.message || String(error) }));
    return;
  }

  // Agent task routes (Claude task page API)
  if (requestUrl.pathname.startsWith('/api/agent-tasks')) {
    if (handleAgentTaskRoutes(requestUrl, req, res)) { return; }
  }

  // External replies inbox API
  if (requestUrl.pathname.startsWith('/api/external-replies')) {
    if (handleExternalRepliesRoutes(requestUrl, req, res)) { return; }
  }

  // Notification preferences API
  if (requestUrl.pathname === '/api/notification-prefs') {
    if (req.method === 'GET') {
      sendJson(res, 200, getNotificationPrefs());
      return;
    }
    if (req.method === 'POST' || req.method === 'PATCH') {
      readJsonRequest(req)
        .then(body => sendJson(res, 200, setNotificationPrefs(body)))
        .catch(err => sendJson(res, 400, { error: err?.message || String(err) }));
      return;
    }
  }

  if (requestUrl.pathname.startsWith('/vio_cam/')) {
    serveCameraAsset(requestUrl, res);
    return;
  }

  servePublicFile(requestUrl, res);
});

// Push Claude terminal state to all connected clients when output changes.
// Also sync real task lifecycle into agentTasks on each tick,
// stream output deltas into task logs, and broadcast task state changes.
let lastBroadcastClaudeOutput = null;
let lastBroadcastTaskSnapshot = null;
setInterval(() => {
  try {
    const state = getClaudeState();

    // Pipe new Claude output into the agentTask log layer
    if (state.output && state.output !== lastBroadcastClaudeOutput) {
      const prevLen = (lastBroadcastClaudeOutput || '').length;
      const delta = state.output.slice(prevLen);
      if (delta.length > 0) {
        // Feed meaningful output deltas (skip tiny whitespace-only changes)
        const trimmed = delta.trim();
        if (trimmed.length > 0) {
          onClaudeOutput(trimmed);
        }
      }
    }

    // Sync agentTasks with live Claude session state (detects exit -> handoff)
    syncRealTaskFromClaudeState(state);

    if (clients.size === 0) {
      // Still track output position even with no clients
      if (state.output !== lastBroadcastClaudeOutput) {
        lastBroadcastClaudeOutput = state.output;
      }
      return;
    }

    if (state.output !== lastBroadcastClaudeOutput) {
      lastBroadcastClaudeOutput = state.output;
      broadcast({ type: 'claude-state', ...state });
    }

    // Broadcast task state changes over WebSocket for real-time UI updates
    const task = getCurrentTask();
    const taskKey = task ? `${task.id}:${task.status}:${task.phase}:${task.updatedAt}` : null;
    if (taskKey !== lastBroadcastTaskSnapshot) {
      lastBroadcastTaskSnapshot = taskKey;
      broadcast({ type: 'agent-task', task: task || null });
    }
  } catch {}
}, 200);

const wss = new WebSocketServer({ server, path: '/ws' });
attachWsConnectionHandler({
  wss,
  broadcastHub,
  bridge,
  buildTokensPacket,
  getClaudeState,
  getCurrentTask,
  buildMoodPacket: runtimeMoodStateService.buildMoodPacket,
  lastRoutingRef: () => runtimeSessionState.getLastRouting(),
});

server.listen(wrapperPort, () => {
  console.log(`${APP_DISPLAY_NAME} running at http://127.0.0.1:${wrapperPort}`);
});
