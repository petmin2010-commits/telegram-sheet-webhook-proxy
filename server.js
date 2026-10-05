import http from 'node:http';
import https from 'node:https';

const PORT = Number(process.env.PORT || 10000);
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

if (!APPS_SCRIPT_URL) {
  throw new Error('APPS_SCRIPT_URL is required');
}

function forwardToAppsScript(body) {
  return new Promise((resolve, reject) => {
    const target = new URL(APPS_SCRIPT_URL);
    const req = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      },
      timeout: 25000
    }, (resp) => {
      resp.resume();
      resp.on('end', () => resolve(resp.statusCode || 0));
    });

    req.on('timeout', () => req.destroy(new Error('upstream timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('OK');
    return;
  }

  if (req.method !== 'POST' || req.url !== '/telegram') {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1024 * 1024) req.destroy();
  });

  req.on('end', async () => {
    try {
      const status = await forwardToAppsScript(body);
      console.log('Apps Script upstream status:', status);

      // Apps Script intentionally responds with a 302 after executing the POST.
      // Telegram requires a direct 2xx, so acknowledge it here.
      if ((status >= 200 && status < 400)) {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('OK');
      } else {
        res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Upstream error');
      }
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Proxy error');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Telegram webhook proxy listening on', PORT);
});
