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

export function createLiveGatewayEventBridge({ onEvent, onHelloOk, onConnectError, onClose } = {}) {
  let client = null;
  let subscribedSessionKeys = new Set();
  let started = false;
  let ready = false;

  function ensureClient() {
    if (client) {return client;}
    const { url, token } = createGatewayConnectionInfo();
    client = new GatewayClient({
      url,
      token,
      scopes: ['operator.read', 'operator.write'],
      clientName: 'cli',
      clientVersion: 'dev',
      mode: 'probe',
      instanceId: randomUUID(),
      onEvent: evt => onEvent?.(evt),
      onHelloOk: async hello => {
        ready = true;
        onHelloOk?.(hello);
        for (const key of subscribedSessionKeys) {
          try {
            await client.request('sessions.messages.subscribe', { key });
          } catch (error) {
            onConnectError?.(error);
          }
        }
      },
      onConnectError: err => onConnectError?.(err),
      onClose: (code, reason) => {
        ready = false;
        onClose?.(code, reason);
      },
    });
    return client;
  }

  async function subscribeSession(sessionKey) {
    if (!sessionKey) {return false;}
    subscribedSessionKeys.add(sessionKey);
    ensureClient();
    if (!started || !ready) {return true;}
    await client.request('sessions.messages.subscribe', { key: sessionKey });
    return true;
  }

  function start() {
    const activeClient = ensureClient();
    if (started) {return activeClient;}
    started = true;
    activeClient.start();
    return activeClient;
  }

  function stop() {
    started = false;
    ready = false;
    try { client?.stop(); } catch {}
  }

  return {
    start,
    stop,
    subscribeSession,
    getSubscribedSessionKeys() {
      return [...subscribedSessionKeys];
    },
  };
}
