import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DASHBOARD_APP_ROOT, DEFAULT_CLAUDE_CWD, PROJECT_ROOT } from '../config.mjs';
import { safeProjectPath } from './filesystem.mjs';

const ROADMAP_FILE_NAME = 'roadmap.md';

function toRel(targetPath) {
  return path.relative(PROJECT_ROOT, targetPath) || '.';
}

function nowIso() {
  return new Date().toISOString();
}

function tryGitTopLevel(startDir) {
  try {
    const out = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: startDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function tryGitChangedFiles(projectRoot) {
  try {
    const out = execFileSync('git', ['status', '--short'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return String(out || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 50)
      .map(line => line.replace(/^.{1,3}\s+/, '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function resolveProjectRoot(projectRoot = null) {
  const candidate = typeof projectRoot === 'string' && projectRoot.trim()
    ? projectRoot.trim()
    : DEFAULT_CLAUDE_CWD || DASHBOARD_APP_ROOT;
  const safeCandidate = safeProjectPath(candidate);
  const gitRoot = tryGitTopLevel(safeCandidate);
  return gitRoot ? safeProjectPath(gitRoot) : safeCandidate;
}

export function getProjectRoadmapPath(projectRoot = null) {
  return path.join(resolveProjectRoot(projectRoot), ROADMAP_FILE_NAME);
}

function buildInitialRoadmap({ projectRoot, title = null, context = null } = {}) {
  const name = title || path.basename(projectRoot) || 'Project';
  const now = nowIso();
  return `# Project Roadmap — ${name}

_Last updated: ${now}_

## Project Design
- Goal:
- Architecture approach:
- Constraints:
- Rules already in effect:

## Current State
- Current focus:
- Current phase:
- Blockers:

## Implemented
- ${now} — Recovery-first roadmap created.

## Next Steps
- Confirm the current project design.
- Record only state-relevant completed changes.

## Recovery Notes
- Resume from:
- Key files to read first:
- Active assumptions:
${context ? `- Initial context: ${String(context).trim()}
` : ''}`;
}

function updateLastUpdated(text, timestamp) {
  if (/_Last updated: .*_/i.test(text)) {
    return text.replace(/_Last updated: .*_/i, `_Last updated: ${timestamp}_`);
  }
  return text;
}

function upsertSection(text, heading, body) {
  const normalized = text.replace(/\r/g, '');
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^## ${escaped}\\n)([\\s\\S]*?)(?=^## |$)`, 'm');
  if (re.test(normalized)) {
    return normalized.replace(re, `$1${body.trimEnd()}\n\n`);
  }
  return `${normalized.trimEnd()}\n\n## ${heading}\n${body.trimEnd()}\n`;
}

function appendImplementedEntry(text, entry) {
  const normalized = text.replace(/\r/g, '');
  const re = /(^## Implemented\n)([\s\S]*?)(?=^## |$)/m;
  if (re.test(normalized)) {
    return normalized.replace(re, (_, head, body) => `${head}${entry}\n${body.trimStart()}`);
  }
  return `${normalized.trimEnd()}\n\n## Implemented\n${entry}\n`;
}

function normalizeBulletLines(lines = []) {
  return lines
    .map(line => String(line || '').trim())
    .filter(Boolean)
    .map(line => line.startsWith('- ') ? line : `- ${line}`)
    .join('\n');
}

function summarizeRoadmapItems(items = []) {
  if (!Array.isArray(items) || !items.length) {return [];}
  return items.slice(0, 6).map(item => {
    const title = String(item?.title || '').trim();
    const desc = String(item?.description || '').trim();
    return desc ? `${title} — ${desc}` : title;
  }).filter(Boolean);
}

export function ensureProjectRoadmap({ projectRoot = null, title = null, context = null } = {}) {
  const root = resolveProjectRoot(projectRoot);
  const roadmapPath = getProjectRoadmapPath(root);
  const exists = fs.existsSync(roadmapPath);
  if (!exists) {
    fs.writeFileSync(roadmapPath, buildInitialRoadmap({ projectRoot: root, title, context }), 'utf8');
  }
  return {
    ok: true,
    created: !exists,
    projectRoot: root,
    projectRootRel: toRel(root),
    roadmapPath,
    roadmapPathRel: toRel(roadmapPath),
  };
}

export function appendProjectRoadmapEntry({ projectRoot = null, roadmap = null, replyBody = '', changedFiles = [], notes = '', taskState = null } = {}) {
  const ensured = ensureProjectRoadmap({ projectRoot });
  const roadmapPath = ensured.roadmapPath;
  const timestamp = nowIso();
  const existing = fs.readFileSync(roadmapPath, 'utf8');
  const roadmapItems = summarizeRoadmapItems(roadmap?.items || []);
  const inferredChangedFiles = Array.isArray(changedFiles) && changedFiles.length ? changedFiles : tryGitChangedFiles(ensured.projectRoot);
  const replyPreview = String(replyBody || '').trim().replace(/\s+/g, ' ').slice(0, 280);

  const implementedLines = [
    `- ${timestamp} — Updated project state after a development/review turn.`,
    ...(roadmapItems.length ? roadmapItems.map(item => `  - ${item}`) : []),
    ...(inferredChangedFiles.length ? inferredChangedFiles.map(file => `  - changed: ${file}`) : []),
  ].join('\n');

  let next = appendImplementedEntry(existing, `${implementedLines}\n`);

  const currentStateLines = normalizeBulletLines([
    roadmapItems[0] ? `Current focus: ${roadmapItems[0]}` : 'Current focus: infer from latest implementation turn',
    taskState?.phase ? `Current phase: ${taskState.phase}` : null,
    taskState?.blockers ? `Blockers: ${taskState.blockers}` : null,
    notes ? `Latest state note: ${String(notes).trim()}` : null,
    replyPreview ? `Latest reply signal: ${replyPreview}` : null,
  ].filter(Boolean));
  next = upsertSection(next, 'Current State', currentStateLines || '- Current focus: pending update');

  const nextStepsLines = normalizeBulletLines(
    roadmapItems.length
      ? roadmapItems
      : ['Review current state, refine design, and record the next real implementation step.']
  );
  next = upsertSection(next, 'Next Steps', nextStepsLines);

  const recoveryNotesLines = normalizeBulletLines([
    `Resume from: ${path.basename(ensured.roadmapPath)}`,
    `Project root: ${ensured.projectRoot}`,
    `Key files to read first: ${['roadmap.md', 'src/server.mjs', 'src/server/projectRoadmap.mjs'].join(', ')}`,
    `Recent changed files: ${inferredChangedFiles.length ? inferredChangedFiles.slice(0, 8).join(', ') : 'none detected'}`,
    'Active assumptions: roadmap.md is the project recovery document; data/roadmap.json remains response-roadmap/UI state.',
  ]);
  next = upsertSection(next, 'Recovery Notes', recoveryNotesLines);

  next = updateLastUpdated(next, timestamp).trimEnd() + '\n';
  fs.writeFileSync(roadmapPath, next, 'utf8');

  return {
    ok: true,
    projectRoot: ensured.projectRoot,
    projectRootRel: ensured.projectRootRel,
    roadmapPath: ensured.roadmapPath,
    roadmapPathRel: ensured.roadmapPathRel,
    appendedAt: timestamp,
    itemCount: roadmapItems.length,
    changedFiles: inferredChangedFiles,
  };
}
