import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { GatewayClient } from '../../../../../dist/plugin-sdk/gateway-runtime.js';

function loadLocalGatewayConfig() {
  const configPath = `${process.env.HOME}/.openclaw/openclaw.json`;
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function createGatewayConnectionInfo() {
  const config = loadLocalGatewayConfig();
  return {
    url: `ws://127.0.0.1:${config?.gateway?.port || 19001}`,
    token: config?.gateway?.auth?.token || null,
  };
}

function createClient({ onHelloOk, onConnectError, onClose }) {
  const { url, token } = createGatewayConnectionInfo();
  return new GatewayClient({
    url,
    token,
    scopes: ['operator.read', 'operator.write'],
    clientName: 'cli',
    clientVersion: 'dev',
    mode: 'probe',
    instanceId: randomUUID(),
    onHelloOk,
    onConnectError,
    onClose,
  });
}

export async function callLiveGateway(method, params = {}, { timeoutMs = 10000 } = {}) {
  return await new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    let client = null;

    const cleanup = () => {
      if (timer) {clearTimeout(timer);}
      try { client?.stop(); } catch {}
    };

    const finishResolve = value => {
      if (settled) {return;}
      settled = true;
      cleanup();
      resolve(value);
    };

    const finishReject = error => {
      if (settled) {return;}
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    client = createClient({
      onConnectError: err => finishReject(new Error(err?.message || String(err))),
      onClose: (_code, reason) => {
        if (!settled) {
          finishReject(new Error(reason || 'gateway connection closed before response'));
        }
      },
      onHelloOk: async () => {
        try {
          const result = await client.request(method, params);
          finishResolve(result);
        } catch (error) {
          finishReject(error);
        }
      },
    });

    timer = setTimeout(() => finishReject(new Error(`gateway request timeout after ${timeoutMs}ms`)), timeoutMs);
    client.start();
  });
}
