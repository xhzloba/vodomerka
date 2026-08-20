import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';
import { proxyHlsUrl } from '../media/hlsProxy';

const API_MAX_RETRIES = 2;

async function fetchJson(url: string): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= API_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < API_MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

async function resolveFinalUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, */*' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // Follow redirects for CDN URL; discard body.
  await response.arrayBuffer();
  return response.url || url;
}

export function registerApiIpc() {
  ipcMain.handle(IPC_CHANNELS.api.get, async (_event, url: string) => fetchJson(url));
  ipcMain.handle(IPC_CHANNELS.api.resolveUrl, async (_event, url: string) => resolveFinalUrl(url));
  ipcMain.handle(IPC_CHANNELS.api.proxyHlsUrl, async (_event, url: string) => {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid HLS url');
    }
    return proxyHlsUrl(url);
  });
}
