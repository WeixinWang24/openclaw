import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_DIR, VIO_CAM_DIR } from '../config.mjs';
import { sendText } from './httpUtils.mjs';

export function serveCameraAsset(requestUrl, res) {
  try {
    const relName = decodeURIComponent(requestUrl.pathname.replace('/vio_cam/', ''));
    const abs = path.join(VIO_CAM_DIR, relName);
    if (!abs.startsWith(VIO_CAM_DIR)) {throw new Error('forbidden');}
    const data = fs.readFileSync(abs);
    const ext = path.extname(abs).toLowerCase();
    const type = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    sendText(res, 404, 'not found');
  }
}

export function servePublicFile(requestUrl, res) {
  const urlPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const filePath = path.join(PUBLIC_DIR, urlPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, 'not found');
      return;
    }
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain; charset=utf-8' });
    res.end(data);
  });
}
