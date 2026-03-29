import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendText } from './httpUtils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../../public');

export function servePublicFile(requestUrl, res) {
  const urlPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const filePath = path.join(PUBLIC_DIR, urlPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'forbidden');
    return true;
  }

  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  const isBinary = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

  fs.readFile(filePath, isBinary ? null : 'utf8', (err, data) => {
    if (err) {
      sendText(res, 404, 'not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[ext] || 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
  return true;
}
