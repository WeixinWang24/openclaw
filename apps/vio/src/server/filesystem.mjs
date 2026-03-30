import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..', '..');
const EXTRA_ALLOWED_ROOTS = [
  '/Volumes/2TB/MAS',
  '/Volumes/2TB/MAS/openclaw-core',
];
const ALLOWED_ROOTS = [PROJECT_ROOT, ...EXTRA_ALLOWED_ROOTS].map(root => path.resolve(root));
const EDITABLE_TEXT_FILE_RE = /\.(?:md|txt|json|jsonc|yaml|yml|js|mjs|cjs|ts|tsx|jsx|css|html|py|sh|zsh|bash|toml|ini|conf|cfg|xml|sql|rs|go|java|kt|swift|rb|php|c|cc|cpp|h|hpp)$/i;

function isWithinAllowedRoots(targetPath) {
  const resolved = path.resolve(targetPath);
  return ALLOWED_ROOTS.some(root => resolved === root || resolved.startsWith(root + path.sep));
}

export function safeProjectPath(relPath = '.') {
  const raw = typeof relPath === 'string' && relPath.trim() ? relPath.trim() : '.';
  const resolved = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(PROJECT_ROOT, raw);
  if (!isWithinAllowedRoots(resolved)) {
    throw new Error('path escapes allowed roots');
  }
  return resolved;
}

export function shouldShowProjectFile(relPath) {
  const blocked = ['.git', 'node_modules', '__pycache__', '.ipynb_checkpoints', '.DS_Store'];
  if (blocked.some(part => relPath.split(path.sep).includes(part))) {return false;}
  return true;
}

export function listProjectFiles(relDir = '.') {
  const normalizedDir = typeof relDir === 'string' && relDir.trim() ? relDir.trim() : '.';
  const baseDir = safeProjectPath(normalizedDir);
  const entries = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(entry => shouldShowProjectFile(path.join(normalizedDir === '.' ? '' : normalizedDir, entry.name)))
    .toSorted((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .map(entry => ({
      path: path.join(normalizedDir === '.' ? '' : normalizedDir, entry.name),
      name: entry.name,
      type: entry.isDirectory() ? 'dir' : 'file',
    }));
  const parent = normalizedDir === '.' ? null : path.dirname(normalizedDir);
  return {
    root: PROJECT_ROOT,
    currentDir: normalizedDir,
    parentDir: parent === '' ? '.' : parent,
    entries,
  };
}

export function readProjectFile(relPath) {
  const abs = safeProjectPath(relPath);
  const stat = fs.statSync(abs);
  if (!stat.isFile()) {throw new Error('not a file');}
  const content = fs.readFileSync(abs, 'utf8');
  return { path: relPath, absolutePath: abs, content };
}

export function writeProjectFile(relPath, content) {
  if (!EDITABLE_TEXT_FILE_RE.test(relPath || '')) {
    throw new Error('editing is limited to known text/code file types');
  }
  const abs = safeProjectPath(relPath);
  fs.writeFileSync(abs, typeof content === 'string' ? content : String(content || ''), 'utf8');
  return { ok: true, path: relPath };
}
