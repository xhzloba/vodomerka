import { BrowserWindow } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type {
  AiChatMessage,
  AiChatResult,
  AiDeleteResult,
  AiInstalledModel,
  AiPullProgressEvent,
  AiPullResult,
  AiRuntimeStatus,
  AiStatusSnapshot,
} from '../../contracts/ipc';
import { IPC_CHANNELS } from '../../contracts/ipc';
import { pickRecommendedAiModel } from '../../contracts/ai';

const execFileAsync = promisify(execFile);

export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

const OLLAMA_INSTALL_URLS = {
  darwin: 'https://ollama.com/download/mac',
  win32: 'https://ollama.com/download/windows',
  linux: 'https://ollama.com/download/linux',
  other: 'https://ollama.com/download',
} as const;

function normalizeBaseUrl(baseUrl?: string): string {
  const raw = (baseUrl ?? DEFAULT_OLLAMA_BASE_URL).trim().replace(/\/+$/, '');
  if (!raw) {
    return DEFAULT_OLLAMA_BASE_URL;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_OLLAMA_BASE_URL;
    }
    return parsed.origin;
  } catch {
    return DEFAULT_OLLAMA_BASE_URL;
  }
}

function resolvePlatform(): AiStatusSnapshot['platform'] {
  if (process.platform === 'darwin' || process.platform === 'win32' || process.platform === 'linux') {
    return process.platform;
  }
  return 'other';
}

function installUrlForPlatform(platform: AiStatusSnapshot['platform']): string {
  return OLLAMA_INSTALL_URLS[platform];
}

