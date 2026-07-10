import { ipcMain } from 'electron';
import { IPC_CHANNELS, type MediaOverridesMap } from '../../contracts/ipc';

const MEDIA_OVERRIDES_JSON_URL =
  'https://raw.githubusercontent.com/xhzloba/dbmovies/main/movie_overrides.json';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: MediaOverridesMap | null = null;
let cacheLoadedAt = 0;

async function fetchOverrides(): Promise<MediaOverridesMap> {
  const response = await fetch(MEDIA_OVERRIDES_JSON_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as MediaOverridesMap;
}

export function registerOverridesIpc() {
  ipcMain.handle(IPC_CHANNELS.overrides.get, async () => {
    if (cache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
      return cache;
    }

    cache = await fetchOverrides();
    cacheLoadedAt = Date.now();
    return cache;
  });

  ipcMain.handle(IPC_CHANNELS.overrides.invalidate, () => {
    cache = null;
    cacheLoadedAt = 0;
  });
}
