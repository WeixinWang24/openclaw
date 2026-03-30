import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { safeProjectPath } from '../filesystem.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_PATH = path.join(__dirname, 'bridges', 'claude_code_pty_bridge.py');
const CLAUDE_RUNTIME_DIR = path.join(process.cwd(), '.vio', 'claude-code');
const REGISTRY_PATH = path.join(CLAUDE_RUNTIME_DIR, 'claude-session.json');
const LOG_TAIL_BYTES = 50_000;
const CLAUDE_SESSION_ID = 'claude-default';

const sessions = new Map();

function ensureRuntimeDir() {
  fs.mkdirSync(CLAUDE_RUNTIME_DIR, { recursive: true });
}

function sanitizeSessionKeyForPath(sessionKey = '') {
  return String(sessionKey || 'default')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'default';
}

function resolveClaudeCommand() {
  const candidates = [
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    'claude',
  ];
  for (const candidate of candidates) {
    if (candidate === 'claude') {return candidate;}
    try {
      if (fs.existsSync(candidate)) {return candidate;}
    } catch {}
  }
  return 'claude';
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonFile(filePath, payload) {
  ensureRuntimeDir();
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readLogTail(logPath, maxBytes = LOG_TAIL_BYTES) {
  try {
    const stat = fs.statSync(logPath);
    const size = stat.size || 0;
    const start = Math.max(0, size - maxBytes);
    const truncated = start > 0;
    const fd = fs.openSync(logPath, 'r');
    try {
      const length = size - start;
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, start);
      return { text: buffer.toString('utf8'), truncated, start, size };
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return { text: '', truncated: false, start: 0, size: 0 };
  }
}

function isPidAlive(pid) {
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid) || numericPid <= 0) {return false;}
  try {
    process.kill(numericPid, 0);
    return true;
  } catch {
    return false;
  }
}

function getSessionPaths(sessionKey) {
  ensureRuntimeDir();
  const safeKey = sanitizeSessionKeyForPath(sessionKey);
  return {
    logPath: path.join(CLAUDE_RUNTIME_DIR, `${safeKey}.log`),
    stdinPath: path.join(CLAUDE_RUNTIME_DIR, `${safeKey}.stdin`),
    statusPath: path.join(CLAUDE_RUNTIME_DIR, `${safeKey}.status.json`),
    resizePath: path.join(CLAUDE_RUNTIME_DIR, `${safeKey}.resize.json`),
  };
}

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const ANSI_CSI_RE = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, 'g');
const ANSI_OSC_RE = new RegExp(`${ESC}\\][^${BEL}]*${BEL}`, 'g');

