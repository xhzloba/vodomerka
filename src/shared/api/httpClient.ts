import { API_TIMEOUT_MS, resolveVokinoUrl } from '@/shared/config/api';
import { runWithApiConcurrency, withRetries } from '@/shared/api/requestPool';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function withTimeout<T>(promise: Promise<T>, url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new ApiError('Превышено время ожидания ответа API', undefined, url));
    }, API_TIMEOUT_MS);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function mapFetchError(error: unknown, url: string): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError('Превышено время ожидания ответа API', undefined, url);
  }

  const message = error instanceof Error ? error.message : 'Не удалось выполнить запрос';

  if (message === 'Failed to fetch') {
    return new ApiError('Сеть недоступна или API заблокирован (CORS)', undefined, url);
  }

  if (message.startsWith('HTTP ')) {
    const status = Number.parseInt(message.slice(5), 10);
    return new ApiError(message, Number.isFinite(status) ? status : undefined, url);
  }

  return new ApiError(message, undefined, url);
}

async function requestViaElectron<T>(url: string): Promise<T> {
  try {
    return await withTimeout(window.electronAPI!.api.get(url) as Promise<T>, url);
  } catch (error) {
    throw mapFetchError(error, url);
  }
}

async function requestViaFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status}`, response.status, url);
    }

    return (await response.json()) as T;
  } catch (error) {
    throw mapFetchError(error, url);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function httpGet<T>(url: string, init?: RequestInit): Promise<T> {
  const resolvedUrl = resolveVokinoUrl(url);

  return runWithApiConcurrency(() =>
    withRetries(async () => {
      if (window.electronAPI?.api?.get) {
        return requestViaElectron<T>(resolvedUrl);
      }

      return requestViaFetch<T>(resolvedUrl, init);
    }),
  );
}
