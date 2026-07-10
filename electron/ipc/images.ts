import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';

const IMAGE_MAX_RETRIES = 2;
const IMAGE_CACHE_LIMIT = 160;
const imageCache = new Map<string, string>();

function rememberImage(url: string, dataUrl: string) {
  if (imageCache.has(url)) {
    imageCache.delete(url);
  }

  imageCache.set(url, dataUrl);

  if (imageCache.size > IMAGE_CACHE_LIMIT) {
    const oldest = imageCache.keys().next().value;
    if (oldest) {
      imageCache.delete(oldest);
    }
  }
}

async function fetchImageDataUrl(url: string): Promise<string> {
  const cached = imageCache.get(url);
  if (cached) {
    return cached;
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= IMAGE_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'image/*' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const mime = response.headers.get('content-type') || 'image/jpeg';
      const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      rememberImage(url, dataUrl);
      return dataUrl;
    } catch (error) {
      lastError = error;
      if (attempt < IMAGE_MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export function registerImagesIpc() {
  ipcMain.handle(IPC_CHANNELS.images.fetch, async (_event, url: string): Promise<string> => {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid image url');
    }

    return fetchImageDataUrl(url);
  });
}
