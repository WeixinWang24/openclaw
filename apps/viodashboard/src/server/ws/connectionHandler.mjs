export function attachWsConnectionHandler({
  wss,
  broadcastHub,
  bridge,
  buildTokensPacket,
  getClaudeState,
  getCurrentTask,
  buildMoodPacket,
  lastRoutingRef,
}) {
  wss.on('connection', ws => {
    const detachClient = broadcastHub.attach(ws);

    ws.send(JSON.stringify({ type: 'status', connected: bridge.connected, sessionKey: bridge.sessionKey }));
    ws.send(JSON.stringify(buildTokensPacket()));
    try { ws.send(JSON.stringify({ type: 'claude-state', ...getClaudeState() })); } catch {}
    try { ws.send(JSON.stringify({ type: 'agent-task', task: getCurrentTask() || null })); } catch {}

    const lastRouting = lastRoutingRef();
    ws.send(JSON.stringify(buildMoodPacket(lastRouting.mode, {
      state: null,
      detail: lastRouting.detail,
      preview: lastRouting.preview,
      phase: lastRouting.phase,
      runId: lastRouting.runId,
    })));

    ws.on('message', async raw => {
      let msg;
      const rawStr = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString('utf8') : JSON.stringify(raw);
      try { msg = JSON.parse(rawStr); } catch { return; }
      if (msg.type === 'send') {
        try {
          console.log('[wrapper] ui send received', JSON.stringify({ textLength: String(msg.text ?? '').length, preview: String(msg.text ?? '').slice(0, 120) }));
          const runId = await bridge.sendChat(String(msg.text ?? ''));
          console.log('[wrapper] ui send accepted', runId);
          ws.send(JSON.stringify({ type: 'ack', runId }));
        } catch (error) {
          console.log('[wrapper] ui send failed', error?.message ?? String(error));
          ws.send(JSON.stringify({ type: 'error', error: error?.message ?? String(error) }));
        }
      }
    });

    ws.on('close', () => detachClient());
  });
}
