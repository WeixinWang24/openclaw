import { WebSocketServer } from 'ws';
import { attachWsConnectionHandler } from '../ws/connectionHandler.mjs';
import { onClaudeOutput, syncRealTaskFromClaudeState, getCurrentTask } from '../agentTasks/index.mjs';

export function startServerRuntime({
  server,
  wrapperPort,
  appDisplayName,
  broadcastHub,
  bridge,
  buildTokensPacket,
  getClaudeState,
  buildMoodPacket,
  lastRoutingRef,
  broadcast,
}) {
  let lastBroadcastClaudeOutput = null;
  let lastBroadcastTaskSnapshot = null;

  setInterval(() => {
    try {
      const state = getClaudeState();

      if (state.output && state.output !== lastBroadcastClaudeOutput) {
        const prevLen = (lastBroadcastClaudeOutput || '').length;
        const delta = state.output.slice(prevLen);
        if (delta.length > 0) {
          const trimmed = delta.trim();
          if (trimmed.length > 0) {
            onClaudeOutput(trimmed);
          }
        }
      }

      syncRealTaskFromClaudeState(state);

      if ((broadcastHub?.getClientCount?.() || 0) === 0) {
        if (state.output !== lastBroadcastClaudeOutput) {
          lastBroadcastClaudeOutput = state.output;
        }
        return;
      }

      if (state.output !== lastBroadcastClaudeOutput) {
        lastBroadcastClaudeOutput = state.output;
        broadcast({ type: 'claude-state', ...state });
      }

      const task = getCurrentTask();
      const taskKey = task ? `${task.id}:${task.status}:${task.phase}:${task.updatedAt}` : null;
      if (taskKey !== lastBroadcastTaskSnapshot) {
        lastBroadcastTaskSnapshot = taskKey;
        broadcast({ type: 'agent-task', task: task || null });
      }
    } catch {}
  }, 200);

  // WebSocket bootstrap stays thin: connection-specific behavior lives in ws/connectionHandler.mjs.
  const wss = new WebSocketServer({ server, path: '/ws' });
  attachWsConnectionHandler({
    wss,
    broadcastHub,
    bridge,
    buildTokensPacket,
    getClaudeState,
    getCurrentTask,
    buildMoodPacket,
    lastRoutingRef,
  });

  // Bind the shared HTTP server only after runtime sidecars are attached.
  server.listen(wrapperPort, () => {
    console.log(`${appDisplayName} running at http://127.0.0.1:${wrapperPort}`);
  });

  return { wss };
}
