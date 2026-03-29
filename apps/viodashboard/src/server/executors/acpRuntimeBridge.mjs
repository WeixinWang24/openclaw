import { setCurrentTask, appendLog } from '../agentTasks/store.mjs';
import { gatewayCall, GatewayBridge } from '../gatewayBridge.mjs';
import { randomId } from '../utils.mjs';

function buildAcpHandle(spec = {}) {
  const now = new Date();
  const stamp = now.toISOString();
  const taskId = `acp-${now.getTime().toString(36)}`;
  return {
    taskId,
    executor: 'acp-task',
    agent: spec.agent || 'unknown',
    sessionKey: spec.sessionKey || null,
    threadKey: spec.threadKey || null,
    cwd: spec.cwd || null,
    createdAt: stamp,
    mode: 'stub-dispatch',
    runtime: {
      source: 'acp-runtime-bridge',
      connected: false,
      dispatched: false,
    },
  };
}

async function fetchAcpHistoryBaseline(sessionKey) {
  if (!sessionKey) {return null;}
  try {
    const bridge = new GatewayBridge();
    bridge.connected = true;
    const history = await bridge.fetchSessionHistory(sessionKey, { limit: 20 });
    const messages = Array.isArray(history) ? history : [];
    const lastAssistant = [...messages].reverse().find(message => message?.role === 'assistant' && String(message?.text || '').trim()) || null;
    const lastSummary = String(lastAssistant?.text || '').trim().slice(0, 240);
    return {
      historyCount: messages.length,
      assistantFingerprint: lastAssistant
        ? `${lastAssistant?.id || 'no-id'}::${lastAssistant?.createdAt || 'no-ts'}::${lastSummary}`
        : null,
      assistantId: lastAssistant?.id || null,
      assistantCreatedAt: lastAssistant?.createdAt || null,
      assistantSummary: lastSummary || null,
      capturedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function buildAcpTaskSnapshot(handle, spec = {}, runtimePatch = {}) {
  return setCurrentTask({
    id: handle.taskId,
    title: String(spec.text || '').slice(0, 120),
    owner: 'vio',
    executor: 'acp',
    status: runtimePatch.dispatched ? 'running' : 'queued',
    phase: runtimePatch.dispatched ? 'running' : 'dispatch',
    cwd: spec.cwd || null,
    promptSummary: spec.text,
    runtime: {
      sessionId: handle.sessionKey || handle.taskId,
      source: 'acp-runtime-bridge',
      agent: handle.agent,
      threadKey: handle.threadKey,
      connected: false,
      dispatched: false,
      createdAt: handle.createdAt,
      ...runtimePatch,
    },
  });
}

export async function dispatchAcpStubTask(spec = {}) {
  const text = typeof spec?.text === 'string' ? spec.text.trim() : '';
  if (!text) {
    const error = new Error('text is required');
    error.code = 'INVALID_DISPATCH_PAYLOAD';
    error.statusCode = 400;
    throw error;
  }

  const handle = buildAcpHandle(spec);
  const historyBaseline = handle.sessionKey ? await fetchAcpHistoryBaseline(handle.sessionKey) : null;

  if (handle.sessionKey) {
    try {
      const sendResult = await gatewayCall('chat.send', {
        sessionKey: handle.sessionKey,
        message: text,
        deliver: false,
        idempotencyKey: randomId(),
      }, { timeoutMs: 15000 });

      const task = buildAcpTaskSnapshot(handle, spec, {
        connected: true,
        dispatched: true,
        lastDispatchAt: new Date().toISOString(),
        gatewayRunId: sendResult?.runId || null,
        historyBaseline,
      });

      appendLog({
        level: 'info',
        text: `ACP dispatch accepted: agent=${handle.agent} session=${handle.sessionKey} thread=${handle.threadKey || 'none'} run=${sendResult?.runId || 'none'}`,
      });

      return {
        ok: true,
        executor: 'acp-task',
        task: task
          ? {
              ...task,
              executorId: 'acp-task',
              orchestrationMode: 'task',
              dispatchMode: 'gateway-send',
            }
          : null,
        handle: {
          ...handle,
          mode: 'gateway-send',
          runtime: {
            ...handle.runtime,
            connected: true,
            dispatched: true,
            gatewayRunId: sendResult?.runId || null,
          },
        },
        runtimeBinding: {
          source: 'acp-runtime-bridge',
          sessionKey: handle.sessionKey,
          threadKey: handle.threadKey,
          agent: handle.agent,
          connected: true,
          dispatched: true,
          gatewayRunId: sendResult?.runId || null,
        },
        warnings: [],
      };
    } catch (error) {
      const failureMessage = error?.message || String(error);
      appendLog({
        level: 'warn',
        text: `ACP gateway dispatch failed for session=${handle.sessionKey}: ${failureMessage}`,
      });

      const task = buildAcpTaskSnapshot(handle, spec, {
        lastDispatchAt: new Date().toISOString(),
        lastError: failureMessage,
        historyBaseline,
      });

      return {
        ok: true,
        executor: 'acp-task',
        task: task
          ? {
              ...task,
              executorId: 'acp-task',
              orchestrationMode: 'task',
              dispatchMode: 'stub',
            }
          : null,
        handle: {
          ...handle,
          runtime: {
            ...handle.runtime,
            lastError: failureMessage,
          },
        },
        runtimeBinding: {
          source: 'acp-runtime-bridge',
          sessionKey: handle.sessionKey,
          threadKey: handle.threadKey,
          agent: handle.agent,
          connected: false,
          dispatched: false,
          lastError: failureMessage,
        },
        warnings: [
          'ACP runtime bridge fell back to stub mode; no real ACP execution has been confirmed yet.',
        ],
        diagnostic: {
          attemptedMode: 'gateway-send',
          fallbackMode: 'stub',
          error: failureMessage,
        },
      };
    }
  }

  const task = buildAcpTaskSnapshot(handle, spec, {
    historyBaseline,
  });

  appendLog({
    level: 'info',
    text: `ACP stub dispatch created: agent=${handle.agent} session=${handle.sessionKey || 'none'} thread=${handle.threadKey || 'none'}`,
  });

  return {
    ok: true,
    executor: 'acp-task',
    task: task
      ? {
          ...task,
          executorId: 'acp-task',
          orchestrationMode: 'task',
          dispatchMode: 'stub',
        }
      : null,
    handle,
    runtimeBinding: {
      source: 'acp-runtime-bridge',
      sessionKey: handle.sessionKey,
      threadKey: handle.threadKey,
      agent: handle.agent,
      connected: false,
      dispatched: false,
    },
    warnings: [
      'ACP runtime bridge fell back to stub mode; no real ACP execution has been confirmed yet.',
    ],
  };
}
