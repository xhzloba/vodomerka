const API_CONCURRENCY = 6;
const API_MAX_RETRIES = 2;

let activeRequests = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeRequests < API_CONCURRENCY) {
    activeRequests += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeRequests += 1;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRequests = Math.max(0, activeRequests - 1);
  const next = waitQueue.shift();
  next?.();
}

export async function runWithApiConcurrency<T>(task: () => Promise<T>): Promise<T> {
  await acquireSlot();

  try {
    return await task();
  } finally {
    releaseSlot();
  }
}

export async function withRetries<T>(
  task: () => Promise<T>,
  retries = API_MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
