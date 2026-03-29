#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { GatewayClient } from '../../../../../dist/plugin-sdk/gateway-runtime.js';

const config = JSON.parse(fs.readFileSync(`${process.env.HOME}/.openclaw/openclaw.json`, 'utf8'));
const gatewayUrl = `ws://127.0.0.1:${config?.gateway?.port || 19001}`;
const gatewayToken = config?.gateway?.auth?.token || null;

function makeClient({ onHelloOk, onConnectError, onClose }) {
  return new GatewayClient({
    url: gatewayUrl,
    token: gatewayToken,
    scopes: ['operator.read'],
    clientName: 'cli',
    clientVersion: 'dev',
    mode: 'probe',
    instanceId: randomUUID(),
    onHelloOk,
    onConnectError,
    onClose,
  });
}

const result = await new Promise(resolve => {
  let settled = false;
  let timer = null;
  let client = null;

  const finish = payload => {
    if (settled) {return;}
    settled = true;
    if (timer) {clearTimeout(timer);}
    try { client?.stop(); } catch {}
    resolve(payload);
  };

  client = makeClient({
    onConnectError: err => finish({ ok: false, phase: 'connect', message: err?.message || String(err) }),
    onClose: (_code, reason) => {
      if (!settled) {
        finish({ ok: false, phase: 'close', message: reason || 'closed before hello' });
      }
    },
    onHelloOk: async () => {
      try {
        const list = await client.request('sessions.list', { limit: 5 });
        finish({
          ok: true,
          count: Array.isArray(list?.items) ? list.items.length : null,
          keys: Array.isArray(list?.items) ? list.items.slice(0, 5).map(item => item?.key || null) : null,
        });
      } catch (error) {
        finish({ ok: false, phase: 'request', message: error?.message || String(error) });
      }
    },
  });

  timer = setTimeout(() => finish({ ok: false, phase: 'timeout', message: 'timeout waiting for hello' }), 10000);
  client.start();
});

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {process.exit(1);}
