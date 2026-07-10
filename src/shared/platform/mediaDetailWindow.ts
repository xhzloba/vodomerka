import type { MediaItem } from '@/shared/domain/media';
import { ensureMediaOverridesLoaded, hydrateMediaItem } from '@/shared/domain/overridesStore';
import { preloadDetailWindowAssets } from '@/shared/media/preloadDetailAssets';

const DETAIL_OPEN_TIMEOUT_MS = 15_000;

export function getDetailWindowMediaId(): string | null {
  const match = window.location.hash.match(/^#detail\/(.+)$/);
  if (!match?.[1]) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

export function isDetailWindow(): boolean {
  return getDetailWindowMediaId() !== null;
}

function waitForDetailWindowReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      unsubscribe?.();
      reject(new Error('Detail window open timeout'));
    }, DETAIL_OPEN_TIMEOUT_MS);

    const unsubscribe = window.electronAPI?.detail?.onReady?.(() => {
      window.clearTimeout(timeoutId);
      unsubscribe?.();
      resolve();
    });

    if (!unsubscribe) {
      window.clearTimeout(timeoutId);
      reject(new Error('Detail ready listener unavailable'));
    }
  });
}

export async function openMediaDetailWindow(item: MediaItem): Promise<boolean> {
  if (!window.electronAPI?.detail?.open) {
    return false;
  }

  if (await window.electronAPI.detail.tryFocus(item.id)) {
    return true;
  }

  await ensureMediaOverridesLoaded();
  const hydrated = hydrateMediaItem(item);
  await preloadDetailWindowAssets(hydrated);

  const readyPromise = waitForDetailWindowReady();
  await window.electronAPI.detail.open(hydrated);
  await readyPromise;
  return true;
}

export function closeMediaDetailWindow(): void {
  void window.electronAPI?.detail?.close();
}