async function probeOllamaBinary(): Promise<boolean> {
  try {
    await execFileAsync('ollama', ['--version'], {
      timeout: 2500,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function mapInstalledModels(payload: {
  models?: Array<{
    name?: string;
    model?: string;
    size?: number;
    digest?: string;
    modified_at?: string;
    details?: {
      family?: string;
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}): AiInstalledModel[] {
  const models: AiInstalledModel[] = [];

  for (const entry of payload.models ?? []) {
    const name = (entry.name ?? entry.model ?? '').trim();
    if (!name) {
      continue;
    }

    models.push({
      name,
      size: typeof entry.size === 'number' ? entry.size : 0,
      digest: typeof entry.digest === 'string' ? entry.digest : '',
      family: entry.details?.family,
      parameterSize: entry.details?.parameter_size,
      quantization: entry.details?.quantization_level,
      modifiedAt: entry.modified_at,
    });
  }

  return models.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function statusMessage(
  status: AiRuntimeStatus,
  models: AiInstalledModel[],
  version: string | null,
): string {
  switch (status) {
    case 'ready':
      return version
        ? `Ollama ${version} · ${models.length} ${models.length === 1 ? 'модель' : 'моделей'}`
        : `Ollama доступен · ${models.length} моделей`;
    case 'no_models':
      return 'Ollama запущен, но моделей ещё нет — скачай в Плагины → ИИ';
    case 'offline':
      return 'Ollama установлен, но не отвечает. Запусти приложение Ollama и повтори проверку.';
    case 'missing':
      return 'Ollama не найден. Установи его по инструкции ниже.';
    default:
      return 'Статус локального ИИ ещё не проверен.';
  }
}

export async function getAiStatus(baseUrl?: string): Promise<AiStatusSnapshot> {
  const normalized = normalizeBaseUrl(baseUrl);
  const platform = resolvePlatform();
  const installUrl = installUrlForPlatform(platform);
  const checkedAt = Date.now();
  const binaryPresent = await probeOllamaBinary();

  try {
    const versionPayload = await fetchJson<{ version?: string }>(`${normalized}/api/version`);
    const tagsPayload = await fetchJson<{
      models?: Array<{
        name?: string;
        model?: string;
        size?: number;
        digest?: string;
        modified_at?: string;
        details?: {
          family?: string;
          parameter_size?: string;
          quantization_level?: string;
        };
      }>;
    }>(`${normalized}/api/tags`);
    const models = mapInstalledModels(tagsPayload);
    const version =
      typeof versionPayload.version === 'string' && versionPayload.version.length > 0
        ? versionPayload.version
        : null;
    const status: AiRuntimeStatus = models.length > 0 ? 'ready' : 'no_models';

    return {
      status,
      baseUrl: normalized,
      version,
      models,
      recommendedModel: pickRecommendedAiModel(models.map((model) => model.name)),
      message: statusMessage(status, models, version),
      platform,
      installUrl,
      checkedAt,
    };
  } catch {
    const status: AiRuntimeStatus = binaryPresent ? 'offline' : 'missing';
    return {
      status,
      baseUrl: normalized,
      version: null,
      models: [],
      recommendedModel: null,
      message: statusMessage(status, [], null),
      platform,
      installUrl,
      checkedAt,
    };
  }
}

export async function listAiModels(baseUrl?: string): Promise<AiInstalledModel[]> {
  const snapshot = await getAiStatus(baseUrl);
  return snapshot.models;
}

function broadcastPullProgress(event: AiPullProgressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.ai.pullProgress, event);
    }
  }
}

let activePullAbort: AbortController | null = null;
let activePullModel: string | null = null;

export function cancelAiPull(): { ok: true } {
  if (activePullAbort) {
    const model = activePullModel;
    activePullAbort.abort();
    activePullAbort = null;
    activePullModel = null;
    if (model) {
      broadcastPullProgress({
        model,
        status: 'cancelled',
        progress: 0,
      });
    }
  }
  return { ok: true };
}

export async function pullAiModel(model: string, baseUrl?: string): Promise<AiPullResult> {
  const name = model.trim();
  if (!name || name.length > 128) {
    return { ok: false, error: 'Некорректное имя модели' };
  }

  if (activePullAbort) {
    cancelAiPull();
  }

  const normalized = normalizeBaseUrl(baseUrl);
  const abort = new AbortController();
  activePullAbort = abort;
  activePullModel = name;

  try {
    const response = await fetch(`${normalized}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
      signal: abort.signal,
    });

    if (!response.ok) {
      return { ok: false, error: `Не удалось скачать модель (HTTP ${response.status})` };
    }

    if (!response.body) {
      return { ok: false, error: 'Пустой ответ от Ollama' };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastProgress = 0;

    while (true) {
      if (abort.signal.aborted) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        return { ok: false, error: 'Загрузка отменена', cancelled: true };
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        try {
          const chunk = JSON.parse(trimmed) as {
            status?: string;
            completed?: number;
            total?: number;
            error?: string;
          };

          if (typeof chunk.error === 'string' && chunk.error.length > 0) {
            return { ok: false, error: chunk.error };
          }

          const total = typeof chunk.total === 'number' ? chunk.total : 0;
          const completed = typeof chunk.completed === 'number' ? chunk.completed : 0;
          const progress =
            total > 0 ? Math.min(1, Math.max(0, completed / total)) : lastProgress;
          lastProgress = progress;

          broadcastPullProgress({
            model: name,
            status: typeof chunk.status === 'string' ? chunk.status : 'downloading',
            progress,
            completed,
            total,
          });
        } catch {
          // ignore malformed NDJSON lines
        }
      }
    }

    if (abort.signal.aborted) {
      return { ok: false, error: 'Загрузка отменена', cancelled: true };
    }

    broadcastPullProgress({
      model: name,
      status: 'success',
      progress: 1,
    });

    return { ok: true, model: name };
  } catch (error) {
    if (abort.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      return { ok: false, error: 'Загрузка отменена', cancelled: true };
    }
    const message = error instanceof Error ? error.message : 'Ошибка загрузки модели';
    return { ok: false, error: message };
  } finally {
    if (activePullAbort === abort) {
      activePullAbort = null;
      activePullModel = null;
    }
  }
}

export async function deleteAiModel(model: string, baseUrl?: string): Promise<AiDeleteResult> {
  const name = model.trim();
  if (!name) {
    return { ok: false, error: 'Не указана модель' };
  }

  const normalized = normalizeBaseUrl(baseUrl);

  try {
    const response = await fetch(`${normalized}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { ok: false, error: `Не удалось удалить модель (HTTP ${response.status})` };
    }

    return { ok: true, model: name };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка удаления модели';
    return { ok: false, error: message };
  }
}

export async function chatWithAi(
  messages: AiChatMessage[],
  options?: { model?: string; baseUrl?: string },
): Promise<AiChatResult> {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: 'Пустой запрос' };
  }

  const normalized = normalizeBaseUrl(options?.baseUrl);
  const status = await getAiStatus(normalized);
  const model =
    (options?.model && options.model.trim()) ||
    status.recommendedModel ||
    status.models[0]?.name;

  if (!model) {
    return { ok: false, error: 'Нет установленной модели' };
  }

  try {
    const payload = await fetchJson<{
      message?: { content?: string };
      error?: string;
    }>(
      `${normalized}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          think: false,
          options: {
            temperature: 0.2,
          },
        }),
      },
      120_000,
    );

    if (typeof payload.error === 'string' && payload.error.length > 0) {
      return { ok: false, error: payload.error };
    }

    const content = payload.message?.content?.trim();
    if (!content) {
      return { ok: false, error: 'Модель вернула пустой ответ' };
    }

    return { ok: true, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка запроса к модели';
    return { ok: false, error: message };
  }
}

export { normalizeBaseUrl };
