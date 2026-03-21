// Runtime bridge: connects the agent task store to real runtime signals.
// Registers real Claude background runs as agentTasks, syncs runtime identity,
// and drives the completion handoff state machine on process exit.

import { setCurrentTask, getCurrentTask, updateCurrentTask, advancePhase, appendLog, markFinishedByClaude } from './store.mjs';
import { emitMilestone, emitTouchedFiles, emitValidation, emitCompletionHandoff, emitError } from './events.mjs';
import { notifyClaude, notifyTaskFinished } from '../notifications.mjs';

let lastAttentionFingerprint = null;

/**
 * Register a real Claude background run as the current agent task.
 * Called from claudeTerminal when a new session is started.
 * @param {object} sessionInfo - Claude session metadata
 * @param {string} sessionInfo.sessionId
 * @param {number|null} sessionInfo.bridgePid
 * @param {string} sessionInfo.cwd
 * @param {string} sessionInfo.cwdAbs
 * @param {string} sessionInfo.claudeCommand
 * @param {string} sessionInfo.startedAt
 * @param {string} [sessionInfo.promptText] - optional prompt/instruction text
 */
export function registerRealTask(sessionInfo) {
  lastAttentionFingerprint = null;
  // If there's already a running real task for the same session, just update runtime
  const existing = getCurrentTask();
  if (existing && existing.status === 'running' && existing.runtime?.sessionId === sessionInfo.sessionId) {
    updateCurrentTask({
      runtime: buildRuntimeMeta(sessionInfo),
    });
    appendLog({ level: 'info', text: `Runtime refreshed for session ${sessionInfo.sessionId}` });
    return existing;
  }

  const now = new Date().toISOString();
  const task = setCurrentTask({
    title: sessionInfo.promptText
      ? sessionInfo.promptText.slice(0, 120)
      : `Claude task (${sessionInfo.sessionId})`,
    owner: 'vio',
    executor: 'claude',
    status: 'running',
    phase: 'coding',
    cwd: sessionInfo.cwd || null,
    promptSummary: sessionInfo.promptText || null,
    startedAt: sessionInfo.startedAt || now,
    runtime: buildRuntimeMeta(sessionInfo),
  });

  advancePhase('coding', 'Claude session started');
  appendLog({ level: 'info', text: `Real task registered: session=${sessionInfo.sessionId} pid=${sessionInfo.bridgePid}` });

  return task;
}

/**
 * Sync real task state from the live Claude session.
 * Called periodically from the server polling loop.
 * Detects exit/completion and drives the handoff state machine.
 * @param {object} claudeState - from getClaudeState()
 */
