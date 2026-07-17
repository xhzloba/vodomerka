const IMAGE_CONCURRENCY = 8;
const PROXY_HOST = 'proxy.vokino.pro';
const VOKINO_UPLOADS_HOST_PATTERN = /api\.vokino\.(?:pro|tv)\/uploads\//i;

let activeLoads = 0;
const loadQueue: Array<() => void> = [];

async function acquireImageSlot(): Promise<void> {
  if (activeLoads < IMAGE_CONCURRENCY) {
    activeLoads += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    loadQueue.push(() => {
      activeLoads += 1;
      resolve();
    });
  });
}

function releaseImageSlot(): void {
  activeLoads = Math.max(0, activeLoads - 1);
  loadQueue.shift()?.();
}

async function runWithImageConcurrency<T>(task: () => Promise<T>): Promise<T> {
  await acquireImageSlot();

  try {
    return await task();
  } finally {
    releaseImageSlot();
  }
}

export function isVokinoProxyImage(url: string): boolean {
  return url.includes(PROXY_HOST);
}

export function isVokinoUploadImage(url: string): boolean {
  return VOKINO_UPLOADS_HOST_PATTERN.test(url);
}

export function shouldFetchVokinoImageViaIpc(url: string): boolean {
  return isVokinoProxyImage(url) || isVokinoUploadImage(url);
}

export function normalizeVokinoImageUrl(url: string): string {
  if (!url) {
    return '';
  }

  return url.trim().replace(/^http:\/\//i, 'https://');
}

export function resolveDirectImageUrl(url: string): string {
  const normalized = normalizeVokinoImageUrl(url);
  if (!normalized) {
    return '';
  }

  if (import.meta.env.DEV && !window.electronAPI?.images?.fetch) {
    if (isVokinoProxyImage(normalized)) {
      return normalized.replace(`https://${PROXY_HOST}`, '/vokino-image');
    }

    if (isVokinoUploadImage(normalized)) {
      const parsed = new URL(normalized);
      const prefix = parsed.hostname === 'api.vokino.tv' ? '/vokino-uploads-tv' : '/vokino-uploads';
      return `${prefix}${parsed.pathname.replace(/^\/uploads/, '')}`;
    }
  }

  return normalized;
}

export async function loadMediaImage(url: string): Promise<string> {
  const normalized = normalizeVokinoImageUrl(url);
  if (!normalized) {
    throw new Error('Empty image url');
  }

  if (window.electronAPI?.images?.fetch && shouldFetchVokinoImageViaIpc(normalized)) {
    return runWithImageConcurrency(() => window.electronAPI!.images!.fetch(normalized));
  }

  return resolveDirectImageUrl(normalized);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
