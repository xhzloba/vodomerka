import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';
import { shell } from 'electron';
import type { MediaPlayerOption } from '../../contracts/ipc';

const execFileAsync = promisify(execFile);

const VODOMERKA_PLAYER: MediaPlayerOption = {
  id: 'vodomerka',
  name: 'Vodomerka Player',
  kind: 'builtin',
  installed: true,
};

const SYSTEM_PLAYER: MediaPlayerOption = {
  id: 'system',
  name: 'Системный плеер',
  kind: 'system',
  installed: true,
};

type Candidate = {
  id: string;
  name: string;
  paths: string[];
};

function homePath(relative: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return home ? `${home}${relative}` : '';
}

const MAC_PLAYERS: Candidate[] = [
  {
    id: 'vlc',
    name: 'VLC',
    paths: ['/Applications/VLC.app', homePath('/Applications/VLC.app')],
  },
  {
    id: 'iina',
    name: 'IINA',
    paths: ['/Applications/IINA.app', homePath('/Applications/IINA.app')],
  },
  {
    id: 'quicktime',
    name: 'QuickTime Player',
    paths: ['/System/Applications/QuickTime Player.app', '/Applications/QuickTime Player.app'],
  },
  {
    id: 'mpv',
    name: 'mpv',
    paths: ['/Applications/mpv.app', homePath('/Applications/mpv.app')],
  },
  {
    id: 'elmedia',
    name: 'Elmedia Player',
    paths: ['/Applications/Elmedia Player.app', homePath('/Applications/Elmedia Player.app')],
  },
  {
    id: 'movist',
    name: 'Movist',
    paths: ['/Applications/Movist.app', homePath('/Applications/Movist.app')],
  },
  {
    id: 'kodi',
    name: 'Kodi',
    paths: ['/Applications/Kodi.app', homePath('/Applications/Kodi.app')],
  },
];

const WIN_PLAYERS: Candidate[] = [
  {
    id: 'vlc',
    name: 'VLC',
    paths: [
      `${process.env.PROGRAMFILES ?? 'C:\\Program Files'}\\VideoLAN\\VLC\\vlc.exe`,
      `${process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'}\\VideoLAN\\VLC\\vlc.exe`,
    ],
  },
  {
    id: 'mpc-hc',
    name: 'MPC-HC',
    paths: [
      `${process.env.PROGRAMFILES ?? 'C:\\Program Files'}\\MPC-HC\\mpc-hc64.exe`,
      `${process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'}\\MPC-HC\\mpc-hc.exe`,
    ],
  },
  {
    id: 'potplayer',
    name: 'PotPlayer',
    paths: [
      `${process.env.PROGRAMFILES ?? 'C:\\Program Files'}\\DAUM\\PotPlayer\\PotPlayerMini64.exe`,
      `${process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'}\\DAUM\\PotPlayer\\PotPlayerMini.exe`,
    ],
  },
];

async function pathExists(filePath: string): Promise<boolean> {
  if (!filePath) {
    return false;
  }
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveCandidate(candidate: Candidate): Promise<MediaPlayerOption | null> {
  for (const appPath of candidate.paths) {
    if (await pathExists(appPath)) {
      return {
        id: candidate.id,
        name: candidate.name,
        kind: 'app',
        installed: true,
        appPath,
      };
    }
  }
  return null;
}

async function whichBinary(bin: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('which', [bin]);
    const resolved = stdout.trim();
    return resolved || null;
  } catch {
    return null;
  }
}

export async function listInstalledMediaPlayers(): Promise<MediaPlayerOption[]> {
  const players: MediaPlayerOption[] = [VODOMERKA_PLAYER, SYSTEM_PLAYER];

  const candidates = process.platform === 'win32' ? WIN_PLAYERS : MAC_PLAYERS;
  for (const candidate of candidates) {
    const found = await resolveCandidate(candidate);
    if (found) {
      players.push(found);
    }
  }

  if (process.platform === 'darwin' || process.platform === 'linux') {
    const mpvBin = await whichBinary('mpv');
    if (mpvBin && !players.some((item) => item.id === 'mpv')) {
      players.push({
        id: 'mpv',
        name: 'mpv',
        kind: 'app',
        installed: true,
        appPath: mpvBin,
      });
    }
  }

  return players;
}

export async function openFileWithPlayer(
  filePath: string,
  player: MediaPlayerOption,
): Promise<{ ok: boolean; error?: string }> {
  if (player.id === 'vodomerka') {
    return { ok: false, error: 'Используй встроенный плеер' };
  }

  if (player.id === 'system' || player.kind === 'system') {
    const result = await shell.openPath(filePath);
    if (result) {
      return { ok: false, error: result };
    }
    return { ok: true };
  }

  const appPath = player.appPath;
  if (!appPath) {
    return { ok: false, error: 'Плеер не найден' };
  }

  try {
    if (process.platform === 'darwin') {
      if (appPath.endsWith('.app')) {
        await execFileAsync('open', ['-a', appPath, filePath]);
      } else {
        await execFileAsync(appPath, [filePath]);
      }
      return { ok: true };
    }

    if (process.platform === 'win32') {
      await execFileAsync(appPath, [filePath], { windowsHide: true });
      return { ok: true };
    }

    await execFileAsync(appPath, [filePath]);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Не удалось открыть в плеере',
    };
  }
}