export function syncRealTaskFromClaudeState(claudeState) {
  const task = getCurrentTask();
  if (!task || !task.runtime?.sessionId) { return; }
  // Only sync if the task belongs to this Claude session
  if (task.runtime.sessionId !== claudeState.sessionId) { return; }

  // Update runtime liveness
  updateCurrentTask({
    runtime: {
      ...task.runtime,
      bridgeAlive: claudeState.running,
      lastSyncAt: new Date().toISOString(),
    },
  });

  // Long-lived Claude TUI sessions may complete while the process stays alive.
  // Use the full terminal snapshot, not only the latest delta, to detect completion.
  if (task.status === 'running' && !task.completionEventSeen) {
    const screen = normalizeTerminalText(claudeState.output || '');
    const protocolState = parseClaudeProtocolState(screen);

    if (protocolState.kind === 'complete') {
      lastAttentionFingerprint = null;
      updateCurrentTask({
        status: 'completed',
        phase: 'done',
        needsInput: false,
        needsInputKind: null,
        needsInputSummary: null,
        finalSummary: protocolState.summary,
        touchedFiles: protocolState.files || [],
        tests: protocolState.tests || null,
        commit: protocolState.commit || null,
        protocolState: 'completed',
        protocolSource: protocolState.protocolSource,
        latestMeaningfulUpdate: protocolState.summary,
      });
      appendLog({ level: 'info', text: `Claude completed via structured protocol: ${protocolState.summary}` });
      emitMilestone(protocolState.summary);
      notifyTaskFinished({
        title: 'Claude task finished',
        message: protocolState.summary,
      });
      return;
    }

    if (protocolState.kind === 'input_needed') {
      const fingerprint = `${task.id}::structured::${protocolState.summary}`;
      if (fingerprint !== lastAttentionFingerprint) {
        lastAttentionFingerprint = fingerprint;
        appendLog({ level: 'info', text: `Claude requested input via structured protocol: ${protocolState.summary}` });
        notifyClaude({
          title: 'Claude needs your input',
          message: protocolState.summary,
        });
      }
      updateCurrentTask({
        needsInput: true,
        needsInputKind: 'structured',
        needsInputSummary: protocolState.summary,
        protocolState: 'input_needed',
        protocolSource: protocolState.protocolSource,
        phase: 'waiting',
        latestMeaningfulUpdate: protocolState.summary,
      });
      return;
    }

    const attention = detectAttention(screen);
    if (attention) {
      const fingerprint = `${task.id}::${attention.kind}::${attention.summary}`;
      if (fingerprint !== lastAttentionFingerprint) {
        lastAttentionFingerprint = fingerprint;
        appendLog({ level: 'info', text: `Claude needs user input [${attention.kind}]: ${attention.summary}` });
        notifyClaude({
          title: attention.title || 'Claude needs your input',
          message: attention.summary,
        });
      }
      updateCurrentTask({
        needsInput: true,
        needsInputKind: attention.kind,
        needsInputSummary: attention.summary,
        protocolState: 'input_needed',
        protocolSource: 'attention',
        phase: 'waiting',
      });
    } else if (task.needsInput) {
      updateCurrentTask({
        needsInput: false,
        needsInputKind: null,
        needsInputSummary: null,
        protocolState: 'running',
        protocolSource: null,
        phase: 'coding',
      });
      lastAttentionFingerprint = null;
    }

    const dispatchBaseline = Number.isFinite(task.runtime?.screenLengthAtDispatch)
      ? task.runtime.screenLengthAtDispatch
      : 0;
    const outputDelta = Math.max(0, screen.length - dispatchBaseline);
    const hasNewOutputSinceDispatch = outputDelta > 24;

    const looksDone = hasNewOutputSinceDispatch && (
      screen.includes('⏺ Done.') ||
      screen.includes('The file already exists with the correct content') ||
      screen.includes('Nothing to do.') ||
      screen.includes('Task completed') ||
      screen.includes('completed successfully')
    );
    const promptReturned = hasNewOutputSinceDispatch && screen.includes('❯') && !screen.includes('esc to interrupt') && !attention;
    if (looksDone || promptReturned) {
      lastAttentionFingerprint = null;
      const reason = looksDone ? 'Claude completed via terminal snapshot' : 'Claude returned to prompt';
      appendLog({ level: 'info', text: looksDone ? 'Claude completion detected from terminal snapshot' : 'Claude prompt returned; marking handoff' });
      updateCurrentTask({ protocolState: 'completed', protocolSource: 'heuristic', finalSummary: task.finalSummary || reason });
      markFinishedByClaude(reason);
      notifyTaskFinished({
        title: 'Claude task finished',
        message: reason,
      });
      return;
    }
  }

  // If task is still running but Claude has exited, trigger completion handoff
  if (task.status === 'running' && !claudeState.running && claudeState.exited) {
    lastAttentionFingerprint = null;
    const exitCode = claudeState.exitCode;
    if (exitCode === 0 || exitCode === null) {
      const exitMsg = `Claude finished (exit code ${exitCode ?? 'unknown'})`;
      appendLog({ level: 'info', text: `Claude process exited (code=${exitCode}), triggering completion handoff` });
      markFinishedByClaude(exitMsg);
      notifyTaskFinished({ title: 'Claude task finished', message: exitMsg });
    } else {
      appendLog({ level: 'warn', text: `Claude process exited with error code ${exitCode}` });
      updateCurrentTask({ status: 'failed' });
      advancePhase('done', `Claude exited with error (code=${exitCode})`);
      emitError(`Claude process failed (exit code ${exitCode})`, { exitCode });
    }
  }
}

function buildRuntimeMeta(sessionInfo) {
  return {
    sessionId: sessionInfo.sessionId,
    bridgePid: sessionInfo.bridgePid ?? null,
    claudeCommand: sessionInfo.claudeCommand || null,
    cwd: sessionInfo.cwdAbs || sessionInfo.cwd || null,
    startedAt: sessionInfo.startedAt || new Date().toISOString(),
    bridgeAlive: true,
    source: 'claude-terminal',
    dispatchedAt: sessionInfo.dispatchedAt || null,
    screenLengthAtDispatch: Number.isFinite(sessionInfo.screenLengthAtDispatch) ? sessionInfo.screenLengthAtDispatch : null,
  };
}

