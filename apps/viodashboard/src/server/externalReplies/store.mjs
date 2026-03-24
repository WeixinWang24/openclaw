import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data', 'external-replies');
const INBOX_PATH = path.join(DATA_DIR, 'inbox.json');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureInboxFile() {
  ensureDataDir();
  if (!fs.existsSync(INBOX_PATH)) {
    fs.writeFileSync(INBOX_PATH, JSON.stringify({ items: [] }, null, 2), 'utf8');
  }
}

function readInbox() {
  ensureInboxFile();
  try {
    const raw = JSON.parse(fs.readFileSync(INBOX_PATH, 'utf8'));
    return {
      items: Array.isArray(raw?.items) ? raw.items : [],
    };
  } catch (error) {
    console.warn('[externalReplies] failed to read inbox:', error?.message || error);
    return { items: [] };
  }
}

function writeInbox(items) {
  ensureInboxFile();
  fs.writeFileSync(INBOX_PATH, JSON.stringify({ items: Array.isArray(items) ? items : [] }, null, 2), 'utf8');
}

function hashReply(text = '') {
  return crypto
    .createHash('sha1')
    .update(String(text || ''))
    .digest('hex')
    .slice(0, 16);
}

function normalizeReplyPayload(payload = {}) {
  const replyText = String(payload?.replyText || '').trim();
  if (!replyText) {
    throw new Error('replyText is required');
  }

  return {
    id: payload?.id || `reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source: String(payload?.source || 'chatgpt-web').trim() || 'chatgpt-web',
    provider: String(payload?.provider || 'openai').trim() || 'openai',
    title: String(payload?.title || '').trim() || 'Untitled external reply',
    promptText: String(payload?.promptText || ''),
    replyText,
    sourceUrl: String(payload?.sourceUrl || ''),
    capturedAt: payload?.capturedAt ? new Date(payload.capturedAt).toISOString() : new Date().toISOString(),
    status: String(payload?.status || 'new').trim() || 'new',
    replyHash: String(payload?.replyHash || '').trim() || hashReply(replyText),
  };
}

export function listExternalReplies() {
  const inbox = readInbox();
  return [...inbox.items].toSorted((a, b) => {
    const aTime = new Date(a?.capturedAt || 0).getTime();
    const bTime = new Date(b?.capturedAt || 0).getTime();
    return bTime - aTime;
  });
}

export function ingestExternalReply(payload) {
  const item = normalizeReplyPayload(payload);
  const inbox = readInbox();
  const existing = inbox.items.find(entry => (
    String(entry?.source || '') === item.source
    && String(entry?.sourceUrl || '') === item.sourceUrl
    && String(entry?.replyHash || '') === item.replyHash
  ));

  if (existing) {
    return { item: existing, deduped: true };
  }

  const items = [item, ...inbox.items];
  writeInbox(items);
  return { item, deduped: false };
}
