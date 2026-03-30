import http from 'node:http';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, data }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('request timeout')));
  });
}

async function main() {
  const targets = [
    'http://127.0.0.1:8792/',
    'http://127.0.0.1:8792/app.js',
    'http://127.0.0.1:8792/runtime/src/app/bootstrap/bootstrap-message-runtime.js',
    'http://127.0.0.1:8792/runtime/src/modules/phase1/page-shell/index.js',
  ];

  for (const url of targets) {
    const { status, data } = await fetchText(url);
    if (status !== 200) {
      throw new Error(`Smoke failed: ${url} -> HTTP ${status}`);
    }
    if (url.endsWith('/') && !data.includes('id="app"')) {
      throw new Error(`Smoke failed: ${url} missing #app root`);
    }
  }

  console.log('Vio browser-path smoke passed');
}

main().catch(error => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
