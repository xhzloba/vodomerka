import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { getTorrentsRoot } from '../torrents/paths';
import { resolveFfmpegPath, CHROMIUM_REMUX_MAP_ARGS } from './remux';

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.ts': 'video/mp2t',
};

type FileToken = { kind: 'file'; filePath: string };
type LiveRemuxToken = {
  kind: 'live-remux';
  createStream: () => Readable;
  label: string;
};
type FileRemuxToken = {
  kind: 'file-remux';
  filePath: string;
  label: string;
};

type MediaToken = FileToken | LiveRemuxToken | FileRemuxToken;

let server: Server | null = null;
let port: number | null = null;
const tokens = new Map<string, MediaToken>();

function isPathInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
}

function contentTypeFor(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function sendError(res: ServerResponse, status: number, message: string) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function attachFfmpegToResponse(
  child: ChildProcessWithoutNullStreams,
  res: ServerResponse,
  cleanupExtra?: () => void,
) {
  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'none',
    Connection: 'keep-alive',
  });

  child.stdout.pipe(res);

  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
    if (stderr.length > 4000) {
      stderr = stderr.slice(-2000);
    }
  });

  const cleanup = () => {
    try {
      cleanupExtra?.();
    } catch {
      // ignore
    }
    try {
      child.kill('SIGKILL');
    } catch {
      // ignore
    }
  };

  res.on('close', cleanup);
  child.on('error', (error) => {
    console.warn('[media] ffmpeg error', error);
    cleanup();
  });
  child.on('close', (code) => {
    if (code && code !== 0 && stderr) {
      console.warn('[media] ffmpeg exit', code, stderr.slice(-300));
    }
  });
}

/** Instant playback: ffmpeg reads source file and streams Chromium-safe fMP4. */
function pipeFileRemux(token: FileRemuxToken, res: ServerResponse, startSeconds = 0) {
  const ffmpegPath = resolveFfmpegPath();
  if (!ffmpegPath) {
    sendError(res, 500, 'ffmpeg не найден');
    return;
  }
  if (!existsSync(token.filePath) || !isPathInside(getTorrentsRoot(), token.filePath)) {
    sendError(res, 404, 'File not found');
    return;
  }

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    ...(startSeconds > 0 ? ['-ss', String(startSeconds)] : []),
    '-i',
    token.filePath,
    ...CHROMIUM_REMUX_MAP_ARGS,
    '-f',
    'mp4',
    '-movflags',
    'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1',
  ];

  const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  attachFfmpegToResponse(child, res);
}

function pipeLiveRemux(token: LiveRemuxToken, res: ServerResponse) {
  const ffmpegPath = resolveFfmpegPath();
  if (!ffmpegPath) {
    sendError(res, 500, 'ffmpeg не найден');
    return;
  }

  let input: Readable | null = null;
  try {
    input = token.createStream();
    const child = spawn(
      ffmpegPath,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-probesize',
        '32M',
        '-analyzeduration',
        '15M',
        '-i',
        'pipe:0',
        ...CHROMIUM_REMUX_MAP_ARGS,
        '-f',
        'mp4',
        '-movflags',
        'frag_keyframe+empty_moov+default_base_moof',
        'pipe:1',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );

    input.pipe(child.stdin);
    attachFfmpegToResponse(child, res, () => {
      try {
        input?.destroy();
      } catch {
        // ignore
      }
    });
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : 'Stream error');
  }
}

function handleFileToken(token: FileToken, req: IncomingMessage, res: ServerResponse) {
  const filePath = token.filePath;
  if (!existsSync(filePath)) {
    sendError(res, 404, 'File not found');
    return;
  }

  if (!isPathInside(getTorrentsRoot(), filePath)) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  const stat = statSync(filePath);
  const size = stat.size;
  const type = contentTypeFor(filePath);
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');

  if (range) {
    const matchRange = /bytes=(\d*)-(\d*)/.exec(range);
    if (!matchRange) {
      sendError(res, 416, 'Invalid range');
      return;
    }
    const start = matchRange[1] ? Number(matchRange[1]) : 0;
    const end = matchRange[2] ? Number(matchRange[2]) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      res.end();
      return;
    }
    const clampedEnd = Math.min(end, size - 1);
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${clampedEnd}/${size}`,
      'Content-Length': clampedEnd - start + 1,
    });
    createReadStream(filePath, { start, end: clampedEnd }).pipe(res);
    return;
  }

  res.writeHead(200, { 'Content-Length': size });
  createReadStream(filePath).pipe(res);
}

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1`);
    const match = url.pathname.match(/^\/play\/([^/]+)\/?$/);
    if (!match) {
      sendError(res, 404, 'Not found');
      return;
    }

    const tokenId = decodeURIComponent(match[1]!);
    const token = tokens.get(tokenId);
    if (!token) {
      sendError(res, 404, 'File not found');
      return;
    }

    if (token.kind === 'live-remux') {
      pipeLiveRemux(token, res);
      return;
    }

    if (token.kind === 'file-remux') {
      const start = Number(url.searchParams.get('t') || 0);
      pipeFileRemux(token, res, Number.isFinite(start) && start > 0 ? start : 0);
      return;
    }

    handleFileToken(token, req, res);
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : 'Server error');
  }
}

export async function ensureMediaServer(): Promise<{ port: number }> {
  if (server && port != null) {
    return { port };
  }

  server = createServer(handleRequest);

  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject);
    server!.listen(0, '127.0.0.1', () => {
      const address = server!.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Media server failed to bind'));
        return;
      }
      port = address.port;
      resolve();
    });
  });

  return { port: port! };
}

export function registerMediaToken(token: string, filePath: string): string {
  tokens.set(token, { kind: 'file', filePath: path.resolve(filePath) });
  return token;
}

export function registerLiveRemuxToken(
  token: string,
  createStream: () => Readable,
  label: string,
): string {
  tokens.set(token, { kind: 'live-remux', createStream, label });
  return token;
}

export function registerFileRemuxToken(token: string, filePath: string, label: string): string {
  tokens.set(token, { kind: 'file-remux', filePath: path.resolve(filePath), label });
  return token;
}

export function unregisterMediaToken(token: string) {
  tokens.delete(token);
}

export function buildMediaUrl(token: string, listenPort: number, startSeconds?: number): string {
  const base = `http://127.0.0.1:${listenPort}/play/${encodeURIComponent(token)}`;
  if (startSeconds && startSeconds > 0) {
    return `${base}?t=${Math.floor(startSeconds)}`;
  }
  return base;
}

export async function shutdownMediaServer(): Promise<void> {
  tokens.clear();
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
