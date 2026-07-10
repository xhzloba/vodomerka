import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';

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

export function registerApiIpc() {
  ipcMain.handle(IPC_CHANNELS.api.get, async (_event, url: string) => fetchJson(url));
}
