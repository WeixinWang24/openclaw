import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from '../config.mjs';

const GUIDELINES_DIR = path.join(PROJECT_ROOT, 'memory', 'permanent', 'guidelines');
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json']);

function safeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function isGuidelineFile(entry) {
  if (!entry?.isFile?.()) {return false;}
  if (entry.name.startsWith('.')) {return false;}
  return TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase());
}

function summarizeJsonContent(raw, fallbackTitle) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.rules)) {
      const rules = parsed.rules;
      const preview = rules.slice(0, 6).map(rule => {
        const id = rule?.rule_id ? `${rule.rule_id}: ` : '';
        return `${id}${rule?.title || rule?.description || 'untitled rule'}`;
      });
      return {
        title: parsed?.schema?.description || fallbackTitle,
        summary: `JSON guideline set with ${rules.length} rules.`,
        preview,
        parsed,
      };
    }
    if (parsed && typeof parsed === 'object') {
      const keys = Object.keys(parsed).slice(0, 12);
      return {
        title: fallbackTitle,
        summary: `JSON guideline document with top-level keys: ${keys.join(', ') || 'none'}.`,
        preview: [],
        parsed,
      };
    }
  } catch {}
  return {
    title: fallbackTitle,
    summary: 'JSON guideline document.',
    preview: [],
    parsed: null,
  };
}

function summarizeTextContent(raw, fallbackTitle) {
  const lines = String(raw || '').split(/\r?\n/);
  const nonEmpty = lines.map(line => line.trim()).filter(Boolean);
  const titleLine = nonEmpty.find(line => line.startsWith('#'));
  const title = titleLine ? titleLine.replace(/^#+\s*/, '').trim() : fallbackTitle;
  const summary = nonEmpty.find(line => !line.startsWith('#') && !/^[-*]\s+/.test(line)) || '';
  const preview = nonEmpty
    .filter(line => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .slice(0, 8)
    .map(line => line.replace(/^[-*]\s+/, '').trim());
  return { title, summary, preview };
}

function readGuidelineFile(fullPath) {
  const raw = fs.readFileSync(fullPath, 'utf8');
  const ext = path.extname(fullPath).toLowerCase();
  const fileName = path.basename(fullPath);
  const relPath = path.relative(PROJECT_ROOT, fullPath);
  const stat = safeStat(fullPath);

  if (ext === '.json') {
    const info = summarizeJsonContent(raw, fileName);
    return {
      id: relPath,
      path: relPath,
      fileName,
      format: 'json',
      title: info.title,
      summary: info.summary,
      preview: info.preview,
      content: raw,
      parsed: info.parsed,
      updatedAt: stat?.mtime?.toISOString?.() || null,
      size: stat?.size || raw.length,
    };
  }

  const info = summarizeTextContent(raw, fileName);
  return {
    id: relPath,
    path: relPath,
    fileName,
    format: ext === '.md' ? 'markdown' : 'text',
    title: info.title,
    summary: info.summary,
    preview: info.preview,
    content: raw,
    parsed: null,
    updatedAt: stat?.mtime?.toISOString?.() || null,
    size: stat?.size || raw.length,
  };
}

export function listGuidelines({ limit = 100 } = {}) {
  if (!fs.existsSync(GUIDELINES_DIR)) {
    return [];
  }
  const cappedLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const entries = fs.readdirSync(GUIDELINES_DIR, { withFileTypes: true })
    .filter(isGuidelineFile)
    .map(entry => path.join(GUIDELINES_DIR, entry.name))
    .map(fullPath => ({
      fullPath,
      stat: safeStat(fullPath),
    }))
    .toSorted((a, b) => (b.stat?.mtimeMs || 0) - (a.stat?.mtimeMs || 0) || a.fullPath.localeCompare(b.fullPath))
    .slice(0, cappedLimit);

  return entries.map(item => readGuidelineFile(item.fullPath));
}

export function getGuidelinesDir() {
  return GUIDELINES_DIR;
}
