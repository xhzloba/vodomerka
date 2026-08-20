import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

let server: Server | null = null;
let port: number | null = null;

const FETCH_HEADERS = {
  Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, video/*, */*',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

function encodeRemoteUrl(url: string): string {
  return Buffer.from(url, 'utf8').toString('base64url');
}

function decodeRemoteUrl(encoded: string): string {
  return Buffer.from(encoded, 'base64url').toString('utf8');
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildHlsProxyUrl(remoteUrl: string, listenPort: number): string {
  return `http://127.0.0.1:${listenPort}/hls/${encodeRemoteUrl(remoteUrl)}`;
}

function rewriteM3u8(body: string, playlistUrl: string, listenPort: number): string {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return line;
      }

      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/gi, (_match, uri: string) => {
          try {
            const absolute = new URL(uri, playlistUrl).toString();
            return `URI="${buildHlsProxyUrl(absolute, listenPort)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }

      try {
        const absolute = new URL(trimmed, playlistUrl).toString();
        return buildHlsProxyUrl(absolute, listenPort);
      } catch {
        return line;
      }
    })
    .join('\n');
}

function looksLikeM3u8(contentType: string, remoteUrl: string, body: Buffer): boolean {
  if (/mpegurl|m3u8/i.test(contentType)) {
    return true;
  }
  if (/\.m3u8(\?|$)/i.test(remoteUrl)) {
    return true;
  }
  const head = body.subarray(0, 16).toString('utf8').trimStart();
  return head.startsWith('#EXTM3U');
}

function sendCors(res: ServerResponse, contentType?: string) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }
}

async function fetchRemote(url: string, attempt = 0): Promise<Response> {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: FETCH_HEADERS,
  });

  if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    return fetchRemote(url, attempt + 1);
  }

  return response;
}

async function handleHlsRequest(req: IncomingMessage, res: ServerResponse, encoded: string) {
  let remoteUrl: string;
  try {
    remoteUrl = decodeRemoteUrl(encoded);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid proxy url');
    return;
  }

  if (!isHttpUrl(remoteUrl)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Only http(s) remotes allowed');
    return;
  }

  if (req.method === 'OPTIONS') {
    sendCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const response = await fetchRemote(remoteUrl);
    if (!response.ok) {
      sendCors(res, 'text/plain; charset=utf-8');
      res.writeHead(response.status);
      res.end(`Upstream HTTP ${response.status}`);
      return;
    }

    const finalUrl = response.url || remoteUrl;
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const maybePlaylist =
      /\.m3u8(\?|$)/i.test(finalUrl) || /mpegurl|m3u8/i.test(contentType);

    // Binary segments: stream through without buffering whole body in IPC/base64.
    if (!maybePlaylist && response.body) {
      sendCors(res, contentType);
      const contentLength = response.headers.get('content-length');
      res.writeHead(200, contentLength ? { 'Content-Length': contentLength } : undefined);
      await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), res);
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (looksLikeM3u8(contentType, finalUrl, buffer)) {
      const rewritten = rewriteM3u8(buffer.toString('utf8'), finalUrl, port!);
      const out = Buffer.from(rewritten, 'utf8');
      sendCors(res, 'application/vnd.apple.mpegurl');
      res.writeHead(200, { 'Content-Length': out.byteLength });
      res.end(out);
      return;
    }

    sendCors(res, contentType);
    res.writeHead(200, { 'Content-Length': buffer.byteLength });
    await pipeline(Readable.from(buffer), res);
  } catch (error) {
    if (!res.headersSent) {
      sendCors(res, 'text/plain; charset=utf-8');
      res.writeHead(502);
      res.end(error instanceof Error ? error.message : 'Proxy fetch failed');
    } else {
      res.destroy(error instanceof Error ? error : undefined);
    }
  }
}

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const host = req.headers.host || `127.0.0.1:${port}`;
  const url = new URL(req.url || '/', `http://${host}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  const match = url.pathname.match(/^\/hls\/([^/]+)$/);
  if (match?.[1]) {
    void handleHlsRequest(req, res, match[1]);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

export async function ensureHlsProxyServer(): Promise<{ port: number }> {
  if (server && port != null) {
    return { port };
  }

  server = createServer(handleRequest);

  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject);
    server!.listen(0, '127.0.0.1', () => {
      const address = server!.address();
      if (!address || typeof address === 'string') {
        reject(new Error('HLS proxy failed to bind'));
        return;
      }
      port = address.port;
      resolve();
    });
  });

  return { port: port! };
}

export async function proxyHlsUrl(remoteUrl: string): Promise<string> {
  if (!isHttpUrl(remoteUrl)) {
    throw new Error('Invalid HLS url');
  }
  const { port: listenPort } = await ensureHlsProxyServer();
  return buildHlsProxyUrl(remoteUrl, listenPort);
}

export async function shutdownHlsProxyServer(): Promise<void> {
  if (!server) {
    return;
  }
  const current = server;
  server = null;
  port = null;
  await new Promise<void>((resolve) => {
    current.close(() => resolve());
  });
}
