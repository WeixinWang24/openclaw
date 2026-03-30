import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { safeProjectPath } from '../filesystem.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_PATH = path.join(__dirname, 'bridges', 'claude_code_pty_bridge.py');
const CLAUDE_RUNTIME_DIR = path.join(process.cwd(), '.vio', 'claude-code');
const LOG_TAIL_BYTES = 50_000;

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

function readLogTail(logPath, maxBytes = LOG_TAIL_BYTES) {
  try {
    const stat = fs.statSync(logPath);
    const size = stat.size || 0;
    const start = Math.max(0, size - maxBytes);
    const fd = fs.openSync(logPath, 'r');
    try {
      const length = size - start;
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, start);
      return buffer.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
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

function buildIdleState(sessionKey, cwdRel = '.') {
  return {
    ok: true,
    sessionKey,
    cwd: cwdRel,
    status: 'idle',
    started: false,
    running: false,
    output: '',
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
  session.output = readLogTail(session.logPath);
  session.running = isPidAlive(session.bridgePid) && !['terminated', 'exited', 'failed'].includes(session.status);
  session.started = !!session.bridgePid;
  session.exited = !session.running && ['terminated', 'exited', 'failed'].includes(session.status);
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
    exited: !!session.exited,
    exitCode: session.exitCode ?? null,
    error: session.error ?? null,
    bridgePid: session.bridgePid ?? null,
    childPid: session.childPid ?? null,
  };
}

function waitForPathReady(filePath, { timeoutMs = 2000, pollMs = 25 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      if (filePath && fs.existsSync(filePath)) {return true;}
    } catch {}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pollMs);
  }
  return false;
}

function writeToClaudeStdin(stdinPath, text) {
  const writer = fs.createWriteStream(stdinPath, { flags: 'w' });
  writer.write(String(text || ''));
  writer.end();
}

export function getClaudeCodeState({ sessionKey, cwdRel = '.' } = {}) {
  const key = String(sessionKey || '');
  if (!key) {throw new Error('sessionKey is required');}
  const session = sessions.get(key) || null;
  return buildResponse(session, key, cwdRel);
}

export function startClaudeCodeSession({ sessionKey, cwdRel = '.' } = {}) {
  const key = String(sessionKey || '');
  if (!key) {throw new Error('sessionKey is required');}

  const existing = sessions.get(key);
  if (existing) {
    enrichSessionState(existing);
    if (existing.running) {
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
    exited: false,
    exitCode: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sessions.set(key, session);
  return buildResponse(session, key, cwdRel);
}

export function sendClaudeCodeInput({ sessionKey, text, cwdRel = '.', raw = false } = {}) {
  const key = String(sessionKey || '');
  if (!key) {throw new Error('sessionKey is required');}
  const payload = String(text || '');
  if (!payload.trim()) {throw new Error('text is required');}

  let session = sessions.get(key);
  if (!session || !session.running) {
    startClaudeCodeSession({ sessionKey: key, cwdRel });
    session = sessions.get(key);
  }

  const stdinReady = waitForPathReady(session.stdinPath, { timeoutMs: 2500, pollMs: 25 });
  if (!stdinReady) {
    throw new Error('Claude Code stdin pipe is not ready');
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
  return buildResponse(session, key, cwdRel);
}

export function stopClaudeCodeSession({ sessionKey } = {}) {
  const key = String(sessionKey || '');
  if (!key) {throw new Error('sessionKey is required');}
  const session = sessions.get(key);
  if (!session) {return buildIdleState(key);}

  session.status = 'terminating';
  try {
    if (session.bridgePid) {
      process.kill(session.bridgePid, 'SIGTERM');
    }
  } catch (error) {
    session.error = error?.message || String(error);
    session.status = 'failed';
  }

  enrichSessionState(session);
  return buildResponse(session, key, session.cwdRel);
}
