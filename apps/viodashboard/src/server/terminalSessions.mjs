import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { safeProjectPath } from './filesystem.mjs';

const terminalSessions = new Map();
const MAX_TERMINAL_SESSIONS = 5;

function resolveInteractiveShell() {
  const candidates = ['/bin/bash', '/bin/sh', process.env.SHELL, '/bin/zsh'].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {return candidate;}
    } catch {}
  }
  return '/bin/sh';
}

export function getOrCreateTerminalSession(sessionId = 'default', cwdRel = '.') {
  const existing = terminalSessions.get(sessionId);
  if (existing && !existing.exited) {return existing;}
  if (!terminalSessions.has(sessionId) && terminalSessions.size >= MAX_TERMINAL_SESSIONS) {
    throw new Error(`Max terminal sessions (${MAX_TERMINAL_SESSIONS}) reached`);
  }
  const cwd = safeProjectPath(cwdRel);
  const shellPath = resolveInteractiveShell();
  const shellArgs = shellPath.endsWith('/sh') ? ['-i'] : ['-i'];
  const child = spawn(shellPath, shellArgs, { cwd, env: process.env, stdio: 'pipe' });
  const state = {
    id: sessionId,
    cwdRel,
    child,
    shellPath,
    output: '',
    exited: false,
    exitCode: null,
    status: 'running',
    terminationRequestedAt: null,
    terminatedAt: null,
    terminationError: null,
  };
  const append = chunk => {
    state.output += String(chunk || '');
    if (state.output.length > 20000) {state.output = state.output.slice(-20000);}
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('error', error => {
    state.output += `\n[terminal spawn error] ${error?.message || String(error)}\n`;
    state.exited = true;
    state.exitCode = null;
    state.status = 'failed';
    state.terminationError = error?.message || String(error);
    state.terminatedAt = state.terminatedAt || new Date().toISOString();
  });
  child.on('exit', code => {
    state.exited = true;
    state.exitCode = code;
    if (state.status === 'terminating') {
      state.status = 'terminated';
      state.terminatedAt = state.terminatedAt || new Date().toISOString();
    } else if (state.status !== 'failed') {
      state.status = 'exited';
    }
  });
  terminalSessions.set(sessionId, state);
  return state;
}

export function getTerminalSession(sessionId = 'default') {
  return terminalSessions.get(sessionId) || null;
}
