import http from 'node:http';
import { createLiveGatewayEventBridge } from './gateway/liveGatewayEventBridge.mjs';
import { createChatProjection } from './projection/chatProjection.mjs';
import { handleChatRoutes } from './routes/chatRoutes.mjs';
import { handleSessionRoutes } from './routes/sessionRoutes.mjs';
import { createChatRuntime } from './runtime/chatRuntime.mjs';
import { createGatewayRpcClient } from './runtime/gatewayRpcClient.mjs';
import { createKernelEventBus } from './runtime/kernelEventBus.mjs';
import { createRuntimeDiagnostics } from './runtime/runtimeDiagnostics.mjs';
import { createSessionRegistry } from './runtime/sessionRegistry.mjs';
import { createTranscriptService } from './runtime/transcriptService.mjs';
import { servePublicFile } from './static.mjs';

export function createVioServer({ gatewayCall, bridgeRequest = null, defaultSessionKey = null, stateRef = { connected: false } } = {}) {
  const diagnostics = createRuntimeDiagnostics();
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

    if (handleSessionRoutes({ req, res, requestUrl, rpcClient, sessionRegistry, defaultSessionKey, eventBridge })) {return;}
    if (handleChatRoutes({ req, res, requestUrl, chatRuntime, transcriptService, chatProjection })) {return;}
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
