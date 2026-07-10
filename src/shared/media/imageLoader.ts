const IMAGE_CONCURRENCY = 8;
const PROXY_HOST = 'proxy.vokino.pro';

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

export function resolveDirectImageUrl(url: string): string {
  if (!url) {
    return '';
  }

  if (import.meta.env.DEV && !window.electronAPI?.images?.fetch && isVokinoProxyImage(url)) {
    return url.replace(`https://${PROXY_HOST}`, '/vokino-image');
  }

  return url;
}

export async function loadMediaImage(url: string): Promise<string> {
  if (!url) {
    throw new Error('Empty image url');
  }

  if (window.electronAPI?.images?.fetch && isVokinoProxyImage(url)) {
    return runWithImageConcurrency(() => window.electronAPI!.images!.fetch(url));
  }

  return resolveDirectImageUrl(url);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
