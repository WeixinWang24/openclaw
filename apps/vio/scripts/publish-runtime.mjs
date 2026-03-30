import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(appRoot, 'src');
const runtimeRoot = path.join(appRoot, 'public', 'runtime');

const runtimeJsRoot = path.join(runtimeRoot, 'src');
const PUBLISH_DIRS = ['app', 'modules', 'shared'];

function rmIfExists(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function mkdirp(target) {
  fs.mkdirSync(target, { recursive: true });
}

function shouldSkip(name) {
  return name === '.DS_Store';
}

function copyTree(srcDir, destDir) {
  mkdirp(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) {continue;}
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(srcPath, destPath);
    } else if (entry.isFile()) {
      mkdirp(path.dirname(destPath));
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  rmIfExists(runtimeJsRoot);
  mkdirp(runtimeJsRoot);
  for (const dirName of PUBLISH_DIRS) {
    const srcDir = path.join(srcRoot, dirName);
    if (!fs.existsSync(srcDir)) {continue;}
    copyTree(srcDir, path.join(runtimeJsRoot, dirName));
  }

  const srcAppEntry = path.join(srcRoot, 'app.js');
  const publicAppEntry = path.join(runtimeRoot, '..', 'app.js');
  if (fs.existsSync(srcAppEntry)) {
    let appEntry = fs.readFileSync(srcAppEntry, 'utf8');
    appEntry = appEntry.replace(
      "from './modules/phase2/claude-code/controller.js'",
      "from './runtime/src/modules/phase2/claude-code/controller.js'",
    );
    fs.writeFileSync(publicAppEntry, appEntry, 'utf8');
  }

  console.log(`Published Vio runtime JS -> ${path.relative(appRoot, runtimeJsRoot)}`);
  console.log(`Published trees -> ${PUBLISH_DIRS.join(', ')}`);
  console.log(`Published browser entry -> ${path.relative(appRoot, publicAppEntry)}`);
  console.log('Source of truth -> src/');
}

main();