function normalizeTerminalText(text) {
  // Match real ESC byte (0x1B) followed by CSI sequences
  const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g');
  return String(text || '')
    .replace(ansiPattern, '')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ');
}

function extractLastStructuredBlock(text, tagName) {
  const source = String(text || '');
  if (!source || !tagName) {return null;}
  const openTag = `<${tagName}>`;
  const closeTag = `</${tagName}>`;
  const tailWindow = 3000;
  const searchStart = Math.max(0, source.length - tailWindow);
  const openIndex = source.lastIndexOf(openTag);
  const closeIndex = source.lastIndexOf(closeTag);
  if (openIndex < 0 || closeIndex < 0 || closeIndex <= openIndex) {return null;}
  if (closeIndex < searchStart) {return null;}
  const endIndex = closeIndex + closeTag.length;
  return {
    rawBlock: source.slice(openIndex, endIndex),
    innerText: source.slice(openIndex + openTag.length, closeIndex).trim(),
    startIndex: openIndex,
    endIndex,
  };
}

function parseStructuredFields(innerText) {
  const fields = {};
  for (const rawLine of String(innerText || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) {continue;}
    const match = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!match) {continue;}
    fields[match[1].toLowerCase()] = match[2].trim();
  }
  return fields;
}

function isTemplatePlaceholderValue(value) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  if (!normalized) {return true;}
  if (/^<[^>]+>$/.test(normalized)) {return true;}
  const lowered = normalized.toLowerCase();
  return [
    '<one-line summary>',
    '<what you need from the user>',
    '<comma-separated paths or none>',
    '<short result or not run>',
    '<sha or none>',
  ].includes(lowered);
}

function hasTemplateFieldValues(fields, kind) {
  if (isTemplatePlaceholderValue(fields.summary)) {return true;}
  if (kind === 'complete') {
    if (isTemplatePlaceholderValue(fields.files)) {return true;}
    if (isTemplatePlaceholderValue(fields.tests)) {return true;}
    if (isTemplatePlaceholderValue(fields.commit)) {return true;}
  }
  return false;
}

function parseClaudeProtocolState(text) {
  const completeBlock = extractLastStructuredBlock(text, 'VIO_TASK_COMPLETE');
  const inputBlock = extractLastStructuredBlock(text, 'VIO_TASK_INPUT_NEEDED');
  const latestBlock = (!completeBlock && !inputBlock)
    ? null
    : (!inputBlock || (completeBlock && completeBlock.startIndex > inputBlock.startIndex)
        ? { kind: 'complete', block: completeBlock }
        : { kind: 'input_needed', block: inputBlock });
  if (!latestBlock?.block) {
    return {
      kind: null,
      summary: null,
      files: null,
      tests: null,
      commit: null,
      protocolSource: null,
      rawBlock: null,
    };
  }
  const fields = parseStructuredFields(latestBlock.block.innerText);
  const summary = fields.summary || null;
  if (!summary || hasTemplateFieldValues(fields, latestBlock.kind)) {
    return {
      kind: null,
      summary: null,
      files: null,
      tests: null,
      commit: null,
      protocolSource: null,
      rawBlock: null,
    };
  }
  const files = latestBlock.kind === 'complete'
    ? String(fields.files || 'none').split(',').map(part => part.trim()).filter(part => part && part.toLowerCase() !== 'none')
    : null;
  return {
    kind: latestBlock.kind,
    summary,
    files,
    tests: latestBlock.kind === 'complete' ? (fields.tests || null) : null,
    commit: latestBlock.kind === 'complete' ? (fields.commit || null) : null,
    protocolSource: 'structured',
    rawBlock: latestBlock.block.rawBlock,
  };
}

