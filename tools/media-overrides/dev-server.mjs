import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5190);
const GITHUB_API = 'https://api.github.com';
const UPSTREAM_TIMEOUT_MS = 45_000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxyRequest(req, res, targetUrl, headers = {}) {
  const body = ['POST', 'PUT', 'PATCH'].includes(req.method || 'GET') ? await readBody(req) : undefined;
  const upstreamHeaders = {
    'User-Agent': 'tv-leonid-overrides-ui',
    ...headers,
  };

  if (req.headers.authorization) {
    upstreamHeaders.Authorization = req.headers.authorization;
  }

  if (body?.length) {
    upstreamHeaders['Content-Type'] = req.headers['content-type'] || 'application/json';
    upstreamHeaders['Content-Length'] = String(body.length);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
      body,
      signal: controller.signal,
    });

    const responseBody = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(responseBody);
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Upstream timeout'
        : error instanceof Error
          ? error.message
          : 'Proxy error';
    sendJson(res, 502, { message });
  } finally {
    clearTimeout(timeoutId);
  }
}

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(__dirname, urlPath);

  if (!filePath.startsWith(__dirname)) {
    sendJson(res, 403, { message: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { message: 'Bad request' });
    return;
  }

  if (req.url === '/__health') {
    sendJson(res, 200, { ok: true, proxy: true });
    return;
  }

  if (req.url.startsWith('/github-api/')) {
    const targetPath = req.url.replace('/github-api', '');
    await proxyRequest(req, res, `${GITHUB_API}${targetPath}`, {
      Accept: req.headers.accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': req.headers['x-github-api-version'] || '2022-11-28',
    });
    return;
  }

  if (req.url.startsWith('/raw-github/')) {
    const rawPath = req.url.replace('/raw-github/', '').split('?')[0];
    await proxyRequest(req, res, `https://raw.githubusercontent.com/${rawPath}`, {
      Accept: 'application/json, text/plain, */*',
    });
    return;
  }

  serveStatic(req, res);
});

server.on('error', (error) => {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
    console.error(`Порт ${PORT} занят. Останови старый serve: lsof -ti :${PORT} | xargs kill -9`);
    process.exit(1);
  }

  throw error;
});

server.listen(PORT, () => {
  console.log(`Overrides UI: http://localhost:${PORT}`);
  console.log('GitHub API proxy: /github-api/*');
  console.log('Raw GitHub proxy: /raw-github/*');
});
