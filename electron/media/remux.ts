import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { access, mkdir, rename, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { app } from 'electron';
import { getTorrentsRoot } from '../torrents/paths';

const DIRECT_PLAY = new Set(['.mp4', '.m4v', '.webm', '.mov']);

export function resolveFfmpegPath(): string | null {
  if (process.env.FFMPEG_BIN && existsSync(process.env.FFMPEG_BIN)) {
    return process.env.FFMPEG_BIN;
  }

  const binaryName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const bases = [
    process.cwd(),
    app.isPackaged ? process.resourcesPath : null,
    app.getAppPath(),
    path.join(app.getAppPath(), '..'),
  ].filter((value): value is string => Boolean(value));

  for (const base of bases) {
    const candidates = [
      path.join(base, 'node_modules', 'ffmpeg-static', binaryName),
      path.join(base, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', binaryName),
      path.join(base, 'ffmpeg-static', binaryName),
      path.join(base, binaryName),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  try {
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    const pkgDir = path.dirname(require.resolve('ffmpeg-static/package.json'));
    const candidate = path.join(pkgDir, binaryName);
    if (existsSync(candidate)) {
      return candidate;
    }
  } catch {
    // ignore
  }

  return null;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function getPlayableCachePath(sourcePath: string): string {
  // Include remux profile so AC3→AAC caches don't collide with old stream-copy caches.
  const hash = createHash('sha1').update(`v2-aac:${sourcePath}`).digest('hex').slice(0, 20);
  return path.join(getTorrentsRoot(), '.playcache', `${hash}.mp4`);
}

const backgroundFfmpeg = new Set<ReturnType<typeof spawn>>();
const remuxJobs = new Set<string>();

function runFfmpeg(args: string[]): Promise<void> {
  const ffmpeg = resolveFfmpegPath();
  if (!ffmpeg) {
    return Promise.reject(new Error('ffmpeg не найден'));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    backgroundFfmpeg.add(child);
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 8000) {
        stderr = stderr.slice(-4000);
      }
    });
    const forget = () => {
      backgroundFfmpeg.delete(child);
    };
    child.on('error', (error) => {
      forget();
      reject(error);
    });
    child.on('close', (code) => {
      forget();
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim().split('\n').slice(-3).join(' ') || `ffmpeg exit ${code}`));
    });
  });
}

export function cancelBackgroundRemuxJobs(): void {
  remuxJobs.clear();
  for (const child of [...backgroundFfmpeg]) {
    try {
      child.kill('SIGKILL');
    } catch {
      // ignore
    }
  }
  backgroundFfmpeg.clear();
}

export function canDirectPlay(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return DIRECT_PLAY.has(ext);
}

/**
 * Chromium-safe ffmpeg maps: H.264/H.265 copy + AC3/DTS → AAC.
 * Stream-copy of AC3 fails in <video> ("не удалось декодировать").
 */
export const CHROMIUM_REMUX_MAP_ARGS = [
  '-map',
  '0:v:0',
  '-map',
  '0:a:0?',
  '-c:v',
  'copy',
  '-c:a',
  'aac',
  '-ac',
  '2',
  '-b:a',
  '192k',
  '-sn',
] as const;

export async function getExistingPlayableCache(sourcePath: string): Promise<string | null> {
  const outPath = getPlayableCachePath(sourcePath);
  if (!(await pathExists(outPath))) {
    return null;
  }
  try {
    const sourceStat = await stat(sourcePath);
    const outStat = await stat(outPath);
    if (outStat.mtimeMs >= sourceStat.mtimeMs && outStat.size > 1_000_000) {
      return outPath;
    }
  } catch {
    return null;
  }
  return null;
}

/** Build seekable AAC cache in background (does not block playback). */
export function startBackgroundPlayableCache(sourcePath: string): void {
  if (canDirectPlay(sourcePath) || remuxJobs.has(sourcePath)) {
    return;
  }
  remuxJobs.add(sourcePath);
  void ensurePlayableFile(sourcePath)
    .catch((error) => {
      console.warn('[media] background remux failed', error);
    })
    .finally(() => {
      remuxJobs.delete(sourcePath);
    });
}

/**
 * Returns a Chromium-playable path. Remuxes mkv/avi → mp4 into .playcache.
 * Prefer streaming remux for playback; use this for seekable cache.
 */
export async function ensurePlayableFile(sourcePath: string): Promise<{
  filePath: string;
  remuxed: boolean;
}> {
  if (canDirectPlay(sourcePath)) {
    return { filePath: sourcePath, remuxed: false };
  }

  const cacheDir = path.join(getTorrentsRoot(), '.playcache');
  await mkdir(cacheDir, { recursive: true });
  const outPath = getPlayableCachePath(sourcePath);

  const cached = await getExistingPlayableCache(sourcePath);
  if (cached) {
    return { filePath: cached, remuxed: true };
  }

  const tempOut = `${outPath}.tmp`;
  try {
    await rm(tempOut, { force: true });
  } catch {
    // ignore
  }

  try {
    await runFfmpeg([
      '-y',
      '-i',
      sourcePath,
      ...CHROMIUM_REMUX_MAP_ARGS,
      '-movflags',
      '+faststart',
      '-f',
      'mp4',
      tempOut,
    ]);
    await rename(tempOut, outPath);
  } catch (error) {
    try {
      await rm(tempOut, { force: true });
    } catch {
      // ignore
    }
    throw error;
  }

  return { filePath: outPath, remuxed: true };
}
