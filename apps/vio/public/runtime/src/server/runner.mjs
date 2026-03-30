#!/usr/bin/env node
import { createVioServer } from './index.mjs';
import { callLiveGateway } from './gateway/liveGatewayClient.mjs';

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

async function gatewayCall(method, params = {}, options = {}) {
  return await callLiveGateway(method, params, options);
}

export async function startVioRunner({
  port = envNumber('VIO_PORT', 8792),
  host = process.env.VIO_HOST || '127.0.0.1',
  defaultSessionKey = process.env.VIO_SESSION_KEY || null,
  bridgeRequest = null,
  gatewayCallImpl = gatewayCall,
  stateRef = { connected: false },
} = {}) {
  const app = createVioServer({
    gatewayCall: gatewayCallImpl,
    bridgeRequest,
    defaultSessionKey,
    stateRef,
  });

  await new Promise(resolve => app.listen(port, host, resolve));
  const address = app.server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  console.log(`Vio Phase 1 runner listening at http://${host}:${boundPort}`);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startVioRunner().catch(error => {
    console.error(`Vio runner failed: ${error?.message || error}`);
    process.exit(1);
  });
}
