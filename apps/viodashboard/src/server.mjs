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
import { execFile, execFileSync } from 'node:child_process';
import { APP_DISPLAY_NAME, CLIENT_CONFIG, DATA_DIR, GATEWAY_PROFILE, LAUNCHD_LABEL, OPENCLAW_BIN, OPENCLAW_DIST_BUILD_INFO, OPENCLAW_REPO_ROOT, PNPM_BIN, ROADMAP_DATA_PATH, ROADMAP_HISTORY_DATA_PATH, ROOT, wrapperPort } from './config.mjs';
import { onAssistantFinal, onAssistantError } from './moodBridge.mjs';
import { sendJson } from './server/httpUtils.mjs';
import { listProjectFiles, readProjectFile, writeProjectFile, safeProjectPath } from './server/filesystem.mjs';
import { getSafeEditState, performStartupRecovery, runSafeEditSmokeSummary } from './server/safeEdit.mjs';
import { serveCameraAsset, servePublicFile } from './server/static.mjs';
import { GatewayBridge, gatewayCall, warmGatewayCaller } from './server/gatewayBridge.mjs';
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
import { handleRoadmapRoutes } from './server/routes/roadmapRoutes.mjs';
import { handleSetupRoutes } from './server/routes/setupRoutes.mjs';
import { handleDistRoutes } from './server/routes/distRoutes.mjs';
import { handleSafeEditRoutes } from './server/routes/safeEditRoutes.mjs';
import { handleTokenSaverRoutes } from './server/routes/tokenSaverRoutes.mjs';
import { handleClaudeRoutes } from './server/routes/claudeRoutes.mjs';
import { handleTerminalRoutes } from './server/routes/terminalRoutes.mjs';
import { handleCameraGestureRoutes } from './server/routes/cameraGestureRoutes.mjs';
import { handleFileRoutes } from './server/routes/fileRoutes.mjs';
import { handleRuntimeControlRoutes } from './server/routes/runtimeControlRoutes.mjs';
import { handleTaskRoutes } from './server/routes/taskRoutes.mjs';
import { handleMemoryRoutes } from './server/routes/memoryRoutes.mjs';
import { handleNotificationRoutes } from './server/routes/notificationRoutes.mjs';
import { createBroadcastHub } from './server/ws/broadcastHub.mjs';
import { startServerRuntime } from './server/runtime/serverBootstrap.mjs';
import { getClaudeState, resizeClaudeSession, restartClaudeSession, sendClaudeInput, startClaudeSession, stopClaudeSession } from './server/claudeTerminal.mjs';
import { getOrCreateTerminalSession, getTerminalSession } from './server/terminalSessions.mjs';
import { evaluateSetupState } from './server/setupState.mjs';
import { handleSetupAction } from './server/setupActions.mjs';
import { getGuidelinesDir, listGuidelines } from './server/memorySystem.mjs';
import { handleAgentTaskRoutes } from './server/routes/agentTasks.mjs';
import { handleExternalRepliesRoutes } from './server/routes/externalReplies.mjs';
import { notifyAssistantFinal, getNotificationPrefs, setNotificationPrefs } from './server/notifications.mjs';
import { createChatEventCoordinator } from './server/runtime/chatEventCoordinator.mjs';
import { createRuntimeSessionState } from './server/runtime/runtimeSessionState.mjs';
import { createTokenUsageService } from './server/runtime/tokenUsageService.mjs';
import { createFinalReplyService } from './server/runtime/finalReplyService.mjs';
import { createRunLifecycleService } from './server/runtime/runLifecycleService.mjs';
import { createRoadmapStateService } from './server/runtime/roadmapStateService.mjs';
import { createRuntimeMoodStateService } from './server/runtime/runtimeMoodStateService.mjs';

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

  if (handleRoadmapRoutes({
    req,
    res,
    requestUrl,
    roadmapStateService,
    broadcast,
  })) {
    return;
  }

  if (handleSetupRoutes({
    req,
    res,
    requestUrl,
    bridgeConnected: bridge.connected,
    getClaudeState,
    evaluateSetupState,
    handleSetupAction,
    restartService: () => {
      execFile('launchctl', ['kickstart', '-k', `gui/${process.getuid()}/${LAUNCHD_LABEL}`], { cwd: ROOT }, () => {});
    },
  })) {
    return;
  }

  if (handleDistRoutes({
    req,
    res,
    requestUrl,
    loadDistBuildInfo,
    rebuildDist: () => {
      execFile(PNPM_BIN, ['build'], { cwd: OPENCLAW_REPO_ROOT, env: process.env }, () => {});
    },
  })) {
    return;
  }

  if (handleSafeEditRoutes({
    req,
    res,
    requestUrl,
    getSafeEditState,
    startupRecovery,
    runSafeEditSmokeSummary,
  })) {
    return;
  }

  if (handleTokenSaverRoutes({
    req,
    res,
    requestUrl,
    bridge,
    broadcast,
  })) {
    return;
  }

  if (handleTaskRoutes({
    req,
    res,
    requestUrl,
    bridge,
    broadcast,
  })) {
    return;
  }

  if (handleFileRoutes({
    req,
    res,
    requestUrl,
    listProjectFiles,
    readProjectFile,
    writeProjectFile,
    safeProjectPath,
    openPath: (targetDir, cb) => execFile('open', [targetDir], cb),
  })) {
    return;
  }

  if (handleRuntimeControlRoutes({
    req,
    res,
    requestUrl,
    root: ROOT,
    launchdLabel: LAUNCHD_LABEL,
    bridge,
    broadcast,
    broadcastHub,
    restartWrapper: ({ mode }) => {
      if (mode) {
        const script = path.join(ROOT, 'launchd', 'set-mode.sh');
        execFile('/bin/bash', [script, mode], { cwd: ROOT }, () => {});
        return;
      }
      execFile('launchctl', ['kickstart', '-k', `gui/${process.getuid()}/${LAUNCHD_LABEL}`], { cwd: ROOT }, () => {});
    },
    restartGateway: () => {
      execFile(OPENCLAW_BIN, ['--profile', GATEWAY_PROFILE, 'gateway', 'restart'], { cwd: ROOT, env: process.env }, () => {});
    },
  })) {
    return;
  }

  if (handleMemoryRoutes({
    req,
    res,
    requestUrl,
    listGuidelines,
    getGuidelinesDir,
  })) {
    return;
  }

  if (handleClaudeRoutes({
    req,
    res,
    requestUrl,
    getClaudeState,
    startClaudeSession,
    sendClaudeInput,
    stopClaudeSession,
    restartClaudeSession,
    resizeClaudeSession,
  })) {
    return;
  }

  if (handleTerminalRoutes({
    req,
    res,
    requestUrl,
    getOrCreateTerminalSession,
    getTerminalSession,
    ingestToolResult: (...args) => bridge.ingestToolResult(...args),
  })) {
    return;
  }

  if (handleCameraGestureRoutes({
    req,
    res,
    requestUrl,
  })) {
    return;
  }

  // Agent task routes (Claude task page API)
  if (handleAgentTaskRoutes({
    requestUrl,
    req,
    res,
  })) {
    return;
  }

  // External replies inbox API
  if (handleExternalRepliesRoutes({
    requestUrl,
    req,
    res,
  })) {
    return;
  }

  // Notification preferences API
  if (handleNotificationRoutes({
    req,
    res,
    requestUrl,
    getNotificationPrefs,
    setNotificationPrefs,
  })) {
    return;
  }

  if (requestUrl.pathname.startsWith('/vio_cam/')) {
    serveCameraAsset(requestUrl, res);
    return;
  }

  servePublicFile(requestUrl, res);
});

// --- Runtime bootstrap ----------------------------------------------------
startServerRuntime({
  server,
  wrapperPort,
  appDisplayName: APP_DISPLAY_NAME,
  broadcastHub,
  bridge,
  buildTokensPacket,
  getClaudeState,
  buildMoodPacket: runtimeMoodStateService.buildMoodPacket,
  lastRoutingRef: () => runtimeSessionState.getLastRouting(),
  broadcast,
});
