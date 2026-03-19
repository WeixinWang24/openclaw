import fs from 'node:fs';
import path from 'node:path';
import { DASHBOARD_APP_ROOT, PROJECT_ROOT } from '../config.mjs';
import { safeProjectPath } from './filesystem.mjs';

const ROADMAP_FILE_NAME = 'roadmap.md';

function toRel(targetPath) {
  return path.relative(PROJECT_ROOT, targetPath) || '.';
}

export function resolveProjectRoot(projectRoot = null) {
  const candidate = typeof projectRoot === 'string' && projectRoot.trim()
    ? projectRoot.trim()
    : DASHBOARD_APP_ROOT;
  return safeProjectPath(candidate);
}

export function getProjectRoadmapPath(projectRoot = null) {
  return path.join(resolveProjectRoot(projectRoot), ROADMAP_FILE_NAME);
}

function buildInitialRoadmap({ projectRoot, title = null, context = null } = {}) {
  const name = title || path.basename(projectRoot) || 'Project';
  const now = new Date().toISOString();
  const contextLine = context ? `
Initial context: ${String(context).trim()}
` : '';
  return `# Roadmap — ${name}

_Last updated: ${now}_

## Project Design
- Purpose: pending definition
- Architecture notes: pending
- Constraints: pending
${contextLine}
## Implemented Changes
- ${now} — Roadmap created.

## Next Steps
- Define or refine the project design.
- Record each completed development or modification step here.
`;
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

function formatRoadmapItems(items = []) {
  if (!Array.isArray(items) || !items.length) {return '- No structured roadmap items extracted.';}
  return items.map(item => {
    const title = String(item?.title || '').trim() || 'Untitled item';
    const desc = String(item?.description || '').trim();
    return desc ? `- ${title} — ${desc}` : `- ${title}`;
  }).join('\n');
}

function formatChangedFiles(changedFiles = []) {
  if (!Array.isArray(changedFiles) || !changedFiles.length) {return '- Not recorded';}
  return changedFiles.map(file => `- ${String(file)}`).join('\n');
}

export function appendProjectRoadmapEntry({ projectRoot = null, roadmap = null, replyBody = '', changedFiles = [], notes = '' } = {}) {
  const ensured = ensureProjectRoadmap({ projectRoot });
  const roadmapPath = ensured.roadmapPath;
  const now = new Date().toISOString();
  const existing = fs.readFileSync(roadmapPath, 'utf8');
  const replyPreview = String(replyBody || '').trim().slice(0, 500);
  const block = `

### ${now}

#### Completed Changes
${formatRoadmapItems(roadmap?.items || [])}

#### Changed Files
${formatChangedFiles(changedFiles)}

#### Notes
${notes ? String(notes).trim() : (replyPreview || 'No additional notes recorded.')}
`;

  let next = existing;
  if (/## Implemented Changes\s*/i.test(existing)) {
    next = existing.replace(/## Implemented Changes\s*/i, match => `${match}${block}\n`);
  } else {
    next = `${existing.trimEnd()}\n\n## Implemented Changes\n${block}\n`;
  }

  if (roadmap?.items?.length) {
    const nextSteps = formatRoadmapItems(roadmap.items);
    if (/## Next Steps\s*/i.test(next)) {
      next = next.replace(/## Next Steps\s*/i, match => `${match}${nextSteps}\n\n`);
    } else {
      next = `${next.trimEnd()}\n\n## Next Steps\n${nextSteps}\n`;
    }
  }

  fs.writeFileSync(roadmapPath, next.trimEnd() + '\n', 'utf8');
  return {
    ok: true,
    projectRoot: ensured.projectRoot,
    projectRootRel: ensured.projectRootRel,
    roadmapPath: ensured.roadmapPath,
    roadmapPathRel: ensured.roadmapPathRel,
    appendedAt: now,
    itemCount: Array.isArray(roadmap?.items) ? roadmap.items.length : 0,
  };
}
