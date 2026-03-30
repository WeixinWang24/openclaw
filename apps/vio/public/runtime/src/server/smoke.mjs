#!/usr/bin/env node
import { createVioServer } from './index.mjs';

const historyBySession = new Map([
  ['vio:mock:main', [
    { id: 'u1', role: 'user', text: 'Hello from smoke.' },
    { id: 'a1', role: 'assistant', text: 'Smoke harness ready.' },
  ]],
]);

async function gatewayCall(method, params = {}) {
  if (method === 'sessions.list') {
    return {
      items: [
        { key: 'vio:mock:main', label: 'mock main', kind: 'session' },
      ],
    };
  }

  if (method === 'sessions.get') {
    const key = String(params?.key || '');
    return {
      key,
      messages: historyBySession.get(key) || [],
    };
  }

  if (method === 'chat.send') {
    const key = String(params?.sessionKey || '');
    const message = String(params?.message || '');
    const current = historyBySession.get(key) || [];
    current.push({ id: `u-${Date.now()}`, role: 'user', text: message });
    current.push({ id: `a-${Date.now()}`, role: 'assistant', text: 'Gateway stub accepted message.' });
    historyBySession.set(key, current);
    return { ok: true, runId: String(params?.idempotencyKey || `run-${Date.now()}`) };
  }

  throw new Error(`unsupported gateway method: ${method}`);
}

function assert(condition, message) {
  if (!condition) {throw new Error(message);}
}

async function fetchJson(baseUrl, path, options = undefined) {
  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { res, text, json };
}

async function main() {
  const app = createVioServer({
    gatewayCall,
    defaultSessionKey: 'vio:mock:main',
  });

  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;

  try {
    const sessions = await fetchJson(baseUrl, '/api/sessions');
    assert(sessions.res.ok, `/api/sessions expected 200, got ${sessions.res.status}`);
    assert(Array.isArray(sessions.json?.items), 'sessions items missing');
    passed += 1;

    const history = await fetchJson(baseUrl, '/api/sessions/vio%3Amock%3Amain/history?limit=20');
    assert(history.res.ok, `/history expected 200, got ${history.res.status}`);
    assert(Array.isArray(history.json?.messages), 'history messages missing');
    assert(history.json.messages.length >= 2, 'history too short');
    passed += 1;

    const send = await fetchJson(baseUrl, '/api/sessions/vio%3Amock%3Amain/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Smoke send' }),
    });
    assert(send.res.ok, `/send expected 200, got ${send.res.status}`);
    assert(typeof send.json?.runId === 'string' && send.json.runId.length > 0, 'runId missing');
    passed += 1;

    const historyAfterSend = await fetchJson(baseUrl, '/api/sessions/vio%3Amock%3Amain/history?limit=20&refresh=true');
    assert(historyAfterSend.res.ok, `/history refresh expected 200, got ${historyAfterSend.res.status}`);
    assert(historyAfterSend.json?.messages?.some(message => message.text === 'Smoke send'), 'sent user message not found in refreshed history');
    passed += 1;

    const index = await fetch(`${baseUrl}/`);
    const html = await index.text();
    assert(index.ok, `/ expected 200, got ${index.status}`);
    assert(/Vio/i.test(html), 'index page content missing Vio');
    passed += 1;

    console.log(`Vio Phase 1 smoke passed (${passed}/5)`);
  } finally {
    await new Promise(resolve => app.close(resolve));
  }
}

main().catch(error => {
  console.error(`Vio Phase 1 smoke failed: ${error?.message || error}`);
  process.exit(1);
});
