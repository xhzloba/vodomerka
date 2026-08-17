import { fetchMediaById, isSparseMediaItem } from '@/shared/api/vokino/media';
import type { MediaItem } from '@/shared/domain/media';
import { ensureMediaOverridesLoaded, hydrateMediaItem } from '@/shared/domain/overridesStore';
import { preloadDetailWindowAssets } from '@/shared/media/preloadDetailAssets';

const DETAIL_OPEN_TIMEOUT_MS = 15_000;

async function resolveDetailMediaItem(item: MediaItem): Promise<MediaItem> {
  if (item.id.startsWith('torrent:')) {
    return item;
  }

  try {
    const full = await fetchMediaById(item.id);
    if (!full) {
      return item;
    }

    if (isSparseMediaItem(item)) {
      try {
        const watched = (await window.electronAPI?.watched?.list?.()) ?? [];
        const entry = watched.find((row) => row.item.id === full.id);
        if (entry) {
          void window.electronAPI?.watched?.setStatus?.(full, entry.status);
        }
      } catch {
        // best-effort
      }
    }

    return full;
  } catch {
    return item;
  }
}

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

export async function prepareMediaDetailItem(item: MediaItem): Promise<MediaItem> {
  await ensureMediaOverridesLoaded();
  const resolved = await resolveDetailMediaItem(item);
  return hydrateMediaItem(resolved);
}

export async function openMediaDetailWindow(item: MediaItem): Promise<boolean> {
  if (!window.electronAPI?.detail?.open) {
    return false;
  }

  if (await window.electronAPI.detail.tryFocus(item.id)) {
    return true;
  }

  const hydrated = await prepareMediaDetailItem(item);
  await preloadDetailWindowAssets(hydrated);

  const readyPromise = waitForDetailWindowReady();
  await window.electronAPI.detail.open(hydrated);
  await readyPromise;
  return true;
}

export function closeMediaDetailWindow(): void {
  void window.electronAPI?.detail?.close();
}
