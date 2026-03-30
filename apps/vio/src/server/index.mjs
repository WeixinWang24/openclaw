import http from 'node:http';
import { execFile } from 'node:child_process';
import { createLiveGatewayEventBridge } from './gateway/liveGatewayEventBridge.mjs';
import { createChatProjection } from './projection/chatProjection.mjs';
import { handleChatRoutes } from './routes/chatRoutes.mjs';
import { handleClaudeCodeRoutes } from './routes/claudeCodeRoutes.mjs';
import { handleDebugRoutes } from './routes/debugRoutes.mjs';
import { handleFileRoutes } from './routes/fileRoutes.mjs';
import { handleSessionRoutes } from './routes/sessionRoutes.mjs';
import { listProjectFiles, readProjectFile, safeProjectPath, writeProjectFile } from './filesystem.mjs';
import { createChatRuntime } from './runtime/chatRuntime.mjs';
import {
  getClaudeCodeState,
  sendClaudeCodeInput,
  startClaudeCodeSession,
  stopClaudeCodeSession,
} from './runtime/claudeCodeRuntime.mjs';
import { createGatewayRpcClient } from './runtime/gatewayRpcClient.mjs';
import { createKernelEventBus, KERNEL_CHANNELS } from './runtime/kernelEventBus.mjs';
import { createMessageDebugSink } from './runtime/messageDebugSink.mjs';
import { createRuntimeDiagnostics } from './runtime/runtimeDiagnostics.mjs';
import { createSessionRegistry } from './runtime/sessionRegistry.mjs';
import { createTranscriptService } from './runtime/transcriptService.mjs';
import { servePublicFile } from './static.mjs';

export function createVioServer({ gatewayCall, bridgeRequest = null, defaultSessionKey = null, stateRef = { connected: false }, root = new URL('../..', import.meta.url).pathname } = {}) {
  const diagnostics = createRuntimeDiagnostics();
  const messageDebugSink = createMessageDebugSink({ root });
  const eventBus = createKernelEventBus();
  const sessionRegistry = createSessionRegistry();
  const rpcClient = createGatewayRpcClient({
    gatewayCall,
    bridgeRequest,
    eventBus,
    diagnostics,
    stateRef,
  });
  const transcriptService = createTranscriptService({
    rpcClient,
    eventBus,
    diagnostics,
  });
  const chatRuntime = createChatRuntime({
    rpcClient,
    eventBus,
    sessionRegistry,
    diagnostics,
    defaultSessionKeyResolver: () => defaultSessionKey,
  });
  const chatProjection = createChatProjection({ eventBus });
  const eventBridge = createLiveGatewayEventBridge({
    onEvent: evt => {
      rpcClient.emitRawEvent(evt);
      chatRuntime.ingestRawEvent(evt);
    },
    onConnectError: error => diagnostics.recordError(error),
    onClose: (_code, reason) => diagnostics.recordConnection('closed', reason || null),
    onHelloOk: () => diagnostics.recordConnection('connected', 'live event bridge'),
  });

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');

    if (requestUrl.pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(': connected\n\n');
      const unsubscribe = eventBus.subscribe(KERNEL_CHANNELS.RUN, event => {
        try {
          res.write(`data: ${JSON.stringify({ channel: KERNEL_CHANNELS.RUN, event })}\n\n`);
        } catch {}
      });
      const heartbeat = setInterval(() => {
        try { res.write(': heartbeat\n\n'); } catch {}
      }, 15000);
      req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe?.();
        try { res.end(); } catch {}
      });
      return;
    }

    if (handleSessionRoutes({ req, res, requestUrl, rpcClient, sessionRegistry, defaultSessionKey, eventBridge })) {return;}
    if (handleChatRoutes({ req, res, requestUrl, chatRuntime, transcriptService, chatProjection })) {return;}
    if (handleClaudeCodeRoutes({
      req,
      res,
      requestUrl,
      getClaudeCodeState,
      startClaudeCodeSession,
      sendClaudeCodeInput,
      stopClaudeCodeSession,
    })) {return;}
    if (handleDebugRoutes({ req, res, requestUrl, messageDebugSink })) {return;}
    if (handleFileRoutes({
      req,
      res,
      requestUrl,
      listProjectFiles,
      readProjectFile,
      writeProjectFile,
      safeProjectPath,
      openPath: (targetDir, cb) => execFile('open', [targetDir], cb),
    })) {return;}
    servePublicFile(requestUrl, res);
  });

  return {
    status: 'ready',
    server,
    rpcClient,
    diagnostics,
    eventBus,
    sessionRegistry,
    transcriptService,
    chatRuntime,
    chatProjection,
    listen(port = 8792, host = '127.0.0.1', callback = null) {
      eventBridge.start();
      if (defaultSessionKey) {
        eventBridge.subscribeSession(defaultSessionKey).catch(error => diagnostics.recordError(error));
      }
      return server.listen(port, host, callback);
    },
    close(callback = null) {
      eventBridge.stop();
      return server.close(callback);
    },
  };
}