function detectAttention(screen) {
  if (!screen) {return null;}

  const hasChoiceUi =
    (screen.includes('1. Yes') && screen.includes('3. No')) ||
    screen.includes('Esc to cancel') ||
    screen.includes('Tab to amend') ||
    screen.includes('shift+tab');

  const createMatch = screen.match(/Do you want to create ([^\n?]+)\?/i);
  if (createMatch?.[1] && hasChoiceUi) {
    return {
      kind: 'confirm-create',
      title: 'Claude needs your input',
      summary: `Claude is waiting for your decision: create ${createMatch[1].trim()}?`,
    };
  }

  const editScopeMatch = screen.match(/Yes, allow all edits in ([^\n]+?) during this session/i);
  if (editScopeMatch?.[1]) {
    return {
      kind: 'confirm-edit-scope',
      title: 'Claude needs your input',
      summary: `Claude is asking whether to allow edits in ${editScopeMatch[1].trim()} during this session.`,
    };
  }

  if (screen.includes('Do you want to') && hasChoiceUi) {
    return {
      kind: 'confirm-choice',
      title: 'Claude needs your input',
      summary: 'Claude is waiting for your decision in the terminal.',
    };
  }

  if (screen.includes('accept edits on') && screen.includes('shift+tab to cycle')) {
    return {
      kind: 'accept-edits-mode',
      title: 'Claude needs your input',
      summary: 'Claude is waiting for you to confirm or adjust edit acceptance mode.',
    };
  }

  if (screen.includes('Press Enter to') || screen.includes('press enter to')) {
    return {
      kind: 'press-enter',
      title: 'Claude needs your input',
      summary: 'Claude is waiting for you to press Enter to continue.',
    };
  }

  if (screen.includes('Select an option') || screen.includes('select an option')) {
    return {
      kind: 'select-option',
      title: 'Claude needs your input',
      summary: 'Claude is waiting for you to select an option.',
    };
  }

  return null;
}


/**
 * Seed a demo task for development and manual testing.
 * Demonstrates the full completion handoff lifecycle.
 */
export function seedDemoTask() {
  const existing = getCurrentTask();
  if (existing && existing.status === 'running') {
    return existing;
  }

  const task = setCurrentTask({
    title: 'Implement completion handoff state machine',
    owner: 'vio',
    executor: 'claude',
    status: 'running',
    phase: 'coding',
    promptSummary: 'Add structured completion handoff so finished work is durably visible and reviewable.',
    startedAt: new Date().toISOString(),
  });

  advancePhase('coding', 'Claude started implementation');
  emitMilestone('Backend handoff model added', { detail: 'types, store, events extended' });
  emitMilestone('API review routes wired', { detail: 'start-review, accept, needs-fix endpoints' });
  emitMilestone('Frontend review actions added', { detail: 'review panel with accept/needs-fix buttons' });
  emitTouchedFiles([
    'src/server/agentTasks/types.mjs',
    'src/server/agentTasks/store.mjs',
    'src/server/agentTasks/events.mjs',
    'src/server/agentTasks/runtimeBridge.mjs',
    'src/server/routes/agentTasks.mjs',
    'public/claude.html',
    'public/claude.js',
    'public/claude.css',
  ]);

  advancePhase('testing', 'Running validation');
  emitValidation('Tests pass', { tests: { status: 'pass', summary: '4/4 passed' } });
  emitValidation('Commit created', { commit: { sha: 'abc1234', message: 'feat: completion handoff state machine' } });

  emitCompletionHandoff('Claude finished: completion handoff state machine implemented');

  appendLog({ level: 'info', text: 'Demo task seeded (finished_by_claude, awaiting review)' });

  return task;
}

/**
 * Called when Claude CLI PTY emits output.
 * Streams log lines into the task event/log layer.
 */
export function onClaudeOutput(text) {
  const task = getCurrentTask();
  if (!task || task.status !== 'running') { return; }
  appendLog({ level: 'debug', text: text.slice(0, 500) });
}

/**
 * Called when gateway events indicate task progress.
 * Recognizes completion signals and triggers handoff.
 */
export function onGatewayEvent(event) {
  const task = getCurrentTask();
  if (!task) { return; }
  if (event.type === 'final' && task.status === 'running') {
    appendLog({ level: 'info', text: 'Gateway final reply received' });
    markFinishedByClaude('Claude completed via gateway signal');
  }
}

/**
 * Called when any runtime detects Claude has finished.
 * Ensures durable completion state regardless of signal source.
 */
export function onCompletionSignal(message = 'Claude signaled completion') {
  const task = getCurrentTask();
  if (!task || task.completionEventSeen) { return task; }
  return markFinishedByClaude(message);
}