function stripAnsi(text = '') {
  return String(text)
    .replace(ANSI_CSI_RE, '')
    .replace(ANSI_OSC_RE, '')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function sanitizeDisplayOutput(text) {
  return String(text || '')
    .replace(/^\[dashboard\].*\n?/gm, '')
    .replace(/^\[cwd\].*\n?/gm, '')
    .replace(/^\[bridge\].*\n?/gm, '')
    .replace(/^\s*\n{3,}/gm, '\n\n');
}

function buildIdleState(sessionKey, cwdRel = '.') {
  return {
    ok: true,
    sessionKey,
    cwd: cwdRel,
    status: 'idle',
    started: false,
    running: false,
    output: '',
    outputTruncated: false,
    exited: false,
    exitCode: null,
    error: null,
    bridgePid: null,
    childPid: null,
  };
}

function enrichSessionState(session) {
  const status = readJsonFile(session.statusPath);
  if (status && typeof status === 'object') {
    session.bridgePid = status.bridgePid ?? session.bridgePid ?? null;
    session.childPid = status.childPid ?? session.childPid ?? null;
    session.exitCode = status.exitCode ?? session.exitCode ?? null;
    session.error = status.error ?? session.error ?? null;
    session.status = status.status || session.status || 'running';
  }
  const logResult = readLogTail(session.logPath);
  session.output = sanitizeDisplayOutput(stripAnsi(logResult.text));
  session.outputTruncated = logResult.truncated;

  const statusValue = String(session.status || 'idle');
  const statusSaysRunning = ['running', 'starting', 'ready', 'busy'].includes(statusValue);
  const statusSaysExited = ['terminated', 'exited', 'failed'].includes(statusValue);
  const bridgeAlive = isPidAlive(session.bridgePid);
  const childAlive = isPidAlive(session.childPid);
  const hasOutput = !!String(session.output || '').trim();
  const bridgeOnlyZombie = bridgeAlive && !childAlive && !hasOutput;

  session.started = !!(session.bridgePid || session.childPid || session.output);
  session.running = bridgeOnlyZombie ? false : (childAlive || (statusSaysRunning && childAlive) || (bridgeAlive && childAlive));
  session.exited = !session.running && (statusSaysExited || bridgeOnlyZombie);
  if (bridgeOnlyZombie) {
    session.status = 'terminated';
  } else if (!session.running && !statusSaysExited && session.started) {
    session.status = 'exited';
    session.exited = true;
  }
  session.updatedAt = new Date().toISOString();
  return session;
}

function buildResponse(session, sessionKey, cwdRel = '.') {
  if (!session) {return buildIdleState(sessionKey, cwdRel);}
  enrichSessionState(session);
  return {
    ok: true,
    sessionKey: session.sessionKey,
    cwd: session.cwdRel,
    status: session.status || 'idle',
    started: !!session.started,
    running: !!session.running,
    output: session.output || '',
    outputTruncated: !!session.outputTruncated,
    exited: !!session.exited,
    exitCode: session.exitCode ?? null,
    error: session.error ?? null,
    bridgePid: session.bridgePid ?? null,
    childPid: session.childPid ?? null,
  };
}

export function readClaudeCodeStream({ sessionKey = CLAUDE_SESSION_ID, offset = 0, maxBytes = 16384, cwdRel = '.' } = {}) {
  const key = String(sessionKey || CLAUDE_SESSION_ID);
  const session = rehydrateSession(cwdRel) || sessions.get(key);
  if (!session) {
    return {
      ok: true,
      sessionId: key,
      offset: 0,
      nextOffset: 0,
      chunk: '',
      hasMore: false,
      truncated: false,
      reset: false,
    };
  }

  const logPath = session.logPath;
  let fileSize = 0;
  try {
    fileSize = fs.statSync(logPath).size || 0;
  } catch {
    fileSize = 0;
  }

  const safeOffset = Math.max(0, Number(offset) || 0);
  if (safeOffset > fileSize) {
    return {
      ok: true,
      sessionId: key,
      offset: safeOffset,
      nextOffset: 0,
      chunk: '',
      hasMore: false,
      truncated: false,
      reset: true,
    };
  }

  const readStart = safeOffset;
  const readEnd = Math.min(fileSize, readStart + Math.max(1024, Number(maxBytes) || 16384));
  const length = Math.max(0, readEnd - readStart);
  let chunk = '';
  if (length > 0) {
    const fd = fs.openSync(logPath, 'r');
    try {
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, readStart);
      chunk = buffer.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  }

  return {
    ok: true,
    sessionId: key,
    offset: safeOffset,
    nextOffset: readEnd,
    chunk,
    hasMore: readEnd < fileSize,
    truncated: readEnd < fileSize,
    reset: false,
  };
}

function sleepMs(ms = 25) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForPathReady(filePath, { timeoutMs = 2000, pollMs = 25 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      if (filePath && fs.existsSync(filePath)) {return true;}
    } catch {}
    sleepMs(pollMs);
  }
  try {
    return !!(filePath && fs.existsSync(filePath));
  } catch {
    return false;
  }
}

function isClaudeUiReady(outputText) {
  const text = String(outputText || '');
  return text.includes('Claude Code') || text.includes('❯') || text.includes('? for shortcuts');
}

function waitForClaudeUiReady(session, { timeoutMs = 2500, pollMs = 50 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const { text } = readLogTail(session.logPath);
    if (isClaudeUiReady(text)) {return true;}
    sleepMs(pollMs);
  }
  return isClaudeUiReady(readLogTail(session.logPath).text);
}

function writeToClaudeStdin(stdinPath, text) {
  const writer = fs.createWriteStream(stdinPath, { flags: 'w' });
  writer.write(String(text || ''));
  writer.end();
}

