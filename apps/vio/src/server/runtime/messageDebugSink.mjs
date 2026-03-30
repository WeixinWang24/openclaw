import fs from 'node:fs';
import path from 'node:path';

function sanitizeSegment(value, fallback = 'unknown') {
  return String(value || fallback)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

export function createMessageDebugSink({ root }) {
  const debugRoot = path.join(root, 'data', 'debug');

  function getDateStamp(ts) {
    const stamp = new Date(ts || Date.now());
    return Number.isNaN(stamp.getTime()) ? 'unknown-date' : stamp.toISOString().slice(0, 10);
  }

  function buildRecord(event = {}) {
    const ts = typeof event?.ts === 'string' ? event.ts : new Date().toISOString();
    return {
      ts,
      area: typeof event?.area === 'string' ? event.area : 'message-runtime',
      event: typeof event?.event === 'string' ? event.event : 'unknown',
      profile: typeof event?.profile === 'string' ? event.profile : 'manual',
      sessionKey: typeof event?.sessionKey === 'string' ? event.sessionKey : null,
      activeSessionKey: typeof event?.activeSessionKey === 'string' ? event.activeSessionKey : null,
      mountedSessionKey: typeof event?.mountedSessionKey === 'string' ? event.mountedSessionKey : null,
      localId: typeof event?.localId === 'string' ? event.localId : null,
      runId: typeof event?.runId === 'string' ? event.runId : null,
      reason: typeof event?.reason === 'string' ? event.reason : null,
      payload: event?.payload && typeof event.payload === 'object' ? event.payload : {},
    };
  }

  function append(event = {}) {
    const record = buildRecord(event);
    const dateStamp = getDateStamp(record.ts);
    const area = sanitizeSegment(record.area, 'message-runtime');
    const profile = sanitizeSegment(record.profile, 'manual');
    const dir = path.join(debugRoot, 'message-runtime', dateStamp);
    fs.mkdirSync(dir, { recursive: true });
    const globalFile = path.join(dir, `${area}--${profile}.jsonl`);
    fs.appendFileSync(globalFile, `${JSON.stringify(record)}\n`, 'utf8');
    if (record.sessionKey) {
      const sessionFile = path.join(dir, `session--${sanitizeSegment(record.sessionKey)}.jsonl`);
      fs.appendFileSync(sessionFile, `${JSON.stringify(record)}\n`, 'utf8');
    }
    return { ok: true, file: globalFile };
  }

  return {
    append,
  };
}
