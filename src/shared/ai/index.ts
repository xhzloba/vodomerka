import type { AiChatMessage } from '../../../contracts/ipc';
import {
  AI_MODEL_CATALOG,
  formatAiModelSize,
  isCatalogModelInstalled,
  pickRecommendedAiModel,
} from '../../../contracts/ai';

export {
  AI_MODEL_CATALOG,
  formatAiModelSize,
  isCatalogModelInstalled,
  pickRecommendedAiModel,
};

export async function fetchAiStatus(baseUrl?: string) {
  if (!window.electronAPI?.ai) {
    return null;
  }

  return window.electronAPI.ai.getStatus(baseUrl);
}

export async function pullAiModel(model: string, baseUrl?: string) {
  if (!window.electronAPI?.ai) {
    return { ok: false as const, error: 'AI API недоступен' };
  }

  return window.electronAPI.ai.pullModel(model, baseUrl);
}

export async function cancelAiPull() {
  if (!window.electronAPI?.ai?.cancelPull) {
    return { ok: true as const };
  }

  return window.electronAPI.ai.cancelPull();
}

export async function deleteAiModel(model: string, baseUrl?: string) {
  if (!window.electronAPI?.ai) {
    return { ok: false as const, error: 'AI API недоступен' };
  }

  return window.electronAPI.ai.deleteModel(model, baseUrl);
}

export async function chatWithAi(
  messages: AiChatMessage[],
  options?: { model?: string; baseUrl?: string },
) {
  if (!window.electronAPI?.ai) {
    return { ok: false as const, error: 'AI API недоступен' };
  }

  return window.electronAPI.ai.chat(messages, options);
}
