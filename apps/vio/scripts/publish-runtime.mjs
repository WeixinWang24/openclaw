import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(appRoot, 'src');
const runtimeRoot = path.join(appRoot, 'public', 'runtime');

const runtimeJsRoot = path.join(runtimeRoot, 'src');

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
  copyTree(srcRoot, runtimeJsRoot);
  console.log(`Published Vio runtime JS -> ${path.relative(appRoot, runtimeJsRoot)}`);
  console.log('Browser runtime entry -> public/app.js');
  console.log('Source of truth -> src/');
}

main();
