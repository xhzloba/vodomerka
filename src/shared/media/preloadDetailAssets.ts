import type { MediaItem } from '@/shared/domain/media';
import {
  delay,
  isVokinoProxyImage,
  loadMediaImage,
  resolveDirectImageUrl,
} from '@/shared/media/imageLoader';

const DETAIL_ASSETS_TIMEOUT_MS = 10_000;

function probeDecodedImage(src: string): Promise<boolean> {
  if (!src) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

async function loadAndProbe(url: string, fallbackUrl = ''): Promise<void> {
  const candidates = [url, fallbackUrl].filter(
    (candidate, index, list) => Boolean(candidate) && list.indexOf(candidate) === index,
  );

  for (const candidate of candidates) {
    try {
      const resolved = await loadMediaImage(candidate);
      if (await probeDecodedImage(resolved)) {
        return;
      }

      if (window.electronAPI?.images?.fetch && isVokinoProxyImage(candidate)) {
        const direct = resolveDirectImageUrl(candidate);
        if (direct !== resolved && (await probeDecodedImage(direct))) {
          return;
        }
      }
    } catch {
      // try next candidate
    }
  }
}

async function preloadDetailAssets(item: MediaItem): Promise<void> {
  const backdropPrimary = item.backdrop || item.poster;
  const backdropFallback = item.backdrop && item.poster !== item.backdrop ? item.poster : '';

  if (backdropPrimary) {
    await loadAndProbe(backdropPrimary, backdropFallback);
  }

  if (item.logo) {
    await loadAndProbe(item.logo);
  }
}

export async function preloadDetailWindowAssets(item: MediaItem): Promise<void> {
  await Promise.race([preloadDetailAssets(item), delay(DETAIL_ASSETS_TIMEOUT_MS)]);
}