function saveRegistry(session) {
  writeJsonFile(REGISTRY_PATH, {
    sessionKey: session.sessionKey,
    cwdRel: session.cwdRel,
    cwdAbs: session.cwdAbs,
    bridgePid: session.bridgePid ?? null,
    childPid: session.childPid ?? null,
    claudeCommand: session.claudeCommand,
    logPath: session.logPath,
    stdinPath: session.stdinPath,
    statusPath: session.statusPath,
    resizePath: session.resizePath,
    status: session.status || 'idle',
    exitCode: session.exitCode ?? null,
    error: session.error ?? null,
    startedAt: session.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function loadRegistry() {
  return readJsonFile(REGISTRY_PATH);
}

function rehydrateSession(cwdRel = '.') {
  const paths = getSessionPaths(CLAUDE_SESSION_ID);
  const registry = loadRegistry();
  const statusFile = readJsonFile(paths.statusPath);
  const hasPersistentState = !!(
    registry?.sessionKey
    || statusFile?.bridgePid
    || statusFile?.childPid
    || fs.existsSync(paths.logPath)
  );
  if (!hasPersistentState) {
    return sessions.get(CLAUDE_SESSION_ID) || null;
  }

  const session = {
    sessionKey: CLAUDE_SESSION_ID,
    cwdRel: registry?.cwdRel || cwdRel,
    cwdAbs: registry?.cwdAbs || safeProjectPath(registry?.cwdRel || cwdRel),
    claudeCommand: registry?.claudeCommand || resolveClaudeCommand(),
    logPath: registry?.logPath || paths.logPath,
    stdinPath: registry?.stdinPath || paths.stdinPath,
    statusPath: registry?.statusPath || paths.statusPath,
    resizePath: registry?.resizePath || paths.resizePath,
    bridgePid: statusFile?.bridgePid ?? registry?.bridgePid ?? null,
    childPid: statusFile?.childPid ?? registry?.childPid ?? null,
    status: statusFile?.status || registry?.status || 'running',
    started: true,
    running: false,
    output: '',
    outputTruncated: false,
    exited: false,
    exitCode: statusFile?.exitCode ?? registry?.exitCode ?? null,
    error: statusFile?.error ?? registry?.error ?? null,
    createdAt: registry?.startedAt || null,
    updatedAt: new Date().toISOString(),
    recovered: true,
  };
  enrichSessionState(session);
  sessions.set(CLAUDE_SESSION_ID, session);
  return session;
}

export function getClaudeCodeState({ sessionKey = CLAUDE_SESSION_ID, cwdRel = '.' } = {}) {
  const key = String(sessionKey || CLAUDE_SESSION_ID);
  const session = sessions.get(key) || rehydrateSession(cwdRel);
  return buildResponse(session, key, cwdRel);
}

export function startClaudeCodeSession({ sessionKey = CLAUDE_SESSION_ID, cwdRel = '.' } = {}) {
  const key = String(sessionKey || CLAUDE_SESSION_ID);

  const existing = rehydrateSession(cwdRel) || sessions.get(key);
  if (existing) {
    enrichSessionState(existing);
    const childAlive = !!(existing.childPid && isPidAlive(existing.childPid));
    const bridgeAlive = !!(existing.bridgePid && isPidAlive(existing.bridgePid));
    const shouldReuseExisting = !!(
      childAlive
      || (existing.running && childAlive)
      || (bridgeAlive && childAlive)
    );
    if (shouldReuseExisting) {
      sessions.set(key, existing);
      return buildResponse(existing, key, cwdRel);
    }
  }

  const cwdAbs = safeProjectPath(cwdRel);
  const claudeCommand = resolveClaudeCommand();
  const paths = getSessionPaths(key);

  for (const filePath of [paths.logPath, paths.stdinPath, paths.statusPath, paths.resizePath]) {
    try {fs.rmSync(filePath, { force: true });} catch {}
  }

  const child = spawn(
    'python3',
    [
      BRIDGE_PATH,
      '--cwd', cwdAbs,
      '--log', paths.logPath,
      '--stdin', paths.stdinPath,
      '--status', paths.statusPath,
      '--resize', paths.resizePath,
      '--',
      claudeCommand,
    ],
    {
      cwd: cwdAbs,
      env: {
        ...process.env,
        TERM: process.env.TERM || 'xterm-256color',
        COLORTERM: process.env.COLORTERM || 'truecolor',
        CLAUDE_CODE_ENTRYPOINT: 'vio',
      },
      detached: true,
      stdio: 'ignore',
    },
  );
  child.unref();

  const session = {
    sessionKey: key,
    cwdRel,
    cwdAbs,
    claudeCommand,
    logPath: paths.logPath,
    stdinPath: paths.stdinPath,
    statusPath: paths.statusPath,
    resizePath: paths.resizePath,
    bridgePid: child.pid,
    childPid: null,
    status: 'starting',
    started: true,
    running: true,
    output: '',
    outputTruncated: false,
    exited: false,
    exitCode: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sessions.set(key, session);

  const stdinReady = waitForPathReady(paths.stdinPath, { timeoutMs: 1200, pollMs: 25 });
  if (stdinReady) {
    session.status = 'running';
  }
  enrichSessionState(session);
  if (session.status === 'starting' && (session.childPid || session.output || stdinReady)) {
    session.status = 'running';
  }

  saveRegistry(session);
  return buildResponse(session, key, cwdRel);
}

export function sendClaudeCodeInput({ sessionKey = CLAUDE_SESSION_ID, text, cwdRel = '.', raw = false } = {}) {
  const key = String(sessionKey || CLAUDE_SESSION_ID);
  const payload = String(text || '');
  if (!payload.trim() && !raw) {throw new Error('text is required');}

  let session = rehydrateSession(cwdRel) || sessions.get(key);
  const hasUsablePersistentSession = !!(session && (session.running || session.output || session.childPid || session.bridgePid));
  const wasNewSession = !hasUsablePersistentSession;
  if (wasNewSession) {
    startClaudeCodeSession({ sessionKey: key, cwdRel });
    session = sessions.get(key);
  } else {
    sessions.set(key, session);
  }

  const stdinReady = waitForPathReady(session.stdinPath, {
    timeoutMs: wasNewSession ? 2500 : 500,
    pollMs: 25,
  });
  if (!stdinReady) {
    throw new Error('Claude Code stdin pipe is not ready');
  }

  if (wasNewSession && !raw) {
    const uiReady = waitForClaudeUiReady(session, { timeoutMs: 1500, pollMs: 50 });
    if (!uiReady) {
      try {
        writeToClaudeStdin(session.stdinPath, '\r');
      } catch {}
      waitForClaudeUiReady(session, { timeoutMs: 1200, pollMs: 50 });
    }
  }

  if (raw) {
    writeToClaudeStdin(session.stdinPath, payload);
  } else {
    writeToClaudeStdin(session.stdinPath, payload.replace(/[\r\n]+$/, ''));
    setTimeout(() => {
      try {
        writeToClaudeStdin(session.stdinPath, '\r');
      } catch {}
    }, 120);
  }

  enrichSessionState(session);
  saveRegistry(session);
  return buildResponse(session, key, cwdRel);
}

export function stopClaudeCodeSession({ sessionKey = CLAUDE_SESSION_ID } = {}) {
  const key = String(sessionKey || CLAUDE_SESSION_ID);
  const session = sessions.get(key) || rehydrateSession();
  if (!session) {return buildIdleState(key);}

  session.status = 'terminating';
  let killAttempted = false;
  for (const pid of [session.bridgePid, session.childPid]) {
    const numericPid = Number(pid);
    if (!Number.isInteger(numericPid) || numericPid <= 0) {continue;}
    killAttempted = true;
    try {
      process.kill(numericPid, 'SIGTERM');
    } catch (error) {
      if (error?.code !== 'ESRCH') {
        session.error = error?.message || String(error);
        session.status = 'failed';
        break;
      }
    }
  }

  if (!killAttempted) {
    session.status = 'terminated';
  }

  const startedAt = Date.now();
  const timeoutMs = 1500;
  while (Date.now() - startedAt < timeoutMs) {
    enrichSessionState(session);
    if (!session.running) {
      break;
    }
    sleepMs(75);
  }

  if (!session.running) {
    session.status = session.status === 'failed' ? 'failed' : 'terminated';
    session.exited = true;
  }

  saveRegistry(session);
  return buildResponse(session, key, session.cwdRel);
}

export async function restartClaudeCodeSession({ sessionKey = CLAUDE_SESSION_ID, cwdRel = '.', waitMs = 300 } = {}) {
  stopClaudeCodeSession({ sessionKey });
  await new Promise(resolve => setTimeout(resolve, waitMs));
  return startClaudeCodeSession({ sessionKey, cwdRel });
}

export function resizeClaudeCodeSession({ sessionKey = CLAUDE_SESSION_ID, cols, rows } = {}) {
  const key = String(sessionKey || CLAUDE_SESSION_ID);
  const session = sessions.get(key) || rehydrateSession();
  if (session && isPidAlive(session.bridgePid) && !session.exited) {
    const c = Math.max(1, Math.min(500, Number(cols) || 80));
    const r = Math.max(1, Math.min(200, Number(rows) || 24));
    const resizePath = session.resizePath || getSessionPaths(key).resizePath;
    try {
      fs.writeFileSync(resizePath, JSON.stringify({ cols: c, rows: r }), 'utf8');
    } catch {}
  }
  return buildResponse(session, key, session?.cwdRel);
}
